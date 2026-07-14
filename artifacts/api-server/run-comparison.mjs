import CDP from "chrome-remote-interface";

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function classifyDetection(source, price, currentPrice) {
  const s = source.toLowerCase();
  if (s.includes("fvg") || s.includes("imbalance")) return "FVG";
  if (s.includes("order") || s.includes("ob") || s.includes("rejection")) return "OB";
  if (s.includes("bos") || s.includes("structure")) return "BOS";
  if (s.includes("choch")) return "CHOCH";
  if (s.includes("mss")) return "MSS";
  if (s.includes("liquidity") || s.includes("target")) return "LIQUIDITY_SWEEP";
  if (s.includes("smt") || s.includes("divergence")) return "SMT";
  if (s.includes("htf") || s.includes("po3") || s.includes("killzone") || s.includes("session")) return "SESSION_BREAKOUT";
  if (s.includes("silver") || s.includes("bullet")) return "SESSION_BREAKOUT";
  if (s.includes("concept") || s.includes("smc") || s.includes("smart")) {
    // These are general SMC - classify by position relative to price
    if (price > currentPrice * 1.001) return "LIQUIDITY_SWEEP";
    if (price < currentPrice * 0.999) return "LIQUIDITY_SWEEP";
    return "BIAS";
  }
  return "DISPLACEMENT";
}

async function main() {
  const resp = await fetch("http://127.0.0.1:9222/json/list");
  const targets = await resp.json();
  const target = targets.find(t => t.type === "page" && /tradingview\.com\/chart/i.test(t.url));
  if (!target) { console.log("No chart target"); process.exit(1); }

  const client = await CDP({ host: "127.0.0.1", port: 9222, target: target.id });
  await client.Runtime.enable();
  const e = async (expr) => { const r = await client.Runtime.evaluate({ expression: expr, returnByValue: true }); return r.result.value; };

  // 1. Switch to EURUSD 15min
  console.log("1. Switching to EURUSD 15min...");
  await e(`(function(){var c=window.TradingViewApi._activeChartWidgetWV.value();c.setSymbol("FX:EURUSD",{});})()`);
  await sleep(2000);
  await e(`(function(){var c=window.TradingViewApi._activeChartWidgetWV.value();c.setResolution("15",{});})()`);
  await sleep(2000);
  const sym = await e(`(function(){var c=window.TradingViewApi._activeChartWidgetWV.value();return c.symbol();})()`);
  const res = await e(`(function(){var c=window.TradingViewApi._activeChartWidgetWV.value();return c.resolution();})()`);
  console.log(`   ${sym} ${res}`);

  // 2. Read bars
  const bars = JSON.parse(await e(`
    (function() {
      var b = window.TradingViewApi._activeChartWidgetWV.value()._chartWidget.model().mainSeries().bars();
      var r = [];
      var e = b.lastIndex();
      var s = Math.max(b.firstIndex(), e - 200);
      for (var i = s; i <= e; i++) { var v = b.valueAt(i); if (v) r.push({ time: v[0], open: v[1], high: v[2], low: v[3], close: v[4], volume: v[5]||0 }); }
      return JSON.stringify(r);
    })()
  `));
  const cp = bars[bars.length - 1].close;
  console.log(`2. ${bars.length} candles, current price: ${cp.toFixed(5)}`);

  // 3. Read LuxAlgo/ICT Pine graphics from chart
  console.log("3. Reading LuxAlgo/ICT levels from chart...");
  const levels = JSON.parse(await e(`
    (function() {
      var chart = window.TradingViewApi._activeChartWidgetWV.value()._chartWidget;
      var model = chart.model();
      var sources = model.model().dataSources();
      var results = [];
      for (var si = 0; si < sources.length; si++) {
        var s = sources[si]; if (!s.metaInfo) continue;
        try {
          var meta = s.metaInfo();
          var name = (meta.description || meta.shortDescription || '').toLowerCase();
          if (!name) continue;
          var g = s._graphics; if (!g || !g._primitivesCollection) continue;
          try {
            var o = g._primitivesCollection.dwglines;
            if (o) { var inn = o.get('lines'); if (inn) { var c = inn.get(false);
              if (c && c._primitivesDataById) c._primitivesDataById.forEach(function(v, id) {
                if (v.y1 != null && v.y1 === v.y2) results.push({ source: name, price: v.y1 });
              });
            }}
          } catch(e) {}
        } catch(e) {}
      }
      return JSON.stringify(results);
    })()
  `));

  console.log(`   ${levels.length} horizontal line levels from LuxAlgo/ICT indicators`);

  // Classify LuxAlgo levels by indicator source into detection types
  const tvDetections = [];
  const seen = new Set();
  for (const l of levels) {
    const key = `${classifyDetection(l.source, l.price, cp)}_${Math.round(l.price * 10000)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    tvDetections.push({
      detectionType: classifyDetection(l.source, l.price, cp),
      price: l.price,
      confidence: 0.8,
      metadata: { source: l.source },
    });
  }
  // Deduplicate to keep the most significant levels
  const typeCounts = {};
  const dedupedTvDetections = [];
  for (const d of tvDetections) {
    if (!typeCounts[d.detectionType]) typeCounts[d.detectionType] = 0;
    typeCounts[d.detectionType]++;
    if (typeCounts[d.detectionType] <= 10) dedupedTvDetections.push(d);
  }

  console.log(`   Classified into ${dedupedTvDetections.length} detection points`);
  for (const [type, count] of Object.entries(typeCounts)) {
    console.log(`   ${type}: ${count}`);
  }

  // 4. Call SMC engine via API — pass bars from TV Desktop
  console.log("\n4. Running SMC engine via API (with TV Desktop bars)...");
  let engineDetections = [];
  let report = null;
  try {
    const apiResp = await fetch("http://localhost:3001/api/learning/comparisons/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        symbol: "EURUSD",
        timeframe: "15m",
        market: "forex",
        indicatorName: "",
        candles: bars,
        tvDetections: dedupedTvDetections,  // LuxAlgo levels classified by detection type
      }),
    });
    const result = await apiResp.json();
    if (apiResp.ok) {
      console.log(`   Comparisons stored: ${result.comparisonsCount}`);
      if (result.metrics) {
        console.log(`   Both: ${result.metrics.bothDetected}, TV: ${result.metrics.tvOnly}, Engine: ${result.metrics.engineOnly}`);
        console.log(`   Agreement rate: ${result.metrics.agreementRate}%`);
      }
      report = result.report;
      if (report) console.log(`   ${report.bias.toUpperCase()} ${report.trend} | ${report.phase} | $${report.currentPrice}`);
    } else {
      console.log(`   API Error: ${result.error}`);
    }
  } catch (err) {
    console.log(`   API error: ${err.message}`);
  }

  // 5. Compare manually — match TV LuxAlgo levels vs what the engine found
  console.log("\n5. Manual comparison of TV vs Engine:");
  if (report) {
    // Extract engine detections from the report
    const engOBs = (report.orderBlocks || []).filter(o => o.valid && !o.isMitigated);
    const engFVGs = (report.fvg || []).filter(f => f.fillFraction < 0.5);
    const engBSL = report.liquidity?.nearestBSL;
    const engSSL = report.liquidity?.nearestSSL;

    console.log(`   Eng OBs: ${engOBs.length}, FVGs: ${engFVGs.length}, BSL: ${engBSL?.price?.toFixed(5) || "none"}, SSL: ${engSSL?.price?.toFixed(5) || "none"}`);

    // Match price levels
    const tvPrices = [...new Set(levels.map(l => Math.round(l.price * 100000) / 100000))].sort((a, b) => a - b);
    const engOBPrices = engOBs.map(o => Math.round(o.proximal * 100000) / 100000);
    const engFVGPrices = engFVGs.map(f => Math.round(((f.top + f.bottom) / 2) * 100000) / 100000);

    // Find matches
    const OBmatches = tvPrices.filter(tv => engOBPrices.some(eng => Math.abs(tv - eng) / Math.max(tv, 0.0001) < 0.003));
    const FVGmatches = tvPrices.filter(tv => engFVGPrices.some(eng => Math.abs(tv - eng) / Math.max(tv, 0.0001) < 0.003));

    console.log(`\n   Order Block matches: ${OBmatches.length}/${engOBPrices.length}`);
    if (OBmatches.length > 0) console.log(`     Levels: ${OBmatches.slice(0, 5).join(", ")}`);

    console.log(`   FVG matches: ${FVGmatches.length}/${engFVGPrices.length}`);
    if (FVGmatches.length > 0) console.log(`     Levels: ${FVGmatches.slice(0, 5).join(", ")}`);

    // Detection type agreement
    console.log(`\n   TV says: ${dedupedTvDetections.length} levels`);
    console.log(`   Engine says: ${engOBs.length + engFVGs.length + (engBSL ? 1 : 0) + (engSSL ? 1 : 0)} levels`);
    console.log(`   Agreement on OB levels: ${OBmatches.length}`);
    console.log(`   Agreement on FVG levels: ${FVGmatches.length}`);
    console.log(`   Engine missed TV levels: ${tvPrices.length - OBmatches.length - FVGmatches.length}`);
  } else {
    console.log("   (no engine report available)");
  }

  // 6. Look at the dashboard
  console.log("\n6. Learning Dashboard:");
  try {
    const dashResp = await fetch("http://localhost:3001/api/learning/dashboard");
    const dash = await dashResp.json();
    console.log(`   Reliability: ${dash.reliability.overall}% (${dash.reliability.trend})`);
    console.log(`   Engine: ${dash.reliability.bySource?.engine?.toFixed(1) || "?"}%`);
    console.log(`   TV: ${dash.reliability.bySource?.tv?.toFixed(1) || "?"}%`);
  } catch (err) {
    console.log(`   Dashboard: ${err.message}`);
  }

  console.log("\nDone.");
  await client.close();
}

main().catch(e => { console.error("FAIL:", e.message); process.exit(1); });
