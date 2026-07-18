/**
 * SMC-EVAL Evaluation Routes — benchmark AI reasoning against ground truth.
 *
 * POST /api/smc-eval/evaluate  — Run full SMC-EVAL pipeline against a scenario
 * POST /api/smc-eval/score     — Score AI reasoning against ground truth directly
 * GET  /api/smc-eval/scenarios — List available benchmark scenarios
 *
 * Follows the same conventions as strategies.ts (fetchers, buildReport, registry).
 */

import { Router, type IRouter } from "express";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { StrategyRegistry } from "@workspace/api-zod/strategies";
import type { OntologyCategory } from "@workspace/api-zod/strategies";
import { computeSmcEvalScore, classifyModelMatch } from "@workspace/api-zod/strategies";
import { fetchBinanceCandles } from "../lib/fetchers/binance.js";
import { fetchYahooCandles } from "../lib/fetchers/yahoo.js";
import { buildReport } from "../lib/smc/report.js";
import { generateNarrative } from "../lib/narrative/generate-narrative.js";
import { evaluateSetup } from "../lib/agents/reasoning-agent.js";
import { logger } from "../lib/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SCENARIOS_DIR = join(__dirname, "..", "..", "..", "..", "data", "smc-eval", "scenarios");

// ─── Router ──────────────────────────────────────────────────────────────────

const router: IRouter = Router();

// ── Shared registry instance ─────────────────────────────────────────────────

let _registry: StrategyRegistry | null = null;

function getRegistry(): StrategyRegistry {
  if (!_registry) {
    _registry = new StrategyRegistry();
  }
  return _registry;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function detectMarket(symbol: string): "crypto" | "forex" {
  return symbol.includes("=X") ? "forex" : "crypto";
}

function loadScenario(scenarioId: string): Record<string, unknown> | null {
  try {
    const path = join(SCENARIOS_DIR, `${scenarioId}.json`);
    const content = readFileSync(path, "utf8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function listScenarioIds(): string[] {
  try {
    return readdirSync(SCENARIOS_DIR)
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(/\.json$/, ""));
  } catch {
    return [];
  }
}

// ─── POST /api/smc-eval/evaluate — Full pipeline ────────────────────────────

router.post("/smc-eval/evaluate", async (req, res): Promise<void> => {
  const { scenarioId, symbol, timeframes, aiInput } = req.body as {
    scenarioId?: string;
    symbol?: string;
    timeframes?: string[];
    aiInput?: {
      modelId: string;
      modelName: string;
      reasoning: string;
      confidenceScore: number;
      entry: string;
      stop: string;
      target: string;
      rr: number | null;
      invalidation: string;
      detectedModelIds: string[];
    };
  };

  // ── Shared state for symbol path ────────────────────────────
  let groundTruth: any;

  // ── Scenario path ─────────────────────────────────────────────
  if (scenarioId) {
    const scenario = loadScenario(scenarioId);
    if (!scenario) {
      res.status(404).json({ error: `Scenario "${scenarioId}" not found. Available: ${listScenarioIds().join(", ")}` });
      return;
    }
    const groundTruth = (scenario as any).groundTruth;
    const allModelIds = getRegistry().list().map((s) => s.id);
    const detectedEvents = groundTruth.structure.events;
    const aiModels = aiInput?.detectedModelIds?.map((id: string) => ({
      id, name: id, ontology: "EXECUTION_MODEL" as OntologyCategory, confidence: 0,
    })) ?? [];

    const scores = computeSmcEvalScore({
      groundTruth, detectedEvents, aiModels,
      aiInput: aiInput ? { modelId: aiInput.modelId, modelName: aiInput.modelName, reasoning: aiInput.reasoning, confidenceScore: aiInput.confidenceScore } : undefined,
      reasoningText: aiInput?.reasoning ?? "",
      aiEntry: aiInput?.entry ?? "", aiStop: aiInput?.stop ?? "", aiTarget: aiInput?.target ?? "",
      aiRR: aiInput?.rr ?? null, aiInvalidation: aiInput?.invalidation ?? "", allModelIds,
    });
    const { classification: modelClassification, failureFlags } = classifyModelMatch(
      aiInput?.detectedModelIds ?? [], groundTruth,
    );
    res.json({ scenarioId, groundTruth, scores, modelClassification, failureFlags });
    return;
  }

  // ── Live symbol path ──────────────────────────────────────────
  if (!symbol) {
    res.status(400).json({ error: "Either scenarioId or symbol is required" });
    return;
  }

  const market: "crypto" | "forex" = detectMarket(symbol);
  const sym = symbol.toUpperCase();
  const tfs = timeframes ?? ["5m", "1h", "4h"];

    // Build SMC reports
    const reportMap = new Map<string, any>();
    for (const tf of tfs) {
      try {
        const candles = market === "forex"
          ? await fetchYahooCandles(sym, tf)
          : await fetchBinanceCandles(sym, tf);
        if (candles.length >= 10) {
          const report = buildReport(candles, sym, market, tf);
          reportMap.set(tf, report);
        }
      } catch { /* skip timeframe */ }
    }

    if (reportMap.size === 0) {
      res.status(503).json({ error: "Could not fetch candle data for any timeframe" });
      return;
    }

    // Run strategy detection
    const registry = getRegistry();
    const results = registry.detectAll(reportMap, { defaultTf: "4h" });
    const matched = [...results.values()].filter((r) => r.status === "matched");

    // Generate narrative
    const narrative = generateNarrative({
      detectedStrategies: matched.map((r) => ({
        strategyId: r.strategyId,
        strategyName: r.strategyName ?? r.strategyId,
        score: r.score ?? 0,
        evidence: r.evidence,
      })),
      reportMap: reportMap as Map<string, any>,
    });

    // Build a dynamic ground truth from the SMC analysis
    const primaryReport = reportMap.get("4h") ?? [...reportMap.values()][0];
    groundTruth = {
      scenarioId: `live-${sym}-${Date.now()}`,
      market: { asset: sym, timestamp: new Date().toISOString() },
      structure: {
        direction: primaryReport.structure.bias === "bullish" ? "BULLISH" :
                    primaryReport.structure.bias === "bearish" ? "BEARISH" : "RANGE",
        events: [
          ...primaryReport.structure.breaks.slice(-3).map((b: any) => ({
            type: b.type, timeframe: primaryReport.timeframe, direction: b.direction,
          })),
          ...primaryReport.fvg.slice(0, 2).map((f: any) => ({
            type: "FVG", timeframe: primaryReport.timeframe, direction: f.type,
          })),
        ],
      },
      liquidity: {
        swept: primaryReport.liquidity.pools.some((p: any) => p.wasSwept) ? "detected" : undefined,
        remaining: [
          ...(primaryReport.liquidity.nearestBSL ? [{ type: "BSL", price: primaryReport.liquidity.nearestBSL.price }] : []),
          ...(primaryReport.liquidity.nearestSSL ? [{ type: "SSL", price: primaryReport.liquidity.nearestSSL.price }] : []),
        ],
      },
      concepts: ["fvg", "bos", "mss", "liquidity"],
      models: {
        primary: matched[0] ? { id: matched[0].strategyId, name: matched[0].strategyName, ontology: "EXECUTION_MODEL" as OntologyCategory, confidence: matched[0].score ?? 0 } : null,
        alternatives: matched.slice(1, 3).map((m) => ({ id: m.strategyId, name: m.strategyName, ontology: "EXECUTION_MODEL" as OntologyCategory, confidence: m.score ?? 0 })),
        rejected: [],
      },
      timeframeAlignment: [],
      evaluation: {
        evaluator: "DETERMINISTIC",
        version: "1.0",
        timestamp: new Date().toISOString(),
        scenarioId: groundTruth?.scenarioId ?? `live-${sym}`,
      },
    };

    // Attach narrative + AI reasoning to response
    if (aiInput) {
      try {
        const reasoning = await evaluateSetup(
          narrative,
          matched.map((r) => ({
            strategyId: r.strategyId,
            strategyName: r.strategyName ?? r.strategyId,
            score: r.score ?? 0,
            evidence: r.evidence,
          })),
          { maxRiskPerTrade: 0.01, minRR: 2, riskTolerance: "moderate", executionMode: "REVIEW" },
        );
        (res as any).locals.smcEvalNarrative = narrative;
        (res as any).locals.smcEvalReasoning = reasoning;
      } catch { /* reasoning optional */ }
    }

    // Scoring
    const allModelIds = registry.list().map((s) => s.id);
    const detectedEvents = groundTruth.structure.events;
    const aiModels = aiInput?.detectedModelIds?.map((id) => ({
      id, name: id, ontology: "EXECUTION_MODEL" as OntologyCategory, confidence: 0,
    })) ?? [];

    const scores = computeSmcEvalScore({
      groundTruth,
      detectedEvents,
      aiModels,
      aiInput: aiInput ? { modelId: aiInput.modelId, modelName: aiInput.modelName, reasoning: aiInput.reasoning, confidenceScore: aiInput.confidenceScore } : undefined,
      reasoningText: aiInput?.reasoning ?? narrative,
      aiEntry: aiInput?.entry ?? "",
      aiStop: aiInput?.stop ?? "",
      aiTarget: aiInput?.target ?? "",
      aiRR: aiInput?.rr ?? null,
      aiInvalidation: aiInput?.invalidation ?? "",
      allModelIds,
    });

    const { classification, failureFlags } = classifyModelMatch(
      aiInput?.detectedModelIds ?? matched.map((m) => m.strategyId),
      groundTruth,
    );

    res.json({
      scenarioId: groundTruth.scenarioId,
      groundTruth,
      scores,
      modelClassification: classification,
      failureFlags,
      narrative: (res as any).locals.smcEvalNarrative,
      reasoning: (res as any).locals.smcEvalReasoning,
      matchedStrategies: matched.map((r) => ({ id: r.strategyId, name: r.strategyName, score: r.score })),
    });
    return;
}
);

// ─── POST /api/smc-eval/score — Score AI reasoning against ground truth ─────

router.post("/smc-eval/score", async (req, res): Promise<void> => {
  const { scenarioId, reasoning, modelIds, entry, stop, target, rr, invalidation } = req.body as {
    scenarioId: string;
    reasoning: string;
    modelIds: string[];
    entry?: string;
    stop?: string;
    target?: string;
    rr?: number;
    invalidation?: string;
  };

  if (!scenarioId || !reasoning) {
    res.status(400).json({ error: "scenarioId and reasoning are required" });
    return;
  }

  const scenario = loadScenario(scenarioId);
  if (!scenario) {
    res.status(404).json({ error: `Scenario "${scenarioId}" not found` });
    return;
  }

  const groundTruth = (scenario as any).groundTruth;
  const allModelIds = getRegistry().list().map((s) => s.id);
  const aiModels = modelIds.map((id) => ({
    id, name: id, ontology: "EXECUTION_MODEL" as OntologyCategory, confidence: 0,
  }));

  const scores = computeSmcEvalScore({
    groundTruth,
    detectedEvents: groundTruth.structure.events,
    aiModels,
    reasoningText: reasoning,
    aiEntry: entry ?? "",
    aiStop: stop ?? "",
    aiTarget: target ?? "",
    aiRR: rr ?? null,
    aiInvalidation: invalidation ?? "",
    allModelIds,
  });

  const { classification, failureFlags } = classifyModelMatch(modelIds, groundTruth);

  res.json({
    scenarioId,
    scores,
    modelClassification: classification,
    failureFlags,
    groundTruth,
  });
});

// ─── GET /api/smc-eval/scenarios — List available scenarios ─────────────────

router.get("/smc-eval/scenarios", (_req, res) => {
  const ids = listScenarioIds();
  const scenarios = ids
    .map((id) => {
      const s = loadScenario(id);
      if (!s) return null;
      return {
        id,
        asset: (s as any).asset,
        market: (s as any).market,
        session: (s as any).session,
        primaryModel: (s as any).groundTruth?.models?.primary?.id,
      };
    })
    .filter(Boolean);

  res.json({ count: scenarios.length, scenarios });
});

export default router;
