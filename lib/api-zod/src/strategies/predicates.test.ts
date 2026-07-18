/**
 * Tests for ICT/SMC predicate functions.
 *
 * Each predicate gets 3–4 tests covering match, no-match, and edge cases.
 * Fixtures are defined inline (no shared fixture files exist yet).
 */

import { describe, it, expect } from "vitest";
import type { SmcReport } from "../generated/types";
import {
  hasBias,
  hasOrderBlock,
  hasLiquidityPool,
  hasFVG,
  biasAligned,
  hasDailyBias,
  confluenceScore,
  priceNearOBProximal,
  hasMarketStructureShift,
  hasInducementZone,
  priceWithinOTEzone,
  hasConsolidationZone,
  isWithinSession,
  hasSMTConfirmation,
  hasHighImpactNewsWithin,
  isNewsBlackoutWindow,
  hasDisplacement,
  hasLiquiditySweep,
  hasBreakerBlock,
  hasSessionAlignment,
  hasRangeExpansion,
  hasWeeklyExpansionContext,
  hasEqualHighsLows,
} from "./predicates";
import type { EconomicEvent } from "./predicates";

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
      confidence: 0.75,
      pivots: [],
      breaks: [],
    },
    liquidity: {
      pools: [],
      nearestBSL: null,
      nearestSSL: null,
    },
    orderBlocks: [],
    fvg: [],
    pdArray: {
      currentBias: "discount",
      zones: [],
      dealingRange: { high: 66000, low: 62000, timeframe: "1d" },
      equilibrium: 64000,
    },
    dailyBias: {
      bias: "bullish",
      strength: 0.6,
      consecutiveDays: 3,
    },
    draw: [],
    ...overrides,
  };
}

/** Full bullish setup — every predicate should fire. */
const bullishReport: SmcReport = baseReport({
  structure: { trend: "bullish", bias: "bullish", confidence: 0.82, pivots: [], breaks: [] },
  liquidity: {
    pools: [
      { price: 64500, type: "BSL", score: 0.8, touches: 2, wasSwept: false, time: 1, index: 10 },
      { price: 65500, type: "SSL", score: 0.6, touches: 1, wasSwept: false, time: 2, index: 15 },
    ],
    nearestBSL: { price: 64500, type: "BSL", score: 0.8, touches: 2, wasSwept: false, time: 1, index: 10 },
    nearestSSL: { price: 65500, type: "SSL", score: 0.6, touches: 1, wasSwept: false, time: 2, index: 15 },
  },
  orderBlocks: [
    { type: "bullish", proximal: 64800, distal: 64500, time: 3, index: 12, valid: true, isMitigated: false, strength: 0.7, hasFvg: true },
    { type: "bullish", proximal: 65200, distal: 64900, time: 4, index: 18, valid: true, isMitigated: false, strength: 0.5, hasFvg: false },
  ],
  fvg: [
    { type: "bullish", top: 64700, bottom: 64550, time: 5, index: 13, fillFraction: 0.2 },
    { type: "bullish", top: 65100, bottom: 64850, time: 6, index: 19, fillFraction: 0.0 },
  ],
  dailyBias: { bias: "bullish", strength: 0.7, consecutiveDays: 4 },
});

/** Full bearish setup. */
const bearishReport: SmcReport = baseReport({
  currentPrice: 62000,
  structure: { trend: "bearish", bias: "bearish", confidence: 0.78, pivots: [], breaks: [] },
  liquidity: {
    pools: [
      { price: 62500, type: "BSL", score: 0.7, touches: 3, wasSwept: false, time: 7, index: 22 },
    ],
    nearestBSL: { price: 62500, type: "BSL", score: 0.7, touches: 3, wasSwept: false, time: 7, index: 22 },
    nearestSSL: null,
  },
  orderBlocks: [
    { type: "bearish", proximal: 61800, distal: 62100, time: 8, index: 25, valid: true, isMitigated: false, strength: 0.8, hasFvg: true },
  ],
  fvg: [
    { type: "bearish", top: 61900, bottom: 61600, time: 9, index: 27, fillFraction: 0.1 },
  ],
  pdArray: {
    currentBias: "premium",
    zones: [],
    dealingRange: { high: 64000, low: 60000, timeframe: "1d" },
    equilibrium: 62000,
  },
  dailyBias: { bias: "bearish", strength: 0.65, consecutiveDays: 2 },
});

/** Neutral / no-signal setup. */
const neutralReport: SmcReport = baseReport({
  structure: { trend: "ranging", bias: "neutral", confidence: 0.15, pivots: [], breaks: [] },
  liquidity: { pools: [], nearestBSL: null, nearestSSL: null },
  orderBlocks: [],
  fvg: [],
  dailyBias: { bias: "neutral", strength: 0.1, consecutiveDays: 0 },
});

/** Report where all OBs are mitigated. */
const noActiveOBReport: SmcReport = baseReport({
  orderBlocks: [
    { type: "bullish", proximal: 64800, distal: 64500, time: 3, index: 12, valid: true, isMitigated: true, strength: 0.7, hasFvg: false },
    { type: "bearish", proximal: 65200, distal: 65400, time: 4, index: 13, valid: false, isMitigated: true, strength: 0.5, hasFvg: false },
  ],
});

/** Report where all FVGs are filled (fillFraction ≥ 0.5). */
const filledFVGReport: SmcReport = baseReport({
  fvg: [
    { type: "bullish", top: 64700, bottom: 64550, time: 5, index: 13, fillFraction: 0.8 },
    { type: "bullish", top: 65100, bottom: 64850, time: 6, index: 19, fillFraction: 1.0 },
  ],
});

/** Report with weak daily bias strength. */
const weakDailyBiasReport: SmcReport = baseReport({
  dailyBias: { bias: "bullish", strength: 0.15, consecutiveDays: 1 },
});

/** Report with price far from any OB. */
const farFromOBReport: SmcReport = baseReport({
  currentPrice: 70000,
  orderBlocks: [
    { type: "bullish", proximal: 64800, distal: 64500, time: 3, index: 12, valid: true, isMitigated: false, strength: 0.7, hasFvg: false },
  ],
});

/** Report with all liquidity pools swept. */
const sweptLiquidityReport: SmcReport = baseReport({
  liquidity: {
    pools: [
      { price: 64500, type: "BSL", score: 0.8, touches: 2, wasSwept: true, time: 1, index: 10 },
      { price: 65500, type: "SSL", score: 0.6, touches: 1, wasSwept: true, time: 2, index: 15 },
    ],
    nearestBSL: null,
    nearestSSL: null,
  },
});

/** Report with zero confluence factors (no bias, no OBs, no FVGs, no liq, no daily bias). */
const zeroConfluenceReport: SmcReport = neutralReport;

// ═══════════════════════════════════════════════════════════════════════════════
// hasBias
// ═══════════════════════════════════════════════════════════════════════════════

describe("hasBias", () => {
  it("returns matched=true for a bullish structure bias", () => {
    const r = hasBias(bullishReport);
    expect(r.matched).toBe(true);
    expect(r.evidence.length).toBeGreaterThan(0);
    expect(r.evidence[0]).toMatch(/bullish/i);
  });

  it("returns matched=true for a bearish structure bias", () => {
    const r = hasBias(bearishReport);
    expect(r.matched).toBe(true);
    expect(r.evidence[0]).toMatch(/bearish/i);
  });

  it("returns matched=false when both biases are neutral", () => {
    const r = hasBias(neutralReport);
    expect(r.matched).toBe(false);
    expect(r.evidence[0]).toMatch(/neutral|no clear direction/i);
  });

  it("falls back to dailyBias when structure bias is neutral", () => {
    const r = baseReport({
      structure: { trend: "ranging", bias: "neutral", confidence: 0.1, pivots: [], breaks: [] },
      dailyBias: { bias: "bullish", strength: 0.6, consecutiveDays: 5 },
    });
    const result = hasBias(r);
    expect(result.matched).toBe(true);
    expect(result.evidence[0]).toMatch(/Daily bias/i);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// priceNearOBProximal
// ═══════════════════════════════════════════════════════════════════════════════

describe("priceNearOBProximal", () => {
  it("returns matched=true when price is within tolerance of a valid OB proximal", () => {
    // bullishReport currentPrice=65000, OBs at 64800 (Δ=200, 0.31% > 0.2%)
    // Use a wider tolerance to make it match
    const r = priceNearOBProximal(bullishReport, 0.005); // 0.5%
    expect(r.matched).toBe(true);
    expect(r.evidence[0]).toMatch(/OB/);
  });

  it("returns matched=false when price is far from any OB proximal", () => {
    const r = priceNearOBProximal(farFromOBReport);
    expect(r.matched).toBe(false);
    expect(r.evidence[0]).toMatch(/not within/i);
  });

  it("returns matched=false when there are no active OBs", () => {
    const r = priceNearOBProximal(neutralReport);
    expect(r.matched).toBe(false);
    expect(r.evidence[0]).toMatch(/no active/i);
  });

  it("reports FVG overlap in evidence when applicable", () => {
    const r = priceNearOBProximal(bullishReport, 0.005);
    expect(r.matched).toBe(true);
    const hasFvgEvidence = r.evidence.some((e) => e.toLowerCase().includes("fvg"));
    // bullishReport has an OB with hasFvg=true at 64800, within 0.5% of 65000
    expect(hasFvgEvidence).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// hasOrderBlock
// ═══════════════════════════════════════════════════════════════════════════════

describe("hasOrderBlock", () => {
  it("returns matched=true when active OBs exist", () => {
    const r = hasOrderBlock(bullishReport);
    expect(r.matched).toBe(true);
    expect(r.evidence[0]).toMatch(/active OB/i);
  });

  it("returns matched=false when all OBs are mitigated or invalid", () => {
    const r = hasOrderBlock(noActiveOBReport);
    expect(r.matched).toBe(false);
  });

  it("returns matched=false when no OBs exist at all", () => {
    const r = hasOrderBlock(neutralReport);
    expect(r.matched).toBe(false);
  });

  it("includes OB type counts in evidence", () => {
    const r = hasOrderBlock(bullishReport);
    expect(r.matched).toBe(true);
    expect(r.evidence[0]).toMatch(/bullish/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// hasLiquidityPool
// ═══════════════════════════════════════════════════════════════════════════════

describe("hasLiquidityPool", () => {
  it("returns matched=true when unswept pools exist", () => {
    const r = hasLiquidityPool(bullishReport);
    expect(r.matched).toBe(true);
  });

  it("returns matched=true when nearestBSL/nearestSSL is present even with empty pools", () => {
    const r = baseReport({
      liquidity: {
        pools: [],
        nearestBSL: { price: 64000, type: "BSL", score: 0.9, touches: 4, wasSwept: false, time: 1, index: 5 },
        nearestSSL: null,
      },
    });
    const result = hasLiquidityPool(r);
    expect(result.matched).toBe(true);
    expect(result.evidence[0]).toMatch(/BSL/);
  });

  it("returns matched=false when no pools exist", () => {
    const r = hasLiquidityPool(neutralReport);
    expect(r.matched).toBe(false);
  });

  it("returns matched=false when all pools are swept", () => {
    const r = hasLiquidityPool(sweptLiquidityReport);
    expect(r.matched).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// hasFVG
// ═══════════════════════════════════════════════════════════════════════════════

describe("hasFVG", () => {
  it("returns matched=true when unfilled FVGs exist", () => {
    const r = hasFVG(bullishReport);
    expect(r.matched).toBe(true);
    expect(r.evidence[0]).toMatch(/unfilled FVG/i);
  });

  it("returns matched=false when all FVGs are filled", () => {
    const r = hasFVG(filledFVGReport);
    expect(r.matched).toBe(false);
  });

  it("returns matched=false when no FVGs exist", () => {
    const r = hasFVG(neutralReport);
    expect(r.matched).toBe(false);
  });

  it("includes type counts in evidence", () => {
    const r = hasFVG(bullishReport);
    expect(r.matched).toBe(true);
    expect(r.evidence[0]).toMatch(/bullish/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// biasAligned
// ═══════════════════════════════════════════════════════════════════════════════

describe("biasAligned", () => {
  it("returns matched=true when bullish aligns with 'bullish'", () => {
    const r = biasAligned(bullishReport, "bullish");
    expect(r.matched).toBe(true);
    expect(r.evidence[0]).toMatch(/aligns/i);
  });

  it("returns matched=false when bullish does not align with 'bearish'", () => {
    const r = biasAligned(bullishReport, "bearish");
    expect(r.matched).toBe(false);
    expect(r.evidence[0]).toMatch(/does NOT align/i);
  });

  it("returns matched=false when structure bias is neutral", () => {
    const r = biasAligned(neutralReport, "bullish");
    expect(r.matched).toBe(false);
  });

  it("returns matched=true when bearish aligns with 'bearish'", () => {
    const r = biasAligned(bearishReport, "bearish");
    expect(r.matched).toBe(true);
    expect(r.score).toBeCloseTo(0.78, 2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// hasDailyBias
// ═══════════════════════════════════════════════════════════════════════════════

describe("hasDailyBias", () => {
  it("returns matched=true with strong daily bias", () => {
    const r = hasDailyBias(bullishReport);
    expect(r.matched).toBe(true);
    expect(r.evidence[0]).toMatch(/daily bias/i);
  });

  it("returns matched=false when daily bias strength is below 0.3", () => {
    const r = hasDailyBias(weakDailyBiasReport);
    expect(r.matched).toBe(false);
    expect(r.evidence[0]).toMatch(/strength/i);
  });

  it("returns matched=false when daily bias is neutral", () => {
    const r = hasDailyBias(neutralReport);
    expect(r.matched).toBe(false);
  });

  it("returns matched=true with strong bearish daily bias and consecutive days", () => {
    const r = hasDailyBias(bearishReport);
    expect(r.matched).toBe(true);
    expect(r.evidence.some((e) => /consecutive.*\d+/i.test(e))).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// confluenceScore
// ═══════════════════════════════════════════════════════════════════════════════

describe("confluenceScore", () => {
  it("returns score=1.0 when all 5 factors are present", () => {
    const r = confluenceScore(bullishReport);
    expect(r.score).toBe(1.0);
    expect(r.evidence[0]).toMatch(/5\/5/i);
  });

  it("returns score=0 when no factors are present", () => {
    const r = confluenceScore(zeroConfluenceReport);
    expect(r.score).toBe(0);
    expect(r.evidence[0]).toMatch(/0\/5/i);
  });

  it("returns partial scores correctly", () => {
    // Only has bias + daily bias
    const report = baseReport({
      structure: { trend: "bullish", bias: "bullish", confidence: 0.6, pivots: [], breaks: [] },
      liquidity: { pools: [], nearestBSL: null, nearestSSL: null },
      orderBlocks: [],
      fvg: [],
      dailyBias: { bias: "bullish", strength: 0.5, consecutiveDays: 2 },
    });
    const r = confluenceScore(report);
    expect(r.score).toBe(0.4); // 2/5 = 0.4
    expect(r.evidence[0]).toMatch(/2\/5/i);
  });

  it("includes individual factor checks in evidence array", () => {
    const r = confluenceScore(bullishReport);
    // Should have the summary line + 5 factor lines = 6 total
    expect(r.evidence.length).toBeGreaterThanOrEqual(6);
    expect(r.evidence.some((e) => e.startsWith("✓"))).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// hasMarketStructureShift
// ═══════════════════════════════════════════════════════════════════════════════

describe("hasMarketStructureShift", () => {
  it("returns matched=true when BOS/CHoCH breaks exist", () => {
    const r = baseReport({
      structure: {
        trend: "bullish", bias: "bullish", confidence: 0.75,
        pivots: [],
        breaks: [
          { index: 20, price: 64000, type: "BOS", direction: "bullish", time: 1000 },
          { index: 25, price: 64500, type: "CHoCH", direction: "bullish", time: 1001 },
        ],
      },
    });
    const result = hasMarketStructureShift(r);
    expect(result.matched).toBe(true);
    expect(result.evidence[0]).toMatch(/MSS event/i);
  });

  it("returns matched=false when no breaks exist", () => {
    const r = hasMarketStructureShift(neutralReport);
    expect(r.matched).toBe(false);
    expect(r.evidence[0]).toMatch(/no structure breaks/i);
  });

  it("returns matched=false when breaks are not BOS/CHoCH", () => {
    const r = baseReport({
      structure: {
        trend: "bullish", bias: "bullish", confidence: 0.75,
        pivots: [],
        breaks: [
          { index: 20, price: 64000, type: "LIQUIDITY_SWEEP", direction: "bullish", time: 1000 },
        ],
      },
    });
    const result = hasMarketStructureShift(r);
    expect(result.matched).toBe(false);
    expect(result.evidence[0]).toMatch(/none are BOS/);
  });

  it("warns when recent MSS opposes HTF bias", () => {
    const r = baseReport({
      structure: {
        trend: "bullish", bias: "bullish", confidence: 0.8,
        pivots: [],
        breaks: [
          { index: 30, price: 62000, type: "CHoCH", direction: "bearish", time: 1002 },
        ],
      },
    });
    const result = hasMarketStructureShift(r);
    expect(result.matched).toBe(true);
    expect(result.evidence.some((e) => /opposes/i.test(e))).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// hasInducementZone
// ═══════════════════════════════════════════════════════════════════════════════

describe("hasInducementZone", () => {
  it("returns matched=true with LH pivots in bullish structure", () => {
    const r = baseReport({
      structure: {
        trend: "bullish", bias: "bullish", confidence: 0.8,
        pivots: [
          { index: 10, price: 63000, type: "HH", confirmed: true, time: 10 },
          { index: 15, price: 64000, type: "HH", confirmed: true, time: 15 },
          { index: 20, price: 63800, type: "LH", confirmed: true, time: 20 },
          { index: 25, price: 64500, type: "HH", confirmed: true, time: 25 },
        ],
        breaks: [],
      },
    });
    const result = hasInducementZone(r);
    expect(result.matched).toBe(true);
    expect(result.evidence[0]).toMatch(/inducement pivot/i);
  });

  it("returns matched=true with HL pivots in bearish structure", () => {
    const r = baseReport({
      currentPrice: 61000,
      structure: {
        trend: "bearish", bias: "bearish", confidence: 0.8,
        pivots: [
          { index: 10, price: 64000, type: "LL", confirmed: true, time: 10 },
          { index: 15, price: 62500, type: "LL", confirmed: true, time: 15 },
          { index: 20, price: 62800, type: "HL", confirmed: true, time: 20 },
          { index: 25, price: 61500, type: "LL", confirmed: true, time: 25 },
        ],
        breaks: [],
      },
    });
    const result = hasInducementZone(r);
    expect(result.matched).toBe(true);
    expect(result.evidence[0]).toMatch(/inducement pivot/i);
  });

  it("returns matched=false when there are too few pivots", () => {
    const r = baseReport({
      structure: {
        trend: "bullish", bias: "bullish", confidence: 0.8,
        pivots: [
          { index: 10, price: 63000, type: "HH", confirmed: true, time: 10 },
        ],
        breaks: [],
      },
    });
    const result = hasInducementZone(r);
    expect(result.matched).toBe(false);
    expect(result.evidence[0]).toMatch(/not enough pivots/i);
  });

  it("returns matched=false in trending structure with no counter-trend pivots", () => {
    const r = baseReport({
      structure: {
        trend: "bullish", bias: "bullish", confidence: 0.7,
        pivots: [
          { index: 10, price: 63000, type: "HH", confirmed: true, time: 10 },
          { index: 15, price: 63500, type: "HL", confirmed: true, time: 15 },
          { index: 20, price: 64000, type: "HH", confirmed: true, time: 20 },
          { index: 25, price: 64500, type: "HL", confirmed: true, time: 25 },
        ],
        breaks: [],
      },
    });
    const result = hasInducementZone(r);
    expect(result.matched).toBe(false);
    expect(result.evidence[0]).toMatch(/no LH pivot/i);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// priceWithinOTEzone
// ═══════════════════════════════════════════════════════════════════════════════

describe("priceWithinOTEzone", () => {
  const dealingRange = { high: 66000, low: 62000, timeframe: "1d" }; // range = 4000
  // Bullish OTE: 62000 + 4000*0.62 = 64480 to 62000 + 4000*0.79 = 65160
  // Bearish OTE: 66000 - 4000*0.79 = 62840 to 66000 - 4000*0.62 = 63520

  it("returns matched=true in bullish OTE zone", () => {
    const r = baseReport({
      currentPrice: 64800, // within 64480–65160
      pdArray: { currentBias: "discount", zones: [], dealingRange, equilibrium: 64000 },
    });
    const result = priceWithinOTEzone(r, "bullish");
    expect(result.matched).toBe(true);
    expect(result.evidence[0]).toMatch(/bullish OTE/i);
  });

  it("returns matched=true in bearish OTE zone", () => {
    const r = baseReport({
      currentPrice: 63200, // within 62840–63520
      pdArray: { currentBias: "premium", zones: [], dealingRange, equilibrium: 64000 },
    });
    const result = priceWithinOTEzone(r, "bearish");
    expect(result.matched).toBe(true);
    expect(result.evidence[0]).toMatch(/bearish OTE/i);
  });

  it("returns matched=false when price is outside both OTE zones", () => {
    const r = baseReport({
      currentPrice: 67000, // above dealing range high
      pdArray: { currentBias: "premium", zones: [], dealingRange, equilibrium: 64000 },
    });
    const result = priceWithinOTEzone(r);
    expect(result.matched).toBe(false);
    expect(result.evidence[0]).toMatch(/outside both OTE/i);
  });

  it("returns matched=true in either zone when no direction given", () => {
    const r = baseReport({
      currentPrice: 64800, // bullish OTE
      pdArray: { currentBias: "discount", zones: [], dealingRange, equilibrium: 64000 },
    });
    const result = priceWithinOTEzone(r);
    expect(result.matched).toBe(true);
  });

  it("returns matched=false when dealing range is flat", () => {
    const flatRange = { high: 64000, low: 64000, timeframe: "1d" };
    const r = baseReport({
      currentPrice: 64000,
      pdArray: { currentBias: "equilibrium", zones: [], dealingRange: flatRange, equilibrium: 64000 },
    });
    const result = priceWithinOTEzone(r);
    expect(result.matched).toBe(false);
    expect(result.evidence[0]).toMatch(/invalid dealing range/i);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// hasConsolidationZone
// ═══════════════════════════════════════════════════════════════════════════════

describe("hasConsolidationZone", () => {
  it("returns matched=true when structure trend is ranging", () => {
    const r = hasConsolidationZone(neutralReport);
    expect(r.matched).toBe(true);
    expect(r.evidence[0]).toMatch(/RANGING/i);
  });

  it("returns matched=true when pdArray has equilibrium", () => {
    const r = baseReport({
      structure: { trend: "bullish", bias: "bullish", confidence: 0.7, pivots: [], breaks: [] },
      pdArray: {
        currentBias: "equilibrium", zones: [],
        dealingRange: { high: 66000, low: 62000, timeframe: "1d" },
        equilibrium: 64000,
      },
    });
    const result = hasConsolidationZone(r);
    expect(result.matched).toBe(true);
    expect(result.evidence.some((e) => /equilibrium/i.test(e))).toBe(true);
  });

  it("returns matched=false when no consolidation signals", () => {
    const r = baseReport({
      structure: { trend: "bullish", bias: "bullish", confidence: 0.85, pivots: [], breaks: [] },
      pdArray: {
        currentBias: "discount", zones: [],
        dealingRange: { high: 68000, low: 60000, timeframe: "1d" },
        equilibrium: 64000,
      },
    });
    const result = hasConsolidationZone(r);
    expect(result.matched).toBe(false);
  });

  it("detects consolidation from pdArray zone label", () => {
    const r = baseReport({
      structure: { trend: "bullish", bias: "bullish", confidence: 0.75, pivots: [], breaks: [] },
      pdArray: {
        currentBias: "premium", zones: [
          { label: "Consolidation Zone", top: 64500, bottom: 63500, timeframe: "4h", type: "neutral" },
        ],
        dealingRange: { high: 66000, low: 62000, timeframe: "1d" },
        equilibrium: 64000,
      },
    });
    const result = hasConsolidationZone(r);
    expect(result.matched).toBe(true);
    expect(result.evidence.some((e) => /consolidation zone identified/i.test(e))).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// isWithinSession
// ═══════════════════════════════════════════════════════════════════════════════

describe("isWithinSession", () => {
  it("returns matched=true when liquidity pools carry matching session tags", () => {
    const r = baseReport({
      liquidity: {
        pools: [
          { price: 64500, type: "BSL", score: 0.8, touches: 2, wasSwept: false, time: 1, index: 10, session: "LONDON_OPEN" },
          { price: 65500, type: "SSL", score: 0.6, touches: 1, wasSwept: false, time: 2, index: 15, session: "NY_AM" },
        ],
        nearestBSL: null, nearestSSL: null,
      },
    });
    const result = isWithinSession(r, "LONDON");
    expect(result.matched).toBe(true);
    expect(result.evidence[0]).toMatch(/session.*london/i);
  });

  it("returns matched=false when pool sessions do not match", () => {
    const r = baseReport({
      liquidity: {
        pools: [
          { price: 64500, type: "BSL", score: 0.8, touches: 2, wasSwept: false, time: 1, index: 10, session: "ASIAN" },
        ],
        nearestBSL: null, nearestSSL: null,
      },
    });
    const result = isWithinSession(r, "NY_AM");
    expect(result.matched).toBe(false);
    expect(result.evidence[0]).toMatch(/no session match/i);
  });

  it("falls back to contextual match for ASIAN session", () => {
    const r = baseReport({ market: "forex", timeframe: "4h" });
    const result = isWithinSession(r, "ASIAN");
    expect(result.matched).toBe(true);
  });

  it("returns matched=false when no pools and no contextual fallback", () => {
    const r = baseReport({ market: "crypto", timeframe: "4h" });
    const result = isWithinSession(r, "NY_PM");
    expect(result.matched).toBe(false);
    expect(result.evidence[0]).toMatch(/no session match/i);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// hasSMTConfirmation
// ═══════════════════════════════════════════════════════════════════════════════

describe("hasSMTConfirmation", () => {
  it("returns matched=true when SMT is detected above confidence", () => {
    const r = baseReport({
      smt: { detected: true, type: "REGULAR", confidence: 0.8, time: 1005, primarySymbol: "BTCUSDT", correlatedSymbol: "ETHUSDT" },
    });
    const result = hasSMTConfirmation(r);
    expect(result.matched).toBe(true);
    expect(result.evidence[0]).toMatch(/SMT divergence confirmed/i);
  });

  it("returns matched=false when SMT is not detected", () => {
    const r = baseReport({
      smt: { detected: false, type: null, confidence: 0, time: null, primarySymbol: null, correlatedSymbol: null },
    });
    const result = hasSMTConfirmation(r);
    expect(result.matched).toBe(false);
    expect(result.evidence[0]).toMatch(/not detected/i);
  });

  it("returns matched=false when SMT confidence is below threshold", () => {
    const r = baseReport({
      smt: { detected: true, type: "REGULAR", confidence: 0.15, time: 1005, primarySymbol: null, correlatedSymbol: null },
    });
    const result = hasSMTConfirmation(r, 0.3);
    expect(result.matched).toBe(false);
    expect(result.evidence[0]).toMatch(/below minimum/i);
  });

  it("returns matched=false when no SMT object exists", () => {
    const r = baseReport({ smt: undefined });
    const result = hasSMTConfirmation(r);
    expect(result.matched).toBe(false);
    expect(result.evidence[0]).toMatch(/No SMT data/i);
  });

  it("includes type and symbols in evidence on match", () => {
    const r = baseReport({
      smt: { detected: true, type: "HIDDEN", confidence: 0.9, time: 1010, primarySymbol: "EURUSD", correlatedSymbol: "GBPUSD" },
    });
    const result = hasSMTConfirmation(r);
    expect(result.matched).toBe(true);
    expect(result.evidence.some((e) => /EURUSD.*GBPUSD/i.test(e))).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// hasDisplacement
// ═══════════════════════════════════════════════════════════════════════════════

describe("hasDisplacement", () => {
  const c = (t: number, o: number, h: number, l: number, cl: number, v = 1000) =>
    ({ time: t, open: o, high: h, low: l, close: cl, volume: v });

  it("returns matched=true when recent candles show displacement", () => {
    const candles = [
      c(1, 64000, 64100, 63900, 64050),
      c(2, 64050, 64150, 63950, 64100),
      c(3, 64100, 64180, 64020, 64150),
      c(4, 64150, 64200, 64100, 64180),
      c(5, 64180, 64250, 64120, 64200),
      c(6, 64200, 64300, 64150, 64250),
      c(7, 64250, 64350, 64180, 64300),
      c(8, 64300, 64400, 64250, 64350),
      c(9, 64350, 64500, 64300, 64450),
      c(10, 64450, 65100, 64400, 65050),
    ];
    const report = baseReport({
      candles,
      structure: { trend: "bullish", bias: "bullish", confidence: 0.8, pivots: [], breaks: [] },
    });
    const r = hasDisplacement(report, 5, 2);
    expect(r.matched).toBe(true);
    expect(r.evidence[0]).toMatch(/displacement/i);
  });

  it("returns matched=false when candles have small bodies", () => {
    const candles = Array.from({ length: 20 }, (_, i) =>
      c(i, 50000, 50030, 49980, 50010),
    );
    const report = baseReport({ candles });
    const r = hasDisplacement(report, 5, 3);
    expect(r.matched).toBe(false);
  });

  it("returns matched=false with too few candles", () => {
    const report = baseReport({ candles: [c(1, 50000, 50100, 49900, 50050)] });
    const r = hasDisplacement(report);
    expect(r.matched).toBe(false);
    expect(r.evidence[0]).toMatch(/not enough/i);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// hasLiquiditySweep
// ═══════════════════════════════════════════════════════════════════════════════

describe("hasLiquiditySweep", () => {
  it("returns matched=true when a pool was recently swept", () => {
    const now = Date.now() / 1000;
    const report = baseReport({
      generatedAt: now,
      liquidity: {
        pools: [
          { price: 64500, type: "BSL", score: 0.8, touches: 2, wasSwept: true, sweptAt: now - 300, time: 1, index: 10 },
        ],
        nearestBSL: null, nearestSSL: null,
      },
    });
    const r = hasLiquiditySweep(report, 3600_000);
    expect(r.matched).toBe(true);
    expect(r.evidence[0]).toMatch(/swept/i);
  });

  it("returns matched=true when structure shows sweep-and-reversal", () => {
    const report = baseReport({
      structure: {
        trend: "bearish", bias: "bearish", confidence: 0.7,
        pivots: [],
        breaks: [
          { index: 10, price: 64000, type: "BOS", direction: "bullish", time: 100 },
          { index: 15, price: 63500, type: "BOS", direction: "bearish", time: 101 },
        ],
      },
    });
    const r = hasLiquiditySweep(report);
    expect(r.matched).toBe(true);
  });

  it("returns matched=false when no pools swept and no reversal pattern", () => {
    const report = baseReport({ liquidity: { pools: [], nearestBSL: null, nearestSSL: null } });
    const r = hasLiquiditySweep(report);
    expect(r.matched).toBe(false);
  });

  it("ignores pools swept outside the lookback window", () => {
    const now = Date.now() / 1000;
    const report = baseReport({
      generatedAt: now,
      liquidity: {
        pools: [
          { price: 64500, type: "BSL", score: 0.8, touches: 2, wasSwept: true, sweptAt: now - 100_000, time: 1, index: 10 },
        ],
        nearestBSL: null, nearestSSL: null,
      },
    });
    const r = hasLiquiditySweep(report, 60_000);
    expect(r.matched).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// hasBreakerBlock
// ═══════════════════════════════════════════════════════════════════════════════

describe("hasBreakerBlock", () => {
  it("returns matched=true when breaker blocks exist", () => {
    const report = baseReport({
      orderBlocks: [
        { type: "bearish", proximal: 65000, distal: 65200, time: 1, index: 10, valid: true, isMitigated: false, isBreaker: true, strength: 0.8, hasFvg: true },
      ],
    });
    const r = hasBreakerBlock(report);
    expect(r.matched).toBe(true);
    expect(r.evidence[0]).toMatch(/breaker/i);
  });

  it("returns matched=false when no blocks have isBreaker", () => {
    const report = baseReport({
      orderBlocks: [
        { type: "bullish", proximal: 64500, distal: 64200, time: 3, index: 12, valid: true, isMitigated: false, isBreaker: false, strength: 0.7, hasFvg: false },
      ],
    });
    const r = hasBreakerBlock(report);
    expect(r.matched).toBe(false);
  });

  it("returns matched=false when no order blocks exist", () => {
    const r = hasBreakerBlock(neutralReport);
    expect(r.matched).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// hasSessionAlignment
// ═══════════════════════════════════════════════════════════════════════════════

describe("hasSessionAlignment", () => {
  it("returns matched=true when liquidity pools carry matching session tags", () => {
    const report = baseReport({
      liquidity: {
        pools: [
          { price: 64500, type: "BSL", score: 0.8, touches: 2, wasSwept: false, time: 1, index: 10, session: "LONDON_OPEN" },
        ],
        nearestBSL: null, nearestSSL: null,
      },
    });
    const r = hasSessionAlignment(report, "LONDON");
    expect(r.matched).toBe(true);
    expect(r.evidence[0]).toMatch(/london/i);
  });

  it("returns matched=false when pool sessions do not match", () => {
    const report = baseReport({
      liquidity: {
        pools: [
          { price: 64500, type: "BSL", score: 0.8, touches: 2, wasSwept: false, time: 1, index: 10, session: "ASIAN" },
        ],
        nearestBSL: null, nearestSSL: null,
      },
    });
    const r = hasSessionAlignment(report, "NY_AM");
    expect(r.matched).toBe(false);
  });

  it("falls back to timeframe match when no pool sessions exist", () => {
    const report = baseReport({
      liquidity: { pools: [], nearestBSL: null, nearestSSL: null },
      timeframe: "15m",
    });
    const r = hasSessionAlignment(report, "LONDON");
    expect(r.matched).toBe(true);
    expect(r.score).toBe(0.3);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// hasRangeExpansion
// ═══════════════════════════════════════════════════════════════════════════════

describe("hasRangeExpansion", () => {
  it("returns matched=true when trend is directional with high confidence", () => {
    const report = baseReport({
      structure: { trend: "bullish", bias: "bullish", confidence: 0.8, pivots: [], breaks: [] },
    });
    const r = hasRangeExpansion(report);
    expect(r.matched).toBe(true);
    expect(r.evidence.some((e) => /directional expansion/i.test(e))).toBe(true);
  });

  it("returns matched=true when multiple aligned BOS breaks exist", () => {
    const report = baseReport({
      structure: {
        trend: "bullish", bias: "bullish", confidence: 0.75,
        pivots: [],
        breaks: [
          { index: 10, price: 64000, type: "BOS", direction: "bullish", time: 100 },
          { index: 15, price: 64500, type: "BOS", direction: "bullish", time: 101 },
        ],
      },
    });
    const r = hasRangeExpansion(report, 2);
    expect(r.matched).toBe(true);
    expect(r.evidence.some((e) => /BOS/i.test(e))).toBe(true);
  });

  it("returns matched=false when ranging with no breaks", () => {
    const report = baseReport({
      structure: { trend: "ranging", bias: "neutral", confidence: 0.1, pivots: [], breaks: [] },
    });
    const r = hasRangeExpansion(report);
    expect(r.matched).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// hasWeeklyExpansionContext
// ═══════════════════════════════════════════════════════════════════════════════

describe("hasWeeklyExpansionContext", () => {
  it("returns matched=true on 1d timeframe with strong daily bias", () => {
    const report = baseReport({
      timeframe: "1d",
      dailyBias: { bias: "bullish", strength: 0.7, consecutiveDays: 4 },
      structure: { trend: "bullish", bias: "bullish", confidence: 0.8, pivots: [], breaks: [] },
    });
    const r = hasWeeklyExpansionContext(report);
    expect(r.matched).toBe(true);
    expect(r.evidence[0]).toMatch(/1d|weekly/i);
  });

  it("returns matched=false on 5m timeframe", () => {
    const report = baseReport({ timeframe: "5m" });
    const r = hasWeeklyExpansionContext(report);
    expect(r.matched).toBe(false);
    expect(r.evidence[0]).toMatch(/requires 1d or 1w/i);
  });

  it("returns matched=false on 1d with no directional conviction", () => {
    const report = baseReport({
      timeframe: "1d",
      dailyBias: { bias: "neutral", strength: 0.1, consecutiveDays: 0 },
      structure: { trend: "ranging", bias: "neutral", confidence: 0.1, pivots: [], breaks: [] },
    });
    const r = hasWeeklyExpansionContext(report);
    expect(r.matched).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// hasEqualHighsLows
// ═══════════════════════════════════════════════════════════════════════════════

describe("hasEqualHighsLows", () => {
  it("returns matched=true when EQH/EQL liquidity pools exist", () => {
    const report = baseReport({
      liquidity: {
        pools: [
          { price: 64500, type: "EQH", score: 0.8, touches: 3, wasSwept: false, time: 1, index: 10 },
          { price: 64000, type: "EQL", score: 0.6, touches: 2, wasSwept: false, time: 2, index: 15 },
        ],
        nearestBSL: null, nearestSSL: null,
      },
    });
    const r = hasEqualHighsLows(report);
    expect(r.matched).toBe(true);
    expect(r.evidence[0]).toMatch(/equal/i);
  });

  it("returns matched=true when structure pivots have equal prices", () => {
    const report = baseReport({
      structure: {
        trend: "bullish", bias: "bullish", confidence: 0.7,
        pivots: [
          { index: 10, price: 64500, type: "HH", confirmed: true, time: 100 },
          { index: 15, price: 64502, type: "HH", confirmed: true, time: 101 },
        ],
        breaks: [],
      },
    });
    const r = hasEqualHighsLows(report);
    expect(r.matched).toBe(true);
    expect(r.evidence.some((e) => /equal/i.test(e))).toBe(true);
  });

  it("returns matched=false with no equal structures", () => {
    const report = baseReport({
      liquidity: { pools: [], nearestBSL: null, nearestSSL: null },
      structure: {
        trend: "bullish", bias: "bullish", confidence: 0.7,
        pivots: [
          { index: 10, price: 64000, type: "HH", confirmed: true, time: 100 },
          { index: 15, price: 64500, type: "HH", confirmed: true, time: 101 },
        ],
        breaks: [],
      },
    });
    const r = hasEqualHighsLows(report);
    expect(r.matched).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// hasHighImpactNewsWithin
// ═══════════════════════════════════════════════════════════════════════════════

describe("hasHighImpactNewsWithin", () => {
  const now = Math.floor(Date.now() / 1000);
  const events: EconomicEvent[] = [
    { time: now + 300, currency: "USD", event: "Non-Farm Employment Change", impact: "High", actual: null, forecast: "200K", previous: "180K" },
    { time: now + 3600, currency: "EUR", event: "Interest Rate Decision", impact: "High", actual: null, forecast: "4.50%", previous: "4.25%" },
    { time: now + 7200, currency: "GBP", event: "CPI y/y", impact: "Medium", actual: null, forecast: "2.5%", previous: "2.3%" },
    { time: now - 300, currency: "USD", event: "FOMC Minutes", impact: "High", actual: "5.00%", forecast: "5.00%", previous: "4.75%" },
  ];

  it("returns matched=true when a high-impact event is within the window", () => {
    const report = baseReport({ generatedAt: now });
    const r = hasHighImpactNewsWithin(report, events, 600_000); // 10 min
    expect(r.matched).toBe(true);
    expect(r.evidence[0]).toMatch(/high-impact/i);
    expect(r.evidence.some((e) => /Non-Farm/i.test(e))).toBe(true);
  });

  it("returns matched=true when multiple high-impact events are upcoming", () => {
    const report = baseReport({ generatedAt: now });
    const r = hasHighImpactNewsWithin(report, events, 7_200_000); // 2 hours
    expect(r.matched).toBe(true);
    expect(r.evidence.length).toBeGreaterThanOrEqual(2);
  });

  it("returns matched=false when window is too short", () => {
    const report = baseReport({ generatedAt: now });
    const r = hasHighImpactNewsWithin(report, events, 60_000); // 1 min — nothing upcoming
    expect(r.matched).toBe(false);
  });

  it("returns matched=false with empty events array", () => {
    const report = baseReport({ generatedAt: now });
    const r = hasHighImpactNewsWithin(report, [], 600_000);
    expect(r.matched).toBe(false);
    expect(r.evidence[0]).toMatch(/No economic events/i);
  });

  it("ignores already-released events even if within the window", () => {
    const report = baseReport({ generatedAt: now });
    const r = hasHighImpactNewsWithin(report, events, 600_000);
    // FOMC Minutes at now-300 has actual=5.00% — already released, should not match
    expect(r.evidence.some((e) => /FOMC/i.test(e))).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// isNewsBlackoutWindow
// ═══════════════════════════════════════════════════════════════════════════════

describe("isNewsBlackoutWindow", () => {
  const now = Math.floor(Date.now() / 1000);
  const events: EconomicEvent[] = [
    { time: now + 120, currency: "USD", event: "Unemployment Rate", impact: "High", actual: null, forecast: "3.8%", previous: "3.9%" },
    { time: now + 3600, currency: "EUR", event: "GDP q/q", impact: "High", actual: null, forecast: "0.3%", previous: "0.2%" },
    { time: now - 120, currency: "GBP", event: "Retail Sales m/m", impact: "High", actual: "0.5%", forecast: "0.2%", previous: "0.1%" },
    { time: now + 7200, currency: "JPY", event: "Tankan Survey", impact: "Medium", actual: null, forecast: null, previous: null },
  ];

  it("returns matched=true when within blackout before an event", () => {
    const report = baseReport({ generatedAt: now });
    const r = isNewsBlackoutWindow(report, events, 300_000); // 5 min each side
    expect(r.matched).toBe(true);
    expect(r.evidence[0]).toMatch(/blackout window/i);
  });

  it("returns matched=true when within blackout after a released event", () => {
    const report = baseReport({ generatedAt: now });
    const r = isNewsBlackoutWindow(report, events, 300_000);
    // now - 120 + 300_000ms = now + 180s — within blackout of released GBP Retail Sales
    expect(r.matched).toBe(true);
    expect(r.evidence.some((e) => /Retail Sales/i.test(e))).toBe(true);
  });

  it("returns matched=false when outside all blackout windows", () => {
    const report = baseReport({ generatedAt: now - 3600 }); // 1 hour ago
    // GBP Retail Sales at now-120 → blackout ended at now-120+300s = now+180s
    // USD Unemployment at now+120 → blackout starts at now-180s
    // If report is 3600s ago, we're well outside both
    const r = isNewsBlackoutWindow(report, events, 300_000);
    expect(r.matched).toBe(false);
  });

  it("returns matched=false with no high-impact events", () => {
    const lowEvents: EconomicEvent[] = [
      { time: now + 300, currency: "USD", event: "Empire State Manufacturing", impact: "Medium", actual: null, forecast: "5.0", previous: "4.0" },
    ];
    const report = baseReport({ generatedAt: now });
    const r = isNewsBlackoutWindow(report, lowEvents, 600_000);
    expect(r.matched).toBe(false);
    expect(r.evidence[0]).toMatch(/No high-impact events in calendar/i);
  });

  it("returns matched=false with empty events array", () => {
    const report = baseReport({ generatedAt: now });
    const r = isNewsBlackoutWindow(report, [], 600_000);
    expect(r.matched).toBe(false);
    expect(r.evidence[0]).toMatch(/No economic events/i);
  });
});
