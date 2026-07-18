/**
 * Strategy Routes — list registered strategies and run multi-TF detection.
 *
 * GET  /api/strategies       → list all registered strategies with metadata.
 * POST /api/strategies/detect → run detectAll across a multi-TF report set.
 *
 * The detect endpoint fetches OHLCV for the configured timeframes, builds
 * full SMC reports via buildReport, then evaluates every registered strategy
 * against the report map. Results are returned sorted by match status and score.
 *
 * Follows the same conventions as analysis.ts (fetchers, error handling, cache).
 */

import { Router, type IRouter } from "express";
import { StrategyRegistry } from "@workspace/api-zod/strategies";
import type { DetectionResult } from "@workspace/api-zod/strategies";
import { fetchBinanceCandles } from "../lib/fetchers/binance.js";
import { fetchYahooCandles } from "../lib/fetchers/yahoo.js";
import { buildReport } from "../lib/smc/report.js";
import type { SmcReport } from "../lib/smc/types.js";
import { generateNarrative } from "../lib/narrative/generate-narrative.js";
import { evaluateSetup } from "../lib/agents/reasoning-agent.js";
import type { StrategyDetectionSummary } from "../lib/narrative/generate-narrative.js";
import { logger } from "../lib/logger.js";

// ─── Config ──────────────────────────────────────────────────────────────────

/** Default cascade timeframes used when the client omits the `timeframes` param. */
const DEFAULT_TIMEFRAMES = ["15m", "1h", "4h", "1d"];

/** Minimum candles required to produce a meaningful report. */
const MIN_CANDLES = 10;

// ─── Router ──────────────────────────────────────────────────────────────────

const router: IRouter = Router();

// ── Shared registry instance (lazy) ───────────────────────────────────────────

let _registry: StrategyRegistry | null = null;

function getRegistry(): StrategyRegistry {
  if (!_registry) {
    _registry = new StrategyRegistry();
    logger.info({ count: _registry.list().length }, "StrategyRegistry initialised");
  }
  return _registry;
}

// ─── Market helpers ──────────────────────────────────────────────────────────

function detectMarket(symbol: string): "crypto" | "forex" {
  return symbol.includes("=X") ? "forex" : "crypto";
}

function isForex(market: string): boolean {
  return market === "forex";
}

/**
 * Fetch candles for a single timeframe, returning null on failure.
 */
async function tryFetchCandles(
  symbol: string,
  timeframe: string,
  market: "crypto" | "forex",
): Promise<{ time: number; open: number; high: number; low: number; close: number; volume: number }[] | null> {
  try {
    const candles = isForex(market)
      ? await fetchYahooCandles(symbol, timeframe)
      : await fetchBinanceCandles(symbol, timeframe);
    if (candles.length >= MIN_CANDLES) return candles;
    logger.warn({ symbol, timeframe, count: candles.length }, "Too few candles fetched");
    return null;
  } catch (err) {
    logger.warn({ err, symbol, timeframe }, "Failed to fetch candles");
    return null;
  }
}

// ─── GET /api/strategies — list registry ─────────────────────────────────────

router.get("/strategies", (_req, res) => {
  const registry = getRegistry();
  const list = registry.list();
  res.json({
    count: list.length,
    strategies: list,
  });
});

// ─── POST /api/strategies/detect — run detection ────────────────────────────

router.post("/strategies/detect", async (req, res): Promise<void> => {
  const { symbol, market: rawMarket, timeframes: rawTimeframes } = req.body as {
    symbol?: string;
    market?: string;
    timeframes?: string[];
  };

  // Gate the optional narrative + reasoning pipeline behind ?reason=true
  const includeReason = req.query.reason === "true";

  if (!symbol || typeof symbol !== "string") {
    res.status(400).json({ error: "symbol is required" });
    return;
  }

  const sym = symbol.toUpperCase();
  const market = (rawMarket ?? detectMarket(sym)) as "crypto" | "forex";
  const timeframes = Array.isArray(rawTimeframes) && rawTimeframes.length > 0
    ? rawTimeframes
    : DEFAULT_TIMEFRAMES;

  // 1. Fetch candles for all timeframes in parallel
  const tfResults = await Promise.all(
    timeframes.map(async (tf) => {
      const candles = await tryFetchCandles(sym, tf, market);
      return { tf, candles };
    }),
  );

  const available = tfResults.filter((r) => r.candles !== null) as Array<{
    tf: string;
    candles: NonNullable<Awaited<ReturnType<typeof tryFetchCandles>>>;
  }>;

  if (available.length === 0) {
    res.status(503).json({
      error: "Could not fetch candle data for any timeframe",
      symbol: sym,
      market,
      attempted: timeframes,
    });
    return;
  }

  // 2. Build SMC reports for each available timeframe
  type RawCandle = { time: number; open: number; high: number; low: number; close: number; volume: number };
  const reports = new Map<string, RawCandle[]>();

  for (const { tf, candles } of available) {
    reports.set(tf, candles);
  }

  // Build reports via buildReport, storing results in a timeframe-keyed map
  const reportMap = new Map<string, unknown>();

  for (const { tf, candles } of available) {
    try {
      const report = buildReport(candles, sym, market, tf);
      reportMap.set(tf, report);
    } catch (err) {
      logger.warn({ err, symbol: sym, timeframe: tf }, "buildReport failed for timeframe — skipping");
    }
  }

  if (reportMap.size === 0) {
    res.status(503).json({
      error: "SMC analysis failed for all available timeframes",
      symbol: sym,
      market,
    });
    return;
  }

  // 3. Run strategy detection
  const registry = getRegistry();
  const results = registry.detectAll(reportMap as Map<string, any>, "4h");

  // 4. Sort: matched first (desc score), then failed, then error
  const orderMap: Record<string, number> = { matched: 0, failed: 1, error: 2 };
  const ranked: Array<DetectionResult & { rank: number }> = [...results.values()]
    .sort((a, b) => {
      const ao = orderMap[a.status] ?? 3;
      const bo = orderMap[b.status] ?? 3;
      if (ao !== bo) return ao - bo;
      // Within same status: higher score first (null scores sort last)
      const sa = a.score ?? -1;
      const sb = b.score ?? -1;
      if (sa !== sb) return sb - sa;
      return a.strategyId.localeCompare(b.strategyId);
    })
    .map((r, i) => ({ ...r, rank: i + 1 }));

  // 5. Build response
  const response: Record<string, unknown> = {
    symbol: sym,
    market,
    timeframes: [...reportMap.keys()],
    totalStrategies: results.size,
    matched: ranked.filter((r) => r.status === "matched").length,
    failed: ranked.filter((r) => r.status === "failed").length,
    errors: ranked.filter((r) => r.status === "error").length,
    results: ranked,
  };

  // 6. Optional narrative + reasoning (gated behind ?reason=true)
  if (includeReason) {
    try {
      const matchedStrategies: StrategyDetectionSummary[] = ranked
        .filter((r) => r.status === "matched")
        .map((r) => ({
          strategyId: r.strategyId,
          strategyName: r.strategyName,
          score: r.score ?? 0,
          evidence: r.evidence,
        }));

      const narrative = generateNarrative({
        detectedStrategies: matchedStrategies,
        reportMap: reportMap as Map<string, SmcReport>,
      });

      const reasoning = await evaluateSetup(narrative, matchedStrategies, {
        maxRiskPerTrade: 0.01,
        minRR: 2,
        riskTolerance: "moderate",
        executionMode: "REVIEW",
      });

      response.narrative = narrative;
      response.reasoning = reasoning;
    } catch (err) {
      logger.warn({ err }, "Narrative/reasoning generation failed — omitting from response");
      response.narrative = undefined;
      response.reasoning = undefined;
    }
  }

  res.json(response);
});

export default router;
