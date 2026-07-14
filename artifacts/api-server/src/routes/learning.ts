/**
 * Learning & Validation Framework — API Routes
 *
 * Uses direct node-postgres (pg) to avoid Drizzle ORM Proxy/esbuild issues.
 * Falls back gracefully when DATABASE_URL is not configured.
 */

import { Router, type IRouter } from "express";
import pg from "pg";
import { logger } from "../lib/logger.js";
import { reliabilityEngine } from "../lib/reliability/ReliabilityEngine.js";
import { learningService } from "../lib/learning/LearningService.js";
import { parameterRecommendationService } from "../lib/optimization/ParameterRecommendationService.js";
import { candleStore } from "../lib/realtime/candle-store.js";
import { buildReport } from "../lib/smc/report.js";
import { fetchBinanceCandles } from "../lib/fetchers/binance.js";
import { fetchYahooCandles } from "../lib/fetchers/yahoo.js";
import { compareDetections, extractEngineDetections, readPineDetections, calculateComparisonMetrics } from "../lib/comparison/ComparisonEngine.js";
import { evidenceFusionLayer } from "../lib/fusion/EvidenceFusionLayer.js";
import { OutcomeEvaluator } from "../lib/evaluation/OutcomeEvaluator.js";
import { truthEngine } from "../lib/truth/TruthEngine.js";

const router: IRouter = Router();
// Lazy pool — created only when DATABASE_URL is set
const PgPool: any = (pg as any).Pool;
let _pool: any = null;
function getPool(): any {
  if (!process.env.DATABASE_URL) return null;
  if (!_pool) _pool = new PgPool({ connectionString: process.env.DATABASE_URL });
  return _pool;
}

async function query(text: string, params?: any[]): Promise<any[]> {
  const pool = getPool();
  if (!pool) return [];
  try {
    const result = await pool.query(text, params);
    return result.rows || [];
  } catch (err: any) {
    logger.error({ err: err.message, text: text.slice(0, 80) }, "[LearningDB] Query failed");
    return [];
  }
}

// ══════════════════════════════════════════════════════════════════════════
// Comparison Endpoints
// ══════════════════════════════════════════════════════════════════════════

router.get("/comparisons", async (req, res) => {
  try {
    const { symbol, detectionType, agreement, limit, offset, from, to } = req.query;
    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (symbol) { conditions.push(`symbol = $${idx++}`); params.push(symbol); }
    if (detectionType) { conditions.push(`detection_type = $${idx++}`); params.push(detectionType); }
    if (agreement) { conditions.push(`agreement = $${idx++}`); params.push(agreement); }
    if (from) { conditions.push(`candle_time >= $${idx++}`); params.push(new Date(from as string)); }
    if (to) { conditions.push(`candle_time <= $${idx++}`); params.push(new Date(to as string)); }

    const where = conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "";
    const lim = Math.min(parseInt(limit as string) || 50, 500);
    const off = parseInt(offset as string) || 0;

    const rows = await query(`SELECT * FROM detection_comparisons ${where} ORDER BY candle_time DESC LIMIT $${idx++} OFFSET $${idx++}`, [...params, lim, off]);
    const countRows = await query(`SELECT count(*)::int as total FROM detection_comparisons ${where}`, params);

    res.json({ comparisons: rows, total: countRows[0]?.total ?? 0 });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/comparisons/analyze", async (req, res) => {
  try {
    const { symbol, timeframe, market, indicatorName, candles: providedCandles, tvDetections: providedTvDetections } = req.body;
    if (!symbol || !timeframe || !market) {
      res.status(400).json({ error: "symbol, timeframe, and market required" });
      return;
    }

    let candles = providedCandles || candleStore.getCandles(symbol, timeframe);
    if (!candles || candles.length < 50) {
      try {
        candles = market === "crypto"
          ? await fetchBinanceCandles(symbol, timeframe)
          : await fetchYahooCandles(symbol, timeframe);
      } catch (fetchErr: any) {
        logger.warn({ err: fetchErr.message }, "Candle fetch failed");
      }
    }
    if (!candles || candles.length < 10) {
      res.status(400).json({ error: `Insufficient candle data (${candles?.length || 0})` });
      return;
    }

    const report = buildReport(candles, symbol, market as "crypto" | "forex", timeframe);

    let tvDetections: any[] = providedTvDetections || [];
    if (tvDetections.length === 0) {
      try {
        const { isConnected } = await import("../lib/integrations/tradingview-desktop/core/connection.js");
        if (await isConnected() && indicatorName) {
          tvDetections = await readPineDetections(indicatorName as string);
        }
      } catch (tvErr: any) {
        logger.warn({ err: tvErr.message }, "TV read failed");
      }
    }

    const engineDetections = extractEngineDetections(report as any);
    const comparisons = compareDetections(
      symbol, timeframe, market as string,
      tvDetections, engineDetections,
      new Date(candles[candles.length - 1].time * 1000),
    );

    const count = await learningService.storeComparisons(comparisons);
    const decisions = evidenceFusionLayer.fuseAll(comparisons);

    // ── Truth Engine arbitration ──────────────────────────────────────────────
    const relReport = reliabilityEngine.getReport();
    const relByType = relReport.byTypeBySource;
    const context = {
      marketRegime: report.structure.phase === "expansion" ? "trending"
        : report.structure.phase === "distribution" ? "trending"
        : report.structure.phase === "accumulation" ? "ranging"
        : "volatile",
      session: report.sessionState?.toLowerCase().includes("london") ? "london"
        : report.sessionState?.toLowerCase().includes("new york") || report.sessionState?.toLowerCase().includes("ny") ? "newYork"
        : report.sessionState?.toLowerCase().includes("asia") ? "asia"
        : report.sessionState?.toLowerCase().includes("pm") ? "overlap"
        : "offHours",
      volatilityPct: candles.length > 50
        ? (Math.max(...candles.slice(-20).map((c: any) => c.high)) - Math.min(...candles.slice(-20).map((c: any) => c.low))) / (candles[candles.length - 1] as any).close
        : 0.005,
    };
    const arbitrated = truthEngine.arbitrateAll(decisions, relByType, { tv: { correct: 0, total: 0 }, engine: { correct: 0, total: 0 } }, context);

    res.json({
      comparisonsCount: count,
      comparisons: comparisons.slice(0, 20),
      fusedDecisions: decisions.slice(0, 20),
      arbitratedMarketView: arbitrated,
      metrics: calculateComparisonMetrics(comparisons),
      report: {
        symbol: report.symbol, timeframe: report.timeframe,
        currentPrice: report.currentPrice, bias: report.structure.bias,
        trend: report.structure.trend, phase: report.structure.phase,
      },
    });
  } catch (err: any) {
    logger.error({ err: err.message, stack: err.stack }, "POST /learning/comparisons/analyze failed");
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/learning/read-tv-indicator-levels
 * Read indicator levels from TradingView Desktop via CDP.
 * Extracts data window values from ALL active Pine Script indicators.
 */
router.get("/read-tv-indicator-levels", async (_req, res) => {
  try {
    // Use chrome-remote-interface directly
    const CDP = (await import("chrome-remote-interface")).default;
    const targets = await fetch("http://127.0.0.1:9222/json/list").then(r => r.json());
    const target = targets.find((t: any) => t.type === "page" && /tradingview\.com\/chart/i.test(t.url));
    if (!target) { res.json({ error: "No TradingView chart page found", levels: [] }); return; }

    const client = await CDP({ host: "127.0.0.1", port: 9222, target: target.id });
    await client.Runtime.enable();

    const E = async (expr: string) => {
      const r = await client.Runtime.evaluate({ expression: expr, returnByValue: true, awaitPromise: true });
      return r.result.value;
    };

    const raw = await E(`
      (function() {
        var api = window.TradingViewApi;
        var wv = api._activeChartWidgetWV.value();
        var model = wv._chartWidget.model();
        var sources = model.model().dataSources();
        var results = [];

        for (var si = 0; si < sources.length; si++) {
          var s = sources[si];
          if (!s.metaInfo) continue;
          try {
            var meta = s.metaInfo();
            var name = (meta.description || meta.shortDescription || '').toLowerCase();
            // Skip main price series and default overlays
            if (name.includes('dividend') || name.includes('split') || name.includes('earning') || name.includes('dates calculator')) continue;

            var dwv = s.dataWindowView();
            if (!dwv) continue;
            var items = dwv.items();
            var vals = [];

            for (var i = 0; i < items.length; i++) {
              var item = items[i];
              if (item._value && item._value !== '∅' && item._value !== '' && item._value !== 'NaN') {
                var raw = String(item._value).replace(/,/g, '');
                var num = parseFloat(raw);
                if (!isNaN(num) && num > 0.001) {
                  vals.push({ title: item._title || '', value: num, raw: item._value });
                }
              }
            }

            if (vals.length > 0) {
              results.push({ name: name, values: vals });
            }
          } catch(e) {}
        }
        return JSON.stringify(results);
      })()
    `);

    await client.close();

    const indicators = JSON.parse(raw || "[]");

    // Classify values into detection types
    const allLevels: any[] = [];
    const seen = new Set<string>();

    for (const ind of indicators) {
      for (const v of ind.values) {
        // Classic detection types based on indicator name + value title
        let detectionType = "LIQUIDITY_SWEEP";
        const name = ind.name.toLowerCase();
        const title = (v.title || "").toLowerCase();

        if (name.includes("ob") || name.includes("order") || title.includes("ob") || title.includes("order")) detectionType = "OB";
        else if (name.includes("fvg") || name.includes("gap") || name.includes("imbalance") || title.includes("fvg") || title.includes("gap")) detectionType = "FVG";
        else if (name.includes("bos") || name.includes("structure") || title.includes("bos") || title.includes("choch") || title.includes("mss")) {
          if (title.includes("choch")) detectionType = "CHOCH";
          else detectionType = "BOS";
        }
        else if (name.includes("liquidity") || name.includes("target") || title.includes("bsl") || title.includes("ssl")) detectionType = "LIQUIDITY_SWEEP";
        else if (name.includes("premium") || title.includes("premium")) detectionType = "PREMIUM";
        else if (name.includes("discount") || title.includes("discount")) detectionType = "DISCOUNT";
        else if (name.includes("smt") || title.includes("divergence") || title.includes("smt")) detectionType = "SMT";
        else if (title.includes("plotcandle") || title.includes("plot")) {
          // PlotCandle values are price levels — treat as liquidity levels
          detectionType = "LIQUIDITY_SWEEP";
        }

        const key = `${detectionType}_${Math.round(v.value * 10000)}`;
        if (!seen.has(key)) {
          seen.add(key);
          allLevels.push({
            detectionType,
            price: v.value,
            confidence: 0.75,
            indicator: ind.name,
            label: v.title,
            rawValue: v.raw,
          });
        }
      }
    }

    const byType: Record<string, number> = {};
    for (const l of allLevels) byType[l.detectionType] = (byType[l.detectionType] || 0) + 1;

    res.json({
      connected: true,
      indicatorsFound: indicators.map((i: any) => i.name),
      totalLevels: allLevels.length,
      byType,
      levels: allLevels.slice(0, 100),
    });
  } catch (err: any) {
    logger.warn({ err: err.message }, "read-tv-indicator-levels failed");
    res.json({ connected: false, error: err.message, levels: [] });
  }
});

router.post("/evaluate-outcomes", async (req, res) => {
  try {
    const { comparisonIds, lookbackBars } = req.body;
    if (!comparisonIds || !Array.isArray(comparisonIds)) {
      res.status(400).json({ error: "comparisonIds array required" });
      return;
    }

    const ids = comparisonIds.map((id: string) => `'${id}'`).join(",");
    const rows = await query(`SELECT * FROM detection_comparisons WHERE id = ANY($1::uuid[])`, [comparisonIds]);

    if (rows.length === 0) { res.json({ outcomes: [], message: "No comparisons found" }); return; }

    const symbol = rows[0].symbol;
    const timeframe = rows[0].timeframe;
    const market = rows[0].market;
    let candles = candleStore.getCandles(symbol, timeframe);

    if (candles.length < 50) {
      candles = market === "crypto"
        ? await fetchBinanceCandles(symbol, timeframe)
        : await fetchYahooCandles(symbol, timeframe);
    }

    const evaluator = new OutcomeEvaluator();
    const comparisons = rows.map((r: any) => ({
      id: r.id,
      detectionType: r.detection_type,
      priceLevel: parseFloat(r.price_level),
      agreement: r.agreement,
      tv: { detected: r.tv_detected, price: r.tv_price ? parseFloat(r.tv_price) : null },
      engine: { detected: r.engine_detected, price: r.engine_price ? parseFloat(r.engine_price) : null },
    }));

    const outcomes = evaluator.evaluate(comparisons, candles, lookbackBars || 20);
    await evaluator.processOutcomes(outcomes, comparisons);
    res.json({ outcomes, count: outcomes.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/learning/arbitrate
 * Accept fused decisions and market context, return an arbitrated market view.
 * This is the endpoint AIs call to get a single authoritative answer.
 */
router.post("/arbitrate", async (req, res) => {
  try {
    const { fusedDecisions, marketContext } = req.body;
    if (!fusedDecisions || !Array.isArray(fusedDecisions)) {
      res.status(400).json({ error: "fusedDecisions array required" });
      return;
    }

    const relReport = reliabilityEngine.getReport();
    const context = marketContext || { marketRegime: "unknown", session: "offHours", volatilityPct: 0.005 };
    const arbitrated = truthEngine.arbitrateAll(fusedDecisions, relReport.byTypeBySource, { tv: { correct: 0, total: 0 }, engine: { correct: 0, total: 0 } }, context);

    res.json({ arbitratedMarketView: arbitrated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/reliability", async (_req, res) => {
  try {
    const report = reliabilityEngine.getReport();
    const dbRows = await query("SELECT * FROM model_performance ORDER BY reliability_score DESC LIMIT 50");
    res.json({ inMemory: report, database: dbRows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/parameter-suggestions", async (req, res) => {
  try {
    const { status, component } = req.query;
    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;
    if (status) { conditions.push(`status = $${idx++}`); params.push(status); }
    if (component) { conditions.push(`component = $${idx++}`); params.push(component); }
    const where = conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "";
    const rows = await query(`SELECT * FROM parameter_history ${where} ORDER BY created_at DESC LIMIT 50`, params);
    res.json({ suggestions: rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/parameter-suggestions/generate", async (_req, res) => {
  try {
    const stats = await query(`
      SELECT detection_type,
             COUNT(*) as sample_size,
             SUM(CASE WHEN agreement = 'BOTH_DETECTED' THEN 1 ELSE 0 END)::float / COUNT(*)::float as win_rate,
             AVG(price_discrepancy_pct) as avg_price_discrepancy,
             AVG(confidence_gap) as avg_confidence_gap
      FROM detection_comparisons
      WHERE candle_time > NOW() - INTERVAL '30 days'
      GROUP BY detection_type
    `);
    const periodData = stats.map((r: any) => ({
      detectionType: r.detection_type,
      winRate: parseFloat(r.win_rate) || 0,
      sampleSize: parseInt(r.sample_size) || 0,
      avgPriceDiscrepancy: parseFloat(r.avg_price_discrepancy) || 0,
      avgConfidenceGap: parseFloat(r.avg_confidence_gap) || 0,
    }));
    const recommendations = await parameterRecommendationService.generateRecommendations(periodData);
    res.json({ suggestions: recommendations });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/parameter-suggestions/:id/approve", async (req, res) => {
  try {
    const { id } = req.params;
    const { approvedBy } = req.body;
    const pool = getPool();
    if (!pool) { res.status(400).json({ error: "DB not configured" }); return; }
    const result = await pool.query(
      "UPDATE parameter_history SET status = 'approved', approved_at = NOW(), approved_by = $1 WHERE id = $2 RETURNING *",
      [approvedBy || "manual_review", id],
    );
    if (result.rows.length === 0) { res.status(404).json({ error: "Suggestion not found" }); return; }
    await learningService.logLearningEvent({
      eventType: "PARAMETER_SUGGESTION",
      title: `Parameter ${result.rows[0].parameter_name} approved`,
      description: `${result.rows[0].component}.${result.rows[0].parameter_name}: ${result.rows[0].current_value} → ${result.rows[0].suggested_value}`,
      significance: 0.8,
    });
    res.json({ success: true, suggestion: result.rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/events", async (req, res) => {
  try {
    const { eventType, limit } = req.query;
    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;
    if (eventType) { conditions.push(`event_type = $${idx++}`); params.push(eventType); }
    const where = conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "";
    const lim = Math.min(parseInt(limit as string) || 50, 200);
    const rows = await query(`SELECT * FROM learning_events ${where} ORDER BY detected_at DESC LIMIT $${idx}`, [...params, lim]);
    res.json({ events: rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/patterns", async (req, res) => {
  try {
    const { patternType } = req.query;
    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;
    if (patternType) { conditions.push(`pattern_type = $${idx++}`); params.push(patternType); }
    const where = conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "";
    const rows = await query(`SELECT * FROM pattern_statistics ${where} ORDER BY win_rate_when_present DESC NULLS LAST LIMIT 50`, params);
    res.json({ patterns: rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/dashboard", async (_req, res) => {
  try {
    const reliability = reliabilityEngine.getReport();

    const [comparisons, outcomes, events, suggestions, patterns] = await Promise.all([
      query(`SELECT count(*)::int as total,
               sum(case when agreement = 'BOTH_DETECTED' then 1 else 0 end)::int as "bothDetected",
               sum(case when agreement = 'TV_ONLY' then 1 else 0 end)::int as "tvOnly",
               sum(case when agreement = 'ENGINE_ONLY' then 1 else 0 end)::int as "engineOnly",
               sum(case when agreement = 'NEITHER' then 1 else 0 end)::int as "neither"
             FROM detection_comparisons`),
      query(`SELECT count(*)::int as total,
               sum(case when outcome = 'RESPECTED' then 1 else 0 end)::int as respected,
               sum(case when outcome = 'SWEPT' then 1 else 0 end)::int as swept,
               sum(case when outcome = 'IGNORED' then 1 else 0 end)::int as ignored,
               sum(case when outcome = 'FILLED' then 1 else 0 end)::int as filled,
               sum(case when outcome = 'REVERSAL' then 1 else 0 end)::int as reversal
             FROM detection_outcomes`),
      query(`SELECT * FROM learning_events ORDER BY detected_at DESC LIMIT 20`),
      query(`SELECT * FROM parameter_history WHERE status = 'suggested' ORDER BY created_at DESC LIMIT 10`),
      query(`SELECT * FROM pattern_statistics ORDER BY win_rate_when_present DESC NULLS LAST LIMIT 20`),
    ]);

    const cs = comparisons[0] || { total: 0, bothDetected: 0, tvOnly: 0, engineOnly: 0, neither: 0 };

    res.json({
      reliability,
      comparisons: cs,
      outcomes: outcomes[0] || { total: 0, respected: 0, swept: 0, ignored: 0, filled: 0, reversal: 0 },
      recentEvents: events,
      recentSuggestions: suggestions,
      patterns,
      derivedMetrics: {
        agreementRate: cs.total > 0 ? Math.round((cs.bothDetected / cs.total) * 100) : 0,
        engineAccuracy: cs.total > 0 ? Math.round(((cs.bothDetected + cs.engineOnly) / cs.total) * 100) : 0,
        tvAccuracy: cs.total > 0 ? Math.round(((cs.bothDetected + cs.tvOnly) / cs.total) * 100) : 0,
        bothWrongRate: cs.total > 0 ? Math.round((cs.neither / cs.total) * 100) : 0,
        bothCorrectRate: 0,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    logger.error({ err: err.message }, "GET /learning/dashboard failed");
    res.status(500).json({ error: err.message });
  }
});

export default router;
