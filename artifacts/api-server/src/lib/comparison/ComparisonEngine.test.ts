/**
 * Tests for the Comparison Engine — Phase 2
 *
 * Run with:
 *   npx tsx artifacts/api-server/src/lib/comparison/ComparisonEngine.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { extractEngineDetections, compareDetections, calculateComparisonMetrics } from "./ComparisonEngine.js";
import type { DetectionPoint } from "./ComparisonEngine.js";

// ─── Sample engine report factory ─────────────────────────────────────────

function makeEngineReport(overrides: Record<string, any> = {}) {
  return {
    structure: {
      bias: "bullish",
      trend: "bullish",
      confidence: 0.82,
      pivots: [],
      breaks: [{ index: 15, price: 1.1080, type: "BOS", direction: "bullish", time: 1500000 }],
      phase: "expansion",
      narrative: "",
      evidence: [],
    },
    liquidity: {
      pools: [],
      nearestBSL: { price: 1.1150, type: "BSL", score: 0.85, touches: 3, wasSwept: false, sweptAt: null, time: 3000000, index: 30, session: "london", probabilityOfSweep: 0.72 },
      nearestSSL: { price: 1.0950, type: "SSL", score: 0.72, touches: 2, wasSwept: false, sweptAt: null, time: 500000, index: 5, session: "asia", probabilityOfSweep: 0.45 },
    },
    orderBlocks: [
      { type: "bullish", proximal: 1.1020, distal: 1.1000, time: 1200000, index: 12, valid: true, isMitigated: false, isBreaker: false, strength: 0.75, hasFvg: true, confidence: 0.85, confidenceFactors: ["FVG confluence"] },
    ],
    fvg: [
      { type: "bullish", top: 1.1030, bottom: 1.1015, time: 1300000, index: 13, fillFraction: 0.1, isInversion: false },
    ],
    pdArray: { currentBias: "discount", zones: [], dealingRange: { high: 1.1150, low: 1.0950, timeframe: "1h" }, equilibrium: 1.1050 },
    dailyBias: { bias: "bullish", strength: 0.72, consecutiveDays: 3, referencedSwing: null, evidence: [] },
    smt: { detected: true, type: "bullish_smt", confidence: 0.74, time: 1800000, primarySymbol: "EURUSD", correlatedSymbol: "GBPUSD" },
    draw: [],
    ...overrides,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────

describe("ComparisonEngine", () => {
  describe("extractEngineDetections", () => {
    it("extracts all detection types from a full report", () => {
      const report = makeEngineReport() as any;
      const detections = extractEngineDetections(report);
      // BIAS + OB (1) + FVG (1) + LIQUIDITY_SWEEP (2) + BOS (1) + SMT (1) + DISCOUNT (1)
      assert.equal(detections.length, 8);
      const types = detections.map(d => d.detectionType);
      assert.ok(types.includes("BIAS"));
      assert.ok(types.includes("OB"));
      assert.ok(types.includes("FVG"));
      assert.ok(types.includes("BOS"));
      assert.ok(types.includes("SMT"));
    });

    it("returns empty for neutral report with no detections", () => {
      const report = makeEngineReport({
        structure: { bias: "neutral", trend: "ranging", confidence: 0, pivots: [], breaks: [], phase: "unknown", narrative: "", evidence: [] },
        liquidity: { pools: [], nearestBSL: null, nearestSSL: null },
        orderBlocks: [],
        fvg: [],
        pdArray: { currentBias: "equilibrium", zones: [], dealingRange: { high: 0, low: 0, timeframe: "" }, equilibrium: 0 },
        dailyBias: { bias: "neutral", strength: 0, consecutiveDays: 0, referencedSwing: null, evidence: [] },
        smt: { detected: false, type: null, confidence: 0, time: null, primarySymbol: "", correlatedSymbol: null },
        draw: [],
      }) as any;
      assert.equal(extractEngineDetections(report).length, 0);
    });
  });

  describe("compareDetections", () => {
    it("marks BOTH_DETECTED when TV and Engine agree on price", () => {
      const engine: DetectionPoint[] = [{ detectionType: "OB", price: 1.1020, confidence: 0.85, metadata: {} }];
      const tv: DetectionPoint[] = [{ detectionType: "OB", price: 1.1025, confidence: 0.90, metadata: {} }];
      const records = compareDetections("EURUSD", "1h", "forex", tv, engine, new Date());
      assert.equal(records.length, 1);
      assert.equal(records[0].agreement, "BOTH_DETECTED");
      assert.ok(records[0].priceDiscrepancyPct !== null);
    });

    it("marks TV_ONLY when engine misses a detection", () => {
      const records = compareDetections("EURUSD", "1h", "forex",
        [{ detectionType: "FVG", price: 1.1080, confidence: 0.8, metadata: {} }],
        [],
        new Date());
      assert.equal(records.length, 1);
      assert.equal(records[0].agreement, "TV_ONLY");
    });

    it("marks ENGINE_ONLY when TV misses a detection", () => {
      const records = compareDetections("EURUSD", "1h", "forex", [],
        [{ detectionType: "SMT", price: 0, confidence: 0.74, metadata: {} }],
        new Date());
      assert.equal(records.length, 1);
      assert.equal(records[0].agreement, "ENGINE_ONLY");
    });

    it("returns empty when both arrays are empty", () => {
      assert.equal(compareDetections("EURUSD", "1h", "forex", [], [], new Date()).length, 0);
    });
  });

  describe("calculateComparisonMetrics", () => {
    it("returns zero metrics for empty input", () => {
      const m = calculateComparisonMetrics([]);
      assert.equal(m.total, 0);
      assert.equal(m.agreementRate, 0);
    });

    it("computes correct agreement rate", () => {
      const base = { symbol: "EURUSD", timeframe: "1h", market: "forex", priceLevel: 0,
        tv: { detected: true, confidence: null, price: null, metadata: {} },
        engine: { detected: true, confidence: null, price: null, metadata: {} },
        priceDiscrepancyPct: null, confidenceGap: null, candleTime: new Date(), signalId: null };

      const metrics = calculateComparisonMetrics([
        { ...base, detectionType: "OB", agreement: "BOTH_DETECTED" } as any,
        { ...base, detectionType: "FVG", agreement: "TV_ONLY" } as any,
        { ...base, detectionType: "SMT", agreement: "ENGINE_ONLY" } as any,
      ]);

      assert.equal(metrics.total, 3);
      assert.equal(metrics.bothDetected, 1);
      assert.equal(metrics.tvOnly, 1);
      assert.equal(metrics.engineOnly, 1);
      assert.ok(metrics.agreementRate > 0);
    });
  });
});
