import { Router, type IRouter } from "express";
import { fetchBinanceCandles, fetchBinanceDailyCandles } from "../lib/fetchers/binance.js";
import { fetchYahooCandles, fetchYahooDailyCandles } from "../lib/fetchers/yahoo.js";
import { buildReport } from "../lib/smc/report.js";
import type { Candle } from "@workspace/api-zod";
import { candleStore } from "../lib/realtime/candle-store.js";
import { logger } from "../lib/logger.js";

// ── Helpers ──────────────────────────────────────────────────────────────

/**
 * Try to get candles from the candle store (the real-time pipeline)
 * as a fallback when external API fetches fail.
 */
function getCandlesFromStore(symbol: string, timeframe: string, minCandles = 50) {
  const candles = candleStore.getCandles(symbol, timeframe);
  if (candles.length >= minCandles) {
    logger.info({ symbol, timeframe, count: candles.length, source: "candle_store" }, "Using candle store as fallback");
    return candles;
  }
  return null;
}

const router: IRouter = Router();

// ── Lightweight in-memory TTL cache ─────────────────────────────────────────
// Caches OHLCV + report responses for 60 seconds.
// Key: market|symbol|timeframe|correlatedSymbol
// No external infrastructure required — pure in-process Map.

interface CacheEntry {
  data: unknown;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60_000;

function cacheKey(market: string, symbol: string, tf: string, corrSym?: string): string {
  return `${market}|${symbol}|${tf}|${corrSym ?? ""}`;
}

function getCached(key: string): unknown | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { cache.delete(key); return null; }
  return entry.data;
}

function setCached(key: string, data: unknown): void {
  // Evict oldest entry if cache grows large (>500 keys) to avoid memory leak
  if (cache.size > 500) {
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ── Crypto analysis ──────────────────────────────────────────────────────────

router.get("/analysis/crypto", async (req, res): Promise<void> => {
  const symbol = Array.isArray(req.query.symbol) ? req.query.symbol[0] : req.query.symbol;
  const timeframe = Array.isArray(req.query.timeframe)
    ? req.query.timeframe[0]
    : (req.query.timeframe ?? "4h");
  const correlatedSymbol = Array.isArray(req.query.correlatedSymbol)
    ? req.query.correlatedSymbol[0]
    : req.query.correlatedSymbol;

  if (!symbol || typeof symbol !== "string") {
    res.status(400).json({ error: "symbol query param is required" });
    return;
  }

  const tf      = typeof timeframe          === "string" ? timeframe          : "4h";
  const corrSym = typeof correlatedSymbol   === "string" ? correlatedSymbol   : undefined;
  const key     = cacheKey("crypto", symbol, tf, corrSym);

  const cached = getCached(key);
  if (cached) { res.json(cached); return; }

  try {
    const [candles, dailyCandles, correlatedCandles] = await Promise.all([
      fetchBinanceCandles(symbol, tf),
      fetchBinanceDailyCandles(symbol),
      corrSym ? fetchBinanceCandles(corrSym, tf) : Promise.resolve(undefined),
    ]);

    const report = buildReport(candles, symbol, "crypto", tf, {
      dailyCandles,
      correlatedCandles: correlatedCandles ?? undefined,
      primarySymbol: symbol,
      correlatedSymbol: corrSym,
    });

    setCached(key, report);
    res.json(report);
  } catch (err) {
    req.log.error({ err, symbol }, "Failed to fetch crypto analysis — trying candle store fallback");
    // Fallback: use candle store when external API fails
    const storeCandles = getCandlesFromStore(symbol, tf);
    if (storeCandles) {
      try {
        const storeDaily = getCandlesFromStore(symbol, "1d", 10);
        const report = buildReport(storeCandles, symbol, "crypto", tf, {
          dailyCandles: storeDaily ?? undefined,
        });
        setCached(key, report);
        res.json(report);
        return;
      } catch (fallbackErr) {
        req.log.error({ err: fallbackErr, symbol }, "Candle store fallback also failed for crypto");
      }
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: `Failed to analyze ${symbol}: ${message}` });
  }
});

// ── Forex analysis ───────────────────────────────────────────────────────────

router.get("/analysis/forex", async (req, res): Promise<void> => {
  const symbol = Array.isArray(req.query.symbol) ? req.query.symbol[0] : req.query.symbol;
  const timeframe = Array.isArray(req.query.timeframe)
    ? req.query.timeframe[0]
    : (req.query.timeframe ?? "4h");
  const correlatedSymbol = Array.isArray(req.query.correlatedSymbol)
    ? req.query.correlatedSymbol[0]
    : req.query.correlatedSymbol;

  if (!symbol || typeof symbol !== "string") {
    res.status(400).json({ error: "symbol query param is required" });
    return;
  }

  const tf      = typeof timeframe          === "string" ? timeframe          : "4h";
  const corrSym = typeof correlatedSymbol   === "string" ? correlatedSymbol   : undefined;
  const key     = cacheKey("forex", symbol, tf, corrSym);

  const cached = getCached(key);
  if (cached) { res.json(cached); return; }

  try {
    const [candles, dailyCandles, correlatedCandles] = await Promise.all([
      fetchYahooCandles(symbol, tf),
      fetchYahooDailyCandles(symbol),
      corrSym ? fetchYahooCandles(corrSym, tf) : Promise.resolve(undefined),
    ]);

    const report = buildReport(candles, symbol, "forex", tf, {
      dailyCandles,
      correlatedCandles: correlatedCandles ?? undefined,
      primarySymbol: symbol,
      correlatedSymbol: corrSym,
    });

    setCached(key, report);
    res.json(report);
  } catch (err) {
    req.log.error({ err, symbol }, "Failed to fetch forex analysis — trying candle store fallback");
    // Fallback: use candle store when external API fails
    const storeCandles = getCandlesFromStore(symbol, tf);
    if (storeCandles) {
      try {
        const storeDaily = getCandlesFromStore(symbol, "1d", 10);
        const report = buildReport(storeCandles, symbol, "forex", tf, {
          dailyCandles: storeDaily ?? undefined,
        });
        setCached(key, report);
        res.json(report);
        return;
      } catch (fallbackErr) {
        req.log.error({ err: fallbackErr, symbol }, "Candle store fallback also failed for forex");
      }
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: `Failed to analyze ${symbol}: ${message}` });
  }
});

/**
 * Update (or create) a cached analysis report. Used by the real-time pipeline
 * to pre-warm the cache when a candle closes, so the next REST poll returns
 * the fresh SMC report without hitting Yahoo Finance.
 */
export function updateCachedReport(
  market: "crypto" | "forex",
  symbol: string,
  timeframe: string,
  correlatedSymbol: string | undefined,
  report: unknown,
): void {
  const key = cacheKey(market, symbol, timeframe, correlatedSymbol);
  setCached(key, report);
}

// ══════════════════════════════════════════════════════════════════════════
// TV Desktop Bar Reader & Analysis Endpoints
// ══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/analysis/from-bars — Run SMC analysis on externally-provided bars.
 *
 * The agent reads bars from TV Desktop via CDP, then POSTs them here to get
 * a full SMC report. This bridges the gap when the internal data pipeline
 * is unreachable but TV Desktop has live chart data.
 */
router.post("/analysis/from-bars", async (req, res): Promise<void> => {
  const { symbol, market, timeframe, candles, correlatedCandles } = req.body as {
    symbol: string;
    market: "crypto" | "forex";
    timeframe: string;
    candles: Array<{ time: number; open: number; high: number; low: number; close: number; volume?: number }>;
    correlatedCandles?: Array<{ time: number; open: number; high: number; low: number; close: number; volume?: number }>;
  };

  if (!symbol || !market || !timeframe || !candles || !Array.isArray(candles)) {
    res.status(400).json({ error: "symbol, market, timeframe, and candles[] are required" });
    return;
  }
  if (candles.length < 10) {
    res.status(400).json({ error: `Only ${candles.length} candles provided — need at least 10` });
    return;
  }

  try {
    // Normalize volume (can be undefined from external sources)
    const normalized: Candle[] = candles.map(c => ({ ...c, volume: c.volume ?? 0 }));
    const normalizedCorrelated: Candle[] | undefined = correlatedCandles?.map(c => ({ ...c, volume: c.volume ?? 0 }));
    const report = buildReport(normalized, symbol, market, timeframe, {
      correlatedCandles: normalizedCorrelated,
      primarySymbol: symbol,
    });
    try { candleStore.seedCandles(symbol, timeframe, normalized); } catch { /* ok */ }
    setCached(cacheKey(market, symbol, timeframe), report);
    res.json(report);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    req.log.error({ err, symbol, timeframe }, "from-bars analysis failed");
    res.status(500).json({ error: `Analysis failed: ${message}` });
  }
});

/**
 * GET /api/analysis/from-tv — Read bars from TV Desktop and run SMC analysis.
 *
 * One-call convenience that switches TV to requested symbol/timeframe,
 * reads 500 bars, runs full SMC report, seeds the candle store so
 * subsequent tool calls work too.
 */
router.get("/analysis/from-tv", async (req, res): Promise<void> => {
  const symbol = (Array.isArray(req.query.symbol) ? req.query.symbol[0] : req.query.symbol) as string | undefined;
  const timeframe = (Array.isArray(req.query.timeframe) ? req.query.timeframe[0] : req.query.timeframe ?? "15m") as string;
  if (!symbol) { res.status(400).json({ error: "symbol query param is required" }); return; }

  const market = symbol.includes("=X") ? "forex" : "crypto";
  const tf = typeof timeframe === "string" ? timeframe : "15m";

  try {
    const CDP = (await import("chrome-remote-interface")).default;
    const targets = await fetch("http://127.0.0.1:9222/json/list").then(r => r.json());
    const target = targets.find((t: any) => t.type === "page" && /tradingview\.com\/chart/i.test(t.url));
    if (!target) { res.status(503).json({ error: "No TradingView chart page found" }); return; }

    const client = await CDP({ host: "127.0.0.1", port: 9222, target: target.id });
    await client.Runtime.enable();
    const E = async (expr: string) => {
      const r = await client.Runtime.evaluate({ expression: expr, returnByValue: true, awaitPromise: true });
      return r.result.value;
    };

    // Switch TV chart to requested symbol/timeframe
    const tvTfMap: Record<string, string> = {"1m":"1","5m":"5","15m":"15","1h":"60","4h":"240","1d":"1D","1w":"1W"};
    const tvTf = tvTfMap[tf] || tf.slice(0, -1).toUpperCase();
    await E(`window.TradingViewApi._activeChartWidgetWV.value().setSymbol(${JSON.stringify(symbol)}, {})`);
    await new Promise(r => setTimeout(r, 2000));
    await E(`window.TradingViewApi._activeChartWidgetWV.value().setResolution(${JSON.stringify(tvTf)}, {})`);
    await new Promise(r => setTimeout(r, 2000));

    // Read bars from TV chart model
    const rawBars = await E(`
      (function() {
        var bars = window.TradingViewApi._activeChartWidgetWV.value()._chartWidget.model().mainSeries().bars();
        if (!bars || typeof bars.lastIndex !== 'function') return null;
        var result = []; var end = bars.lastIndex(); var start = Math.max(bars.firstIndex(), end - 499);
        for (var i = start; i <= end; i++) { var v = bars.valueAt(i); if (v) result.push({ time: v[0], open: v[1], high: v[2], low: v[3], close: v[4], volume: v[5] || 0 }); }
        return JSON.stringify(result);
      })()
    `);
    const candles = rawBars ? JSON.parse(rawBars) : [];
    await client.close();

    if (!candles || candles.length < 10) {
      res.status(503).json({ error: `TV Desktop returned only ${candles?.length || 0} candles` });
      return;
    }

    // Run SMC analysis on TV-sourced bars + seed candle store
    const report = buildReport(candles, symbol, market, tf);
    try { candleStore.seedCandles(symbol, tf, candles); } catch { /* ok */ }
    setCached(cacheKey(market, symbol, tf), report);

    res.json({ _source: "tradingview_desktop", candleCount: candles.length, ...report });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    req.log.error({ err, symbol, tf }, "from-tv analysis failed");
    res.status(500).json({ error: `TV Desktop analysis failed: ${message}` });
  }
});

export default router;
