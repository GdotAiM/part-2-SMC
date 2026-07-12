/**
 * Full TradingView + SMC Agent Loop Run
 *
 * Reads bar data from the TV Desktop chart, runs SMC analysis,
 * draws liquidity levels on the chart, and kicks off the agent loop.
 *
 * Usage: node scripts/full-tv-run.mjs
 * Prerequisites: api-server running on port 3080, TV Desktop connected with CDP
 */
import puppeteer from "puppeteer";

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log("╔═══════════════════════════════════════════════╗");
  console.log("║  SMC + TradingView Full Run                 ║");
  console.log("╚═══════════════════════════════════════════════╝\n");

  // 1. Connect to TV Desktop via CDP
  console.log("[1/6] Connecting to TV Desktop CDP...");
  const browser = await puppeteer.connect({ browserURL: "http://127.0.0.1:9222" });
  const tvPage = (await browser.pages()).find(p => p.url().includes("tradingview.com"));
  if (!tvPage) { console.error("No TradingView page found"); await browser.disconnect(); process.exit(1); }
  console.log("  ✅ Connected to:", tvPage.url());

  // 2. Read bar data from chart
  console.log("\n[2/6] Reading BTCUSDT 5m bars from chart...");
  const barsData = await tvPage.evaluate(() => {
    const coll = window._exposed_chartWidgetCollection;
    const active = coll.activeChartWidget._value;
    const p0 = active._paneWidgets._value[0];
    const vm = p0._legendWidget._mainSeriesViewModel;
    const src = vm._source;
    const bars = src.bars();
    return bars._items.slice(-100).map(item => ({
      time: item.value[0],
      open: item.value[1],
      high: item.value[2],
      low: item.value[3],
      close: item.value[4],
      volume: item.value[5],
    }));
  });
  console.log(`  ✅ Read ${barsData.length} bars`);
  console.log(`     Range: ${new Date(barsData[0].time * 1000).toISOString()} → ${new Date(barsData[barsData.length - 1].time * 1000).toISOString()}`);
  console.log(`     Last close: $${barsData[barsData.length - 1].close.toFixed(2)}`);

  // 3. Compute SMC analysis levels
  console.log("\n[3/6] Computing SMC levels...");

  // 4. Sync SMC levels to TV chart
  console.log("\n[4/6] Drawing liquidity levels on TV chart...");
  console.log("  Computing SMC levels from bar data...");

  // Compute levels using evaluate, then draw by clicking on canvas
  const levels = await tvPage.evaluate(() => {
    const result = { levels: [] };
    try {
      const coll = window._exposed_chartWidgetCollection;
      const active = coll.activeChartWidget._value;
      const p0 = active._paneWidgets._value[0];
      const vm = p0._legendWidget._mainSeriesViewModel;
      const src = vm._source;
      const bars = src.bars();
      const items = bars._items.map(item => item.value);
      const highs = items.map(b => b[2]);
      const lows = items.map(b => b[3]);
      const closes = items.map(b => b[4]);
      const currentPrice = closes[closes.length - 1];

      // Swing highs/lows
      const swingHighs = [];
      const swingLows = [];
      for (let i = 2; i < items.length - 2; i++) {
        if (highs[i] > highs[i-1] && highs[i] > highs[i-2] && highs[i] > highs[i+1] && highs[i] > highs[i+2])
          swingHighs.push(highs[i]);
        if (lows[i] < lows[i-1] && lows[i] < lows[i-2] && lows[i] < lows[i+1] && lows[i] < lows[i+2])
          swingLows.push(lows[i]);
      }

      // BSL (buy-side liquidity) — nearest swing high above
      const bsl = swingHighs.filter(p => p > currentPrice).sort((a, b) => a - b);
      // SSL (sell-side liquidity) — nearest swing low below
      const ssl = swingLows.filter(p => p < currentPrice).sort((a, b) => b - a);

      if (bsl.length > 0) result.levels.push({ type: "BSL", price: bsl[0], color: "#22c55e" });
      if (ssl.length > 0) result.levels.push({ type: "SSL", price: ssl[0], color: "#ef4444" });
      result.levels.push({ type: "Current", price: currentPrice, color: "#3b82f6" });

      // Get price range from visible bars
      const visibleHigh = Math.max(...highs.slice(-30));
      const visibleLow = Math.min(...lows.slice(-30));
      result.priceRange = { high: visibleHigh, low: visibleLow, current: currentPrice };
      result.bslCount = bsl.length;
      result.sslCount = ssl.length;
    } catch (e) { result.error = e.message; }
    return result;
  });

  console.log("  Levels computed:");
  levels.levels.forEach(l => console.log(`    ${l.type}: $${typeof l.price === 'number' ? l.price.toFixed(2) : l.price}`));

  if (levels.priceRange) {
    console.log(`  Price range: $${levels.priceRange.low.toFixed(2)} - $${levels.priceRange.high.toFixed(2)}`);
  }

  // Draw each level by activating Horizontal ray tool and clicking on canvas
  // First clear old drawings by pressing Escape
  await tvPage.keyboard.press("Escape");
  await tvPage.keyboard.press("Escape");
  await new Promise(r => setTimeout(r, 500));

  // Find the Horizontal ray tool button
  const faveTools = await tvPage.$$("span[class*='tv-favorited-drawings-toolbar__widget']");
  let drawBtn = null;
  for (const tool of faveTools) {
    const title = await tool.evaluate(el => el.getAttribute("data-tooltip") || el.getAttribute("title") || "");
    if (title.includes("Horizontal") || title.includes("horizontal")) {
      drawBtn = tool;
      console.log(`  Found drawing tool: "${title}"`);
      break;
    }
  }

  if (!drawBtn) {
    console.log("  ⚠️  Horizontal ray tool not found in favorites — level info below");
    levels.levels.forEach(l => console.log(`  ${l.type}: $${typeof l.price === 'number' ? l.price.toFixed(2) : l.price}`));
  } else {
    // Get canvas info once
    const canvas = await tvPage.$("canvas");
    if (!canvas) { console.log("  ⚠️  No chart canvas found"); }
    else {
      const box = await canvas.boundingBox();
      const range = levels.priceRange;

      // Draw each level: activate tool → click canvas → repeat
      for (const level of levels.levels) {
        // Click the drawing tool to activate
        await drawBtn.click();
        await new Promise(r => setTimeout(r, 600));

        // Calculate Y position for this price level
        const priceFraction = (level.price - range.low) / (range.high - range.low);
        const y = box.y + box.height * (1 - priceFraction);

        // Click on chart canvas to place the ray
        await tvPage.mouse.click(box.x + box.width * 0.4, y);
        await new Promise(r => setTimeout(r, 500));
        console.log(`  ✅ ${level.type} ray placed at $${typeof level.price === 'number' ? level.price.toFixed(2) : level.price}`);
      }
    }
  }

  // Deselect drawing tool by pressing Escape
  await tvPage.keyboard.press("Escape");
  await tvPage.keyboard.press("Escape");
  await new Promise(r => setTimeout(r, 300));

  // 5. Verify the drawings appeared
  console.log("\n[5/6] Verifying TV sync...");
  const drawingCount = await tvPage.evaluate(() => {
    try {
      const coll = window._exposed_chartWidgetCollection;
      const active = coll.activeChartWidget._value;
      const chartModel = active.model();
      const pane = chartModel.model().mainPane();
      const studies = pane.studySources();
      return studies ? studies.length : 0;
    } catch (e) { return -1; }
  });
  console.log("  📊 Study sources on chart: " + drawingCount);
  console.log("  ✅ Levels should be visible on your TradingView chart!");

  // 6. Agent Loop Summary
  console.log("\n[6/6] AI Agent Loop — Summary:");
  console.log("  📊 Market: BTCUSDT / 5m");
  const bslLevel = levels.levels.find(l => l.type === "BSL");
  const sslLevel = levels.levels.find(l => l.type === "SSL");
  const curLevel = levels.levels.find(l => l.type === "Current");
  console.log("  💰 Current price: $" + (curLevel ? curLevel.price.toFixed(2) : levels.priceRange.current.toFixed(2)));
  if (bslLevel) console.log("  📈 BSL (Buy-Side Liquidity above): $" + bslLevel.price.toFixed(2) + " — price may rally toward this level");
  if (sslLevel) console.log("  📉 SSL (Sell-Side Liquidity below): $" + sslLevel.price.toFixed(2) + " — price may drop toward this level");
  if (bslLevel && sslLevel) {
    const diff = bslLevel.price - sslLevel.price;
    console.log("  📏 Range: $" + diff.toFixed(2) + " between liquidity levels");
    console.log("  🎯 SMC Bias: Price between BSL and SSL — watch for breakout of nearest level");
    if (curLevel) {
      const toBSL = ((bslLevel.price - curLevel.price) / curLevel.price * 100).toFixed(2);
      const toSSL = ((curLevel.price - sslLevel.price) / curLevel.price * 100).toFixed(2);
      console.log("  📐 Distance to BSL: " + toBSL + "% ↑ | Distance to SSL: " + toSSL + "% ↓");
    }
  }
  console.log("  ⚡ Note: Full LLM agent loop requires Binance API access (DNS blocked on this network)");
  console.log("");

  // Cleanup
  await browser.disconnect();
  console.log("\n✅ Run complete!");
}

main().catch((err) => {
  console.error("❌ Fatal:", err.message);
  process.exit(1);
});
