/**
 * Tests for generateNarrative — deterministic template-based market commentary.
 *
 * Runs with: npx tsx artifacts/api-server/src/lib/narrative/generate-narrative.test.ts
 */

import { generateNarrative } from "./generate-narrative.js";
import type { SmcReport, LiquidityPool, OrderBlock, FairValueGap, DrawTarget } from "../smc/types.js";
import type { StrategyDetectionSummary } from "./generate-narrative.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(label: string, ok: () => boolean) {
  try {
    if (ok()) {
      console.log(`  ✓ ${label}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${label}`);
      failed++;
    }
  } catch (err) {
    console.error(`  ✗ FAIL (threw): ${label} — ${err}`);
    failed++;
  }
}

function contains(text: string, phrase: string): boolean {
  return text.toLowerCase().includes(phrase.toLowerCase());
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeReport(overrides: Partial<SmcReport> = {}): SmcReport {
  return {
    symbol: "BTCUSDT",
    market: "crypto",
    timeframe: "4h",
    currentPrice: 64800,
    generatedAt: Date.now() / 1000,
    candles: [],
    structure: {
      trend: "bullish",
      bias: "bullish",
      confidence: 0.82,
      pivots: [],
      breaks: [],
      phase: "expansion",
      narrative: "",
      evidence: [],
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
      strength: 0.72,
      consecutiveDays: 4,
      referencedSwing: null,
      evidence: [],
    },
    smt: { detected: false, type: null, confidence: 0, time: null, primarySymbol: null, correlatedSymbol: null },
    draw: [],
    narrative: "",
    sessionState: "London Expansion — Bullish",
    ...overrides,
  };
}

/** Bullish fixture — strong trend, BSL target, matched strategies. */
const bullishReport = makeReport({
  sessionState: "London Expansion — Bullish",
  draw: [
    { price: 65500, type: "BSL", score: 2.4, direction: "long", label: "Buy-side Liquidity @ 65500", evidence: [] },
    { price: 66000, type: "BSL", score: 1.8, direction: "long", label: "Buy-side Liquidity @ 66000", evidence: [] },
  ],
  liquidity: {
    pools: [
      { price: 65500, type: "BSL", score: 0.85, touches: 2, wasSwept: false, sweptAt: null, time: 100, index: 20, session: null, probabilityOfSweep: 0.7 },
    ],
    nearestBSL: { price: 65500, type: "BSL", score: 0.85, touches: 2, wasSwept: false, sweptAt: null, time: 100, index: 20, session: null, probabilityOfSweep: 0.7 },
    nearestSSL: null,
  },
  smt: { detected: true, type: "bullish_smt", confidence: 0.65, time: 105, primarySymbol: "BTCUSDT", correlatedSymbol: "ETHUSDT" },
});

/** Bearish fixture — downtrend, SSL target, no strategies. */
const bearishReport = makeReport({
  symbol: "ETHUSDT",
  currentPrice: 3150,
  sessionState: "NY Retracement — Seeking Premium",
  structure: { trend: "bearish", bias: "bearish", confidence: 0.75, pivots: [], breaks: [], phase: "distribution", narrative: "", evidence: [] },
  pdArray: { currentBias: "premium", zones: [], dealingRange: { high: 3300, low: 3000, timeframe: "4h" }, equilibrium: 3150 },
  dailyBias: { bias: "bearish", strength: 0.6, consecutiveDays: 3, referencedSwing: "weekly support", evidence: [] },
  draw: [
    { price: 3050, type: "SSL", score: 2.1, direction: "short", label: "Sell-side Liquidity @ 3050", evidence: [] },
  ],
  liquidity: {
    pools: [
      { price: 3050, type: "SSL", score: 0.8, touches: 3, wasSwept: false, sweptAt: null, time: 200, index: 30, session: null, probabilityOfSweep: 0.75 },
    ],
    nearestBSL: null,
    nearestSSL: { price: 3050, type: "SSL", score: 0.8, touches: 3, wasSwept: false, sweptAt: null, time: 200, index: 30, session: null, probabilityOfSweep: 0.75 },
  },
  smt: { detected: false, type: null, confidence: 0, time: null, primarySymbol: null, correlatedSymbol: null },
});

/** Neutral fixture — ranging, no clear direction. */
const neutralReport = makeReport({
  currentPrice: 50000,
  sessionState: "London Consolidation",
  structure: { trend: "ranging", bias: "neutral", confidence: 0.2, pivots: [], breaks: [], phase: "unknown", narrative: "", evidence: [] },
  pdArray: { currentBias: "equilibrium", zones: [], dealingRange: { high: 51000, low: 49000, timeframe: "4h" }, equilibrium: 50000 },
  dailyBias: { bias: "neutral", strength: 0.1, consecutiveDays: 0, referencedSwing: null, evidence: [] },
  draw: [],
  liquidity: { pools: [], nearestBSL: null, nearestSSL: null },
  smt: { detected: false, type: null, confidence: 0, time: null, primarySymbol: null, correlatedSymbol: null },
});

// ═══════════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════════

async function run() {
  console.log("Narrative generator tests\n");

  // ── 1. Bullish with strategies ────────────────────────────────────────────
  console.log("1. Bullish trend with matched strategies");

  const bullishStrategies: StrategyDetectionSummary[] = [
    { strategyId: "smc-confluence-1", strategyName: "HTF POI + BOS + FVG", score: 0.82, evidence: ["✓ Structure bias bullish", "✓ FVG identified"] },
    { strategyId: "classical-06", strategyName: "Model 6 — Universal Buy Model", score: 0.67, evidence: ["✓ Buy-side expansion"] },
  ];
  const bullishMap = new Map<string, SmcReport>([
    ["5m", makeReport({ timeframe: "5m", currentPrice: 64700 })],
    ["4h", bullishReport],
  ]);
  const bullNarrative = generateNarrative({ detectedStrategies: bullishStrategies, reportMap: bullishMap });

  console.log("── Direction ──\n" + bullNarrative.split("\n\n")[0] + "\n");
  assert("mentions bullish bias", () => contains(bullNarrative, "bullish"));
  assert("mentions structure confidence", () => contains(bullNarrative, "82%"));
  assert("mentions daily bias alignment", () => contains(bullNarrative, "daily bias is bullish"));
  assert("mentions expansion phase", () => contains(bullNarrative, "expansion"));
  assert("mentions session London", () => contains(bullNarrative, "London Expansion"));
  assert("mentions discount zone", () => contains(bullNarrative, "discount"));
  assert("mentions BSL liquidity", () => contains(bullNarrative, "buy-side liquidity"));
  assert("mentions BSL price", () => contains(bullNarrative, "65,500") || contains(bullNarrative, "65500"));
  assert("mentions dealing range", () => contains(bullNarrative, "Dealing range"));
  assert("mentions equilibrium", () => contains(bullNarrative, "equilibrium"));
  assert("mentions strategy name", () => contains(bullNarrative, "HTF POI + BOS + FVG"));
  assert("mentions strategy confidence", () => contains(bullNarrative, "82% confidence"));
  assert("mentions alternative strategy", () => contains(bullNarrative, "Universal Buy Model"));
  assert("mentions above equilibrium", () => contains(bullNarrative, "above equilibrium") || contains(bullNarrative, "64800") && contains(bullNarrative, "64000"));
  assert("has 4 line breaks (5 sections)", () => (bullNarrative.match(/\n\n/g) ?? []).length >= 3);

  // ── 2. Bearish with no strategies ────────────────────────────────────────
  console.log("\n2. Bearish trend, no matched strategies");

  const bearNarrative = generateNarrative({
    detectedStrategies: [],
    reportMap: new Map([["4h", bearishReport]]),
  });

  console.log("── Direction ──\n" + bearNarrative.split("\n\n")[0] + "\n");
  assert("mentions bearish bias", () => contains(bearNarrative, "bearish"));
  assert("mentions distribution phase", () => contains(bearNarrative, "distribution"));
  assert("mentions premium zone", () => contains(bearNarrative, "premium"));
  assert("mentions SSL", () => contains(bearNarrative, "sell-side liquidity"));
  assert("mentions SSL price 3050", () => contains(bearNarrative, "3050"));
  assert("mentions dealing range 3000–3300", () => contains(bearNarrative, "3000") && contains(bearNarrative, "3300"));
  assert("mentions draw targets", () => contains(bearNarrative, "Primary draw targets"));
  assert("has NO strategy overlay", () => !contains(bearNarrative, "Strategy overlay"));
  assert("mentions referenced swing", () => contains(bearNarrative, "weekly support"));

  // ── 3. Neutral / ranging ─────────────────────────────────────────────────
  console.log("\n3. Neutral / ranging market");

  const neutralNarrative = generateNarrative({
    detectedStrategies: [],
    reportMap: new Map([["4h", neutralReport]]),
  });

  console.log("── Direction ──\n" + neutralNarrative.split("\n\n")[0] + "\n");
  assert("says no clear directional bias", () => contains(neutralNarrative, "no clear directional bias"));
  assert("mentions ranging trend", () => contains(neutralNarrative, "ranging"));
  assert("mentions consolidation", () => contains(neutralNarrative, "Consolidation"));
  assert("mentions equilibrium", () => contains(neutralNarrative, "equilibrium"));
  assert("says no actionable liquidity", () => contains(neutralNarrative, "no actionable liquidity"));
  assert("mentions dealing range in place of no-levels fallback", () => contains(neutralNarrative, "dealing range") || contains(neutralNarrative, "49000"));
  assert("mentions formatted current price 50,000", () => contains(neutralNarrative, "50,000"));
  assert("has no strategy overlay", () => !contains(neutralNarrative, "Strategy overlay"));

  // ── 4. Empty report map ──────────────────────────────────────────────────
  console.log("\n4. Empty report map edge case");
  const emptyNarrative = generateNarrative({
    detectedStrategies: [],
    reportMap: new Map(),
  });
  assert("returns fallback for empty map", () => contains(emptyNarrative, "No SMC reports"));

  // ── Summary ──────────────────────────────────────────────────────────────
  const total = passed + failed;
  console.log(`\n${"─".repeat(50)}`);
  console.log(`${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}

run().catch((err) => {
  console.error("Test harness crashed:", err);
  process.exit(1);
});
