/**
 * Tests for StrategyRegistry — loads built-in templates, runs detectAll
 * against fixture report sets, and verifies which models match.
 *
 * Since hasEqualHighsLows, hasDisplacement, hasLiquiditySweep, hasBreakerBlock,
 * hasSessionAlignment, hasRangeExpansion, hasWeeklyExpansionContext are not yet
 * implemented, some templates use proxy predicates so they can partially
 * evaluate. Model 5 (Five Box) relies on hasBias + hasConsolidationZone + hasMSS.
 */

import { describe, it, expect } from "vitest";
import type { SmcReport } from "../generated/types";
import { StrategyRegistry } from "./registry";

// ─── Fixture factories ───────────────────────────────────────────────────────

function baseReport(overrides?: Partial<SmcReport>): SmcReport {
  return {
    symbol: "BTCUSDT",
    market: "crypto",
    timeframe: "4h",
    currentPrice: 65000,
    generatedAt: Date.now(),
    candles: [],
    structure: {
      trend: "bullish",
      bias: "bullish",
      confidence: 0.82,
      pivots: [],
      breaks: [],
    },
    liquidity: { pools: [], nearestBSL: null, nearestSSL: null },
    orderBlocks: [],
    fvg: [],
    pdArray: {
      currentBias: "discount",
      zones: [],
      dealingRange: { high: 66000, low: 62000, timeframe: "1d" },
      equilibrium: 64000,
    },
    dailyBias: { bias: "bullish", strength: 0.7, consecutiveDays: 4 },
    draw: [],
    ...overrides,
  };
}

// ─── Fixture set A: strong bullish trend (models 1–4 should match) ───────────

/**
 * 4h — bullish bias, OBs, FVGs, liquidity, and multiple BOS/CHoCH breaks.
 */
const htfBullish: SmcReport = baseReport({
  timeframe: "4h",
  structure: {
    trend: "bullish",
    bias: "bullish",
    confidence: 0.85,
    pivots: [],
    breaks: [
      { index: 40, price: 63500, type: "BOS", direction: "bullish", time: 1000 },
      { index: 55, price: 64800, type: "CHoCH", direction: "bullish", time: 1001 },
    ],
  },
  liquidity: {
    pools: [
      { price: 64500, type: "BSL", score: 0.8, touches: 2, wasSwept: false, time: 1, index: 10 },
    ],
    nearestBSL: { price: 64500, type: "BSL", score: 0.8, touches: 2, wasSwept: false, time: 1, index: 10 },
    nearestSSL: null,
  },
  orderBlocks: [
    { type: "bullish", proximal: 64800, distal: 64500, time: 3, index: 12, valid: true, isMitigated: false, strength: 0.7, hasFvg: true },
  ],
  fvg: [
    { type: "bullish", top: 64700, bottom: 64550, time: 5, index: 13, fillFraction: 0.2 },
  ],
});

/**
 * 5m — entry timeframe with MSS, FVG, inducement zone, and price in OTE.
 *   Dealing range: 62000–66000 → Bullish OTE = 64480–65160, price 64850 ∈ OTE ✓
 */
const ltfBullish: SmcReport = baseReport({
  timeframe: "5m",
  currentPrice: 64850,
  structure: {
    trend: "bullish",
    bias: "bullish",
    confidence: 0.78,
    pivots: [
      { index: 10, price: 64300, type: "HH", confirmed: true, time: 10 },
      { index: 15, price: 64600, type: "HH", confirmed: true, time: 15 },
      { index: 20, price: 64500, type: "LH", confirmed: true, time: 20 }, // inducement
      { index: 25, price: 64900, type: "HH", confirmed: true, time: 25 },
    ],
    breaks: [
      { index: 22, price: 64400, type: "BOS", direction: "bullish", time: 1002 },
    ],
  },
  liquidity: {
    pools: [
      { price: 64600, type: "BSL", score: 0.6, touches: 1, wasSwept: false, time: 7, index: 26 },
    ],
    nearestBSL: { price: 64600, type: "BSL", score: 0.6, touches: 1, wasSwept: false, time: 7, index: 26 },
    nearestSSL: null,
  },
  fvg: [
    { type: "bullish", top: 64750, bottom: 64600, time: 23, index: 23, fillFraction: 0.15 },
  ],
  pdArray: {
    currentBias: "discount",
    zones: [],
    dealingRange: { high: 66000, low: 62000, timeframe: "1d" },
    equilibrium: 64000,
  },
});

/**
 * 15m — bullish, has MSS, good for charter/intraday models.
 */
const tf15m: SmcReport = baseReport({
  timeframe: "15m",
  currentPrice: 64800,
  structure: { trend: "bullish", bias: "bullish", confidence: 0.7, pivots: [], breaks: [
    { index: 12, price: 64400, type: "BOS", direction: "bullish", time: 300 },
  ]},
  liquidity: { pools: [], nearestBSL: null, nearestSSL: null },
  orderBlocks: [
    { type: "bullish", proximal: 64700, distal: 64500, time: 14, index: 14, valid: true, isMitigated: false, strength: 0.5, hasFvg: false },
  ],
  fvg: [],
  dailyBias: { bias: "bullish", strength: 0.5, consecutiveDays: 2 },
});

/**
 * 1h — bullish, active OBs and a liquidity pool.
 */
const tf1h: SmcReport = baseReport({
  timeframe: "1h",
  currentPrice: 64900,
  structure: { trend: "bullish", bias: "bullish", confidence: 0.75, pivots: [], breaks: [
    { index: 20, price: 64500, type: "BOS", direction: "bullish", time: 400 },
  ]},
  liquidity: {
    pools: [{ price: 64700, type: "BSL", score: 0.7, touches: 2, wasSwept: false, time: 21, index: 21 }],
    nearestBSL: { price: 64700, type: "BSL", score: 0.7, touches: 2, wasSwept: false, time: 21, index: 21 },
    nearestSSL: null,
  },
  orderBlocks: [
    { type: "bullish", proximal: 64800, distal: 64600, time: 22, index: 22, valid: true, isMitigated: false, strength: 0.6, hasFvg: false },
  ],
  fvg: [{ type: "bullish", top: 64900, bottom: 64750, time: 23, index: 23, fillFraction: 0.1 }],
});

/**
 * 1d — bullish bias, strong daily bias, dealing range that puts price in OTE.
 */
const tf1d: SmcReport = baseReport({
  timeframe: "1d",
  currentPrice: 64800,
  structure: { trend: "bullish", bias: "bullish", confidence: 0.82, pivots: [], breaks: [
    { index: 5, price: 64000, type: "CHoCH", direction: "bullish", time: 500 },
  ]},
  liquidity: {
    pools: [{ price: 64500, type: "BSL", score: 0.8, touches: 3, wasSwept: false, time: 6, index: 6 }],
    nearestBSL: { price: 64500, type: "BSL", score: 0.8, touches: 3, wasSwept: false, time: 6, index: 6 },
    nearestSSL: null,
  },
  fvg: [{ type: "bullish", top: 64700, bottom: 64500, time: 7, index: 7, fillFraction: 0.2 }],
  dailyBias: { bias: "bullish", strength: 0.75, consecutiveDays: 5 },
});

/**
 * 1w — bullish bias, weekly level
 */
const tf1w: SmcReport = baseReport({
  timeframe: "1w",
  currentPrice: 65000,
  structure: { trend: "bullish", bias: "bullish", confidence: 0.85, pivots: [], breaks: [] },
  pdArray: {
    currentBias: "discount",
    zones: [],
    dealingRange: { high: 67000, low: 62000, timeframe: "1w" },
    equilibrium: 64500,
  },
  dailyBias: { bias: "bullish", strength: 0.8, consecutiveDays: 10 },
});

const bullishReports = new Map<string, SmcReport>([
  ["4h", htfBullish],
  ["5m", ltfBullish],
  ["15m", tf15m],
  ["1h", tf1h],
  ["1d", tf1d],
  ["1w", tf1w],
]);

// ─── Fixture set B: consolidation / equilibrium (Model 5 should match) ───────

const htfConsolidation: SmcReport = baseReport({
  timeframe: "4h",
  structure: {
    trend: "ranging",
    bias: "neutral",
    confidence: 0.25,
    pivots: [],
    breaks: [],
  },
  liquidity: {
    pools: [
      { price: 63800, type: "EQH", score: 0.7, touches: 4, wasSwept: false, time: 1, index: 5 },
      { price: 63700, type: "EQL", score: 0.6, touches: 3, wasSwept: false, time: 2, index: 8 },
    ],
    nearestBSL: null, nearestSSL: null,
  },
  pdArray: {
    currentBias: "equilibrium",
    zones: [],
    dealingRange: { high: 64000, low: 63600, timeframe: "1h" },
    equilibrium: 63800,
  },
});

const ltfBreakout: SmcReport = baseReport({
  timeframe: "5m",
  currentPrice: 63850,
  structure: {
    trend: "bullish",
    bias: "bullish",
    confidence: 0.7,
    pivots: [],
    breaks: [
      { index: 30, price: 64000, type: "BOS", direction: "bullish", time: 2000 },
    ],
  },
  liquidity: {
    pools: [],
    nearestBSL: null,
    nearestSSL: null,
  },
  orderBlocks: [],
  fvg: [],
  pdArray: {
    currentBias: "equilibrium",
    zones: [],
    dealingRange: { high: 64000, low: 63600, timeframe: "1h" },
    equilibrium: 63800,
  },
  dailyBias: { bias: "neutral", strength: 0.1, consecutiveDays: 0 },
});

const consolidationReports = new Map<string, SmcReport>([
  ["4h", htfConsolidation],
  ["5m", ltfBreakout],
]);

// ─── Fixture set C: neutral / no-signal (nothing should match) ───────────────
// Includes all timeframes referenced by any template so models
// fail gracefully rather than throw on missing reports.

function neutralReport(tf: string, overrides?: Partial<SmcReport>): SmcReport {
  return baseReport({
    timeframe: tf,
    structure: { trend: "ranging", bias: "neutral", confidence: 0.1, pivots: [], breaks: [] },
    liquidity: { pools: [], nearestBSL: null, nearestSSL: null },
    orderBlocks: [],
    fvg: [],
    pdArray: {
      currentBias: "equilibrium",
      zones: [],
      dealingRange: { high: tf === "5m" ? 65200 : 66000, low: tf === "5m" ? 64800 : 64000, timeframe: "1d" },
      equilibrium: tf === "5m" ? 65000 : 65000,
    },
    dailyBias: { bias: "neutral", strength: 0.05, consecutiveDays: 0 },
    ...overrides,
  });
}

const neutralReports = new Map<string, SmcReport>([
  ["4h", neutralReport("4h")],
  ["5m", neutralReport("5m")],
  ["15m", neutralReport("15m")],
  ["1h", neutralReport("1h")],
  ["1d", neutralReport("1d")],
  ["1w", neutralReport("1w")],
]);

// ═══════════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("StrategyRegistry", () => {
  describe("built-in templates", () => {
    it("loads 5 modern confluence + 12 charter blueprint models on construction", () => {
      const reg = new StrategyRegistry();
      const list = reg.list();
      expect(list.length).toBe(41);
      expect(list.map((e) => e.id)).toContain("smc-confluence-1");
      expect(list.map((e) => e.id)).toContain("charter-01");
      expect(list.map((e) => e.id)).toContain("charter-12");
    });
  });

  describe("custom registration", () => {
    it("allows adding and removing strategies", () => {
      const reg = new StrategyRegistry();
      reg.register({
        id: "test-model",
        name: "Test Model",
        description: "A custom strategy",
        version: "1.0.0",
        rule: { type: "and", rules: [] },
        tags: ["custom"],
        requiredTimeframes: [],
      });
      expect(reg.get("test-model")).toBeDefined();
      expect(reg.list().length).toBe(42); // 41 built-in + 1 custom

      const removed = reg.unregister("test-model");
      expect(removed).toBe(true);
      expect(reg.list().length).toBe(41);
    });
  });

  describe("detectAll — bullish fixture (models 1–4 should match)", () => {
    const reg = new StrategyRegistry();
    const results = reg.detectAll(bullishReports);

    it("returns results for all 41 models", () => {
      expect(results.size).toBe(41);
    });

    it("Model 1 (HTF+BOS+FVG) matches", () => {
      const r = results.get("smc-confluence-1")!;
      expect(r.status).toBe("matched");
      expect(r.matched).toBe(true);
    });

    it("Model 2 (+IDM) matches", () => {
      const r = results.get("smc-confluence-2")!;
      expect(r.status).toBe("matched");
      expect(r.matched).toBe(true);
    });

    it("Model 3 (+OTE) matches — price 64850 within 64480–65160", () => {
      const r = results.get("smc-confluence-3")!;
      expect(r.status).toBe("matched");
      expect(r.matched).toBe(true);
    });

    it("Model 4 (+IDM+OTE) matches — all five predicates pass", () => {
      const r = results.get("smc-confluence-4")!;
      expect(r.status).toBe("matched");
      expect(r.matched).toBe(true);
    });

    it("Model 5 (Five Box) does NOT match — no consolidation on bullish fixture", () => {
      const r = results.get("smc-confluence-5")!;
      expect(r.status).toBe("failed");
      expect(r.matched).toBe(false);
    });

    it("all matched results include evidence strings", () => {
      for (const id of ["smc-confluence-1", "smc-confluence-2", "smc-confluence-3", "smc-confluence-4"]) {
        const r = results.get(id)!;
        expect(r.evidence.length).toBeGreaterThan(0);
      }
    });
  });

  describe("detectAll — consolidation fixture (Model 5 should match)", () => {
    const reg = new StrategyRegistry();
    const results = reg.detectAll(consolidationReports);

    it("Model 5 (Five Box) matches on consolidation fixture", () => {
      const r = results.get("smc-confluence-5")!;
      expect(r.status).toBe("matched");
      expect(r.matched).toBe(true);
    });

    it("Models 1–4 do not match on consolidation fixture (no clear bias + no FVGs)", () => {
      for (const id of ["smc-confluence-1", "smc-confluence-2", "smc-confluence-3", "smc-confluence-4"]) {
        const r = results.get(id)!;
        expect(r.status).toBe("failed");
        expect(r.matched).toBe(false);
      }
    });
  });

  describe("detectAll — neutral fixture (nothing should match)", () => {
    const reg = new StrategyRegistry();
    const results = reg.detectAll(neutralReports);

    it("all 41 models return matched=false on neutral fixture", () => {
      for (const id of results.keys()) {
        const r = results.get(id)!;
        expect(r.status).toBe("failed");
        expect(r.matched).toBe(false);
      }
    });
  });

  describe("detect single strategy", () => {
    it("returns result for a known id", () => {
      const reg = new StrategyRegistry();
      const r = reg.detect("smc-confluence-1", bullishReports);
      expect(r).toBeDefined();
      expect(r!.strategyId).toBe("smc-confluence-1");
    });

    it("returns undefined for an unknown id", () => {
      const reg = new StrategyRegistry();
      const r = reg.detect("nonexistent", bullishReports);
      expect(r).toBeUndefined();
    });
  });

  describe("missing timeframe error handling", () => {
    it("errors for models requiring a timeframe that is absent", () => {
      const reg = new StrategyRegistry();
      const incomplete = new Map([["4h", neutralReport("4h")]]); // all others missing
      const results = reg.detectAll(incomplete);

      // Models needing only 4h → evaluate (fail, not error)
      for (const id of ["charter-06", "classical-08"]) {
        expect(results.get(id)!.status).toBe("failed");
      }
      // Models needing 5m → error
      for (const id of ["smc-confluence-1", "classical-12"]) {
        expect(results.get(id)!.status).toBe("error");
      }
      // Models needing 15m → error
      for (const id of ["classical-02", "classical-05", "classical-11"]) {
        expect(results.get(id)!.status).toBe("error");
      }
      // Models needing 1h → error
      for (const id of ["classical-03", "mmxm-mmsm", "reversal-turtle-soup"]) {
        expect(results.get(id)!.status).toBe("error");
      }
      // Models needing 1d or 1w → error
      for (const id of ["temporal-power-of-three", "classical-04", "framework-2fvg"]) {
        expect(results.get(id)!.status).toBe("error");
      }
    });
  });

  describe("loadTemplates", () => {
    it("overwrites existing templates with same id", () => {
      const reg = new StrategyRegistry();
      const custom = {
        id: "smc-confluence-1",
        name: "Custom Override",
        description: "Overridden",
        version: "2.0.0",
        rule: { type: "predicate", predicate: "hasBias" } as const,
        tags: [],
        requiredTimeframes: [],
      };
      reg.register(custom);
      expect(reg.get("smc-confluence-1")!.name).toBe("Custom Override");
    });
  });
});
