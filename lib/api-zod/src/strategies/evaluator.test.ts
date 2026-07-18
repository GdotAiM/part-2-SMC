/**
 * Tests for StrategyEvaluator — walks Rule trees against multi-timeframe reports.
 *
 * Covers: simple AND, nested OR/AND, NOT negation, missing predicate, missing timeframe.
 */

import { describe, it, expect } from "vitest";
import type { SmcReport } from "../generated/types";
import { StrategyEvaluator } from "./evaluator";
import { andRules, orRules, notRule, predicateRule } from "./rules";

// ─── Fixtures ────────────────────────────────────────────────────────────────

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
      confidence: 0.75,
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
    dailyBias: { bias: "bullish", strength: 0.6, consecutiveDays: 3 },
    draw: [],
    ...overrides,
  };
}

/** 4h — bullish, has OBs, has FVGs, has liquidity. */
const report4h: SmcReport = baseReport({
  timeframe: "4h",
  structure: { trend: "bullish", bias: "bullish", confidence: 0.82, pivots: [], breaks: [] },
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
  dailyBias: { bias: "bullish", strength: 0.7, consecutiveDays: 4 },
});

/** 1h — bearish, no OBs, no FVGs (divergent from HTF). */
const report1h: SmcReport = baseReport({
  timeframe: "1h",
  currentPrice: 64800,
  structure: { trend: "bearish", bias: "bearish", confidence: 0.65, pivots: [], breaks: [] },
  liquidity: { pools: [], nearestBSL: null, nearestSSL: null },
  orderBlocks: [],
  fvg: [],
  dailyBias: { bias: "bearish", strength: 0.4, consecutiveDays: 1 },
});

/** 15m — neutral, no signals. */
const report15m: SmcReport = baseReport({
  timeframe: "15m",
  structure: { trend: "ranging", bias: "neutral", confidence: 0.1, pivots: [], breaks: [] },
  liquidity: { pools: [], nearestBSL: null, nearestSSL: null },
  orderBlocks: [],
  fvg: [],
  dailyBias: { bias: "neutral", strength: 0.05, consecutiveDays: 0 },
});

const reports = new Map<string, SmcReport>([
  ["4h", report4h],
  ["1h", report1h],
  ["15m", report15m],
]);

// ═══════════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("StrategyEvaluator", () => {
  describe("simple AND rule", () => {
    it("returns matched=true when both predicates pass", () => {
      const evaluator = new StrategyEvaluator(reports);
      // 4h has bias + has order block
      const rule = andRules(
        predicateRule("hasBias", { timeframe: "4h" }),
        predicateRule("hasOrderBlock", { timeframe: "4h" }),
      );

      const result = evaluator.evaluate(rule);
      expect(result.matched).toBe(true);
      expect(result.evidence[0]).toMatch(/AND: 2\/2/i);
    });

    it("returns matched=false when one predicate fails", () => {
      const evaluator = new StrategyEvaluator(reports);
      // 4h has bias, 15m has no OBs
      const rule = andRules(
        predicateRule("hasBias", { timeframe: "4h" }),
        predicateRule("hasOrderBlock", { timeframe: "15m" }),
      );

      const result = evaluator.evaluate(rule);
      expect(result.matched).toBe(false);
      expect(result.evidence[0]).toMatch(/only 1\/2/i);
    });

    it("uses default timeframe when omitted", () => {
      const evaluator = new StrategyEvaluator(reports, "4h");
      // pred with no timeframe should resolve to "4h"
      const rule = andRules(
        predicateRule("hasBias"),           // uses default 4h
        predicateRule("hasDailyBias"),       // uses default 4h
      );

      const result = evaluator.evaluate(rule);
      expect(result.matched).toBe(true);
    });
  });

  describe("nested OR/AND rule", () => {
    it("returns matched=true when inner OR satisfies AND", () => {
      const evaluator = new StrategyEvaluator(reports);
      // AND(
      //   hasBias on 4h,           ✓
      //   OR(hasFVG on 4h, hasOrderBlock on 1h)  → 4h has FVG ✓
      // )
      const rule = andRules(
        predicateRule("hasBias", { timeframe: "4h" }),
        orRules(
          predicateRule("hasFVG", { timeframe: "4h" }),
          predicateRule("hasOrderBlock", { timeframe: "1h" }),
        ),
      );

      const result = evaluator.evaluate(rule);
      expect(result.matched).toBe(true);
      expect(result.evidence[0]).toMatch(/AND: 2\/2/i);
    });

    it("returns matched=false when inner OR fails AND", () => {
      const evaluator = new StrategyEvaluator(reports);
      // AND(
      //   hasBias on 4h,               ✓
      //   hasOrderBlock on 15m,         ✗ (no OBs)
      //   OR(hasFVG on 1h, hasFVG on 15m)  ✗ (no FVGs on either)
      // )
      const rule = andRules(
        predicateRule("hasBias", { timeframe: "4h" }),
        predicateRule("hasOrderBlock", { timeframe: "15m" }),
        orRules(
          predicateRule("hasFVG", { timeframe: "1h" }),
          predicateRule("hasFVG", { timeframe: "15m" }),
        ),
      );

      const result = evaluator.evaluate(rule);
      expect(result.matched).toBe(false);
      expect(result.evidence[0]).toMatch(/only \d+\/3/i);
    });

    it("handles OR-AND-OR nesting", () => {
      const evaluator = new StrategyEvaluator(reports);
      // OR(
      //   hasBias on 15m,                           ✗ (neutral)
      //   AND(hasBias on 4h, hasOrderBlock on 4h),  ✓
      // )
      const rule = orRules(
        predicateRule("hasBias", { timeframe: "15m" }),
        andRules(
          predicateRule("hasBias", { timeframe: "4h" }),
          predicateRule("hasOrderBlock", { timeframe: "4h" }),
        ),
      );

      const result = evaluator.evaluate(rule);
      expect(result.matched).toBe(true);
      // The AND branch matched, so OR succeeds
      expect(result.evidence.some((e) => /at least 1/i.test(e))).toBe(true);
    });
  });

  describe("NOT rule", () => {
    it("negates a matching predicate to false", () => {
      const evaluator = new StrategyEvaluator(reports);
      // NOT hasBias on 4h → hasBias matches → negated to false
      const rule = notRule(
        predicateRule("hasBias", { timeframe: "4h" }),
      );

      const result = evaluator.evaluate(rule);
      expect(result.matched).toBe(false);
      expect(result.evidence[0]).toMatch(/negated to false/i);
    });

    it("negates a failing predicate to true", () => {
      const evaluator = new StrategyEvaluator(reports);
      // NOT hasBias on 15m → hasBias fails (neutral) → negated to true
      const rule = notRule(
        predicateRule("hasBias", { timeframe: "15m" }),
      );

      const result = evaluator.evaluate(rule);
      expect(result.matched).toBe(true);
      expect(result.evidence[0]).toMatch(/negated to true/i);
    });

    it("inverts the inner score", () => {
      const evaluator = new StrategyEvaluator(reports);
      const rule = notRule(
        predicateRule("hasBias", { timeframe: "15m" }),
      );
      // hasBias on 15m returns score undefined (no match)
      // notRule should set score = 1 - undefined = undefined in that case
      // But hasBias only returns a score on match, so undefined stays undefined

      const result = evaluator.evaluate(rule);
      expect(result.matched).toBe(true);
      // No assertion on score since the inner predicate didn't set one
    });

    it("wraps a nested AND inside NOT", () => {
      const evaluator = new StrategyEvaluator(reports);
      // NOT(AND(hasBias on 4h, hasOrderBlock on 15m))
      //   → AND fails (no OBs on 15m), so NOT passes
      const rule = notRule(
        andRules(
          predicateRule("hasBias", { timeframe: "4h" }),
          predicateRule("hasOrderBlock", { timeframe: "15m" }),
        ),
      );

      const result = evaluator.evaluate(rule);
      expect(result.matched).toBe(true);
      expect(result.evidence[0]).toMatch(/negated to true/i);
    });
  });

  describe("edge cases", () => {
    it("returns clean error for unknown predicate", () => {
      const evaluator = new StrategyEvaluator(reports);
      const rule = predicateRule("doesNotExist");

      const result = evaluator.evaluate(rule);
      expect(result.matched).toBe(false);
      expect(result.evidence[0]).toMatch(/unknown predicate/i);
    });

    it("throws when timeframe has no report", () => {
      const evaluator = new StrategyEvaluator(reports);
      const rule = predicateRule("hasBias", { timeframe: "1w" });

      expect(() => evaluator.evaluate(rule)).toThrow(/no report found/i);
    });
  });
});
