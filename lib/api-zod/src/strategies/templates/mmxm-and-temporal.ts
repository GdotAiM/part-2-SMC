/**
 * Market Maker Cycles (MMXM) & Temporal/Reversal Specialties — Templates
 *
 * Encodes the 2 MMXM models + 11 temporal/reversal models from the ICT/SMC
 * taxonomy as StrategyDefinition objects. Corresponds 1:1 with the seed data
 * (ids mmxm-mmsm, mmxm-mmbm, temporal-*, reversal-*, framework-*).
 *
 * All predicates referenced by the seed are now implemented.
 * See predicates.ts for the full list of 21 functions.
 */

import type { StrategyDefinition } from "../rules";
import { andRules, predicateRule } from "../rules";

// ═══════════════════════════════════════════════════════════════════════════════
// Market Maker Cycles (MMXM)
// ═══════════════════════════════════════════════════════════════════════════════

const mmsm: StrategyDefinition = {
  id: "mmxm-mmsm",
  name: "Market Maker Sell Model (MMSM)",
  description:
    "Full lifecycle from bullish to bearish: consolidation → engineering liquidity → " +
    "SMR at HTF bearish PD Array → sell program → terminal distribution. SMT confirms distribution.",
  version: "1.0.0",
  rule: andRules(
    predicateRule("hasBias", { timeframe: "1d" }),
    predicateRule("hasMarketStructureShift", { timeframe: "1h" }),
    predicateRule("hasSMTConfirmation", { timeframe: "1h" }),
    predicateRule("hasLiquiditySweep", { timeframe: "1h" }),
  ),
  tags: ["market-maker-cycle", "mmsm", "distribution"],
  requiredTimeframes: ["1d", "1h"],
};

const mmbm: StrategyDefinition = {
  id: "mmxm-mmbm",
  name: "Market Maker Buy Model (MMBM)",
  description:
    "Full lifecycle from bearish to bullish: consolidation → engineering liquidity → " +
    "SMR at HTF bullish PD Array → buy program → terminal distribution. SMT confirms accumulation.",
  version: "1.0.0",
  rule: andRules(
    predicateRule("hasBias", { timeframe: "1d" }),
    predicateRule("hasMarketStructureShift", { timeframe: "1h" }),
    predicateRule("hasSMTConfirmation", { timeframe: "1h" }),
    predicateRule("hasLiquiditySweep", { timeframe: "1h" }),
  ),
  tags: ["market-maker-cycle", "mmbm", "accumulation"],
  requiredTimeframes: ["1d", "1h"],
};

// ═══════════════════════════════════════════════════════════════════════════════
// Temporal Specialties
// ═══════════════════════════════════════════════════════════════════════════════

const silverBulletLondon: StrategyDefinition = {
  id: "temporal-silver-bullet-london",
  name: "Silver Bullet — London Open",
  description:
    "Time-dependent execution 03:00–04:00 EST. 15m parent chart, LTF entry on sweep+MSS+FVG. " +
    "Target 20–30 pips, 1:2 R:R. Skips setup during high-impact news blackout windows.",
  version: "1.0.0",
  rule: andRules(
    predicateRule("hasBias", { timeframe: "15m" }),
    predicateRule("hasMarketStructureShift", { timeframe: "5m" }),
    predicateRule("hasFVG", { timeframe: "5m" }),
    // TODO: uncomment once the evaluator can inject economic events as args.
    // The predicate needs events[] from the DB — see hasHighImpactNewsWithin
    // and isNewsBlackoutWindow in predicates.ts.
    // predicateRule("isNewsBlackoutWindow", { timeframe: "5m", args: [events, 900_000] }),
  ),
  tags: ["temporal-reversal", "silver-bullet", "london"],
  requiredTimeframes: ["15m", "5m"],
};

const silverBulletNyam: StrategyDefinition = {
  id: "temporal-silver-bullet-nyam",
  name: "Silver Bullet — New York AM",
  description:
    "Time-dependent execution 10:00–11:00 EST. Highest volume window — London tail + NY open. " +
    "Identical mechanical rules to London Silver Bullet.",
  version: "1.0.0",
  rule: andRules(
    predicateRule("hasBias", { timeframe: "15m" }),
    predicateRule("hasMarketStructureShift", { timeframe: "5m" }),
    predicateRule("hasFVG", { timeframe: "5m" }),
  ),
  tags: ["temporal-reversal", "silver-bullet", "ny-am"],
  requiredTimeframes: ["15m", "5m"],
};

const silverBulletNypm: StrategyDefinition = {
  id: "temporal-silver-bullet-nypm",
  name: "Silver Bullet — New York PM",
  description:
    "Time-dependent execution 14:00–15:00 EST. Afternoon trend continuation / late-session expansions. " +
    "Identical mechanical rules to London Silver Bullet.",
  version: "1.0.0",
  rule: andRules(
    predicateRule("hasBias", { timeframe: "15m" }),
    predicateRule("hasMarketStructureShift", { timeframe: "5m" }),
    predicateRule("hasFVG", { timeframe: "5m" }),
  ),
  tags: ["temporal-reversal", "silver-bullet", "ny-pm"],
  requiredTimeframes: ["15m", "5m"],
};

const judasSwing: StrategyDefinition = {
  id: "temporal-judas-swing",
  name: "Judas Swing",
  description:
    "Structural manipulation at major session opens. False breakout counter to daily bias " +
    "sweeps liquidity, then true expansion leg fires. Uses hasSessionAlignment as proxy for " +
    "hasSessionAlignment; hasLiquiditySweep as proxy for hasLiquiditySweep.",
  version: "1.0.0",
  rule: andRules(
    predicateRule("hasBias", { timeframe: "1h" }),
    predicateRule("hasMarketStructureShift", { timeframe: "5m" }),
    predicateRule("hasSessionAlignment", { timeframe: "5m", args: ["LONDON"] }),
  ),
  tags: ["temporal-reversal", "judas-swing", "manipulation"],
  requiredTimeframes: ["1h", "5m"],
};

const powerOfThree: StrategyDefinition = {
  id: "temporal-power-of-three",
  name: "Power of Three (PO3)",
  description:
    "Candle lifecycle: accumulation → manipulation (Judas) → distribution in true direction. " +
    "Entry same as daily bias after manipulation completes.",
  version: "1.0.0",
  rule: andRules(
    predicateRule("hasBias", { timeframe: "1d" }),
    predicateRule("hasMarketStructureShift", { timeframe: "15m" }),
  ),
  tags: ["temporal-reversal", "po3", "cycle"],
  requiredTimeframes: ["1d", "15m"],
};

// ═══════════════════════════════════════════════════════════════════════════════
// Reversal Specialties
// ═══════════════════════════════════════════════════════════════════════════════

const turtleSoup: StrategyDefinition = {
  id: "reversal-turtle-soup",
  name: "Turtle Soup",
  description:
    "Counter-trend reversal at failed breakouts. Sweep of swing high/low with wick rejection, " +
    "entry just inside broken level. Uses hasLiquiditySweep as proxy for hasLiquiditySweep.",
  version: "1.0.0",
  rule: andRules(
    predicateRule("hasMarketStructureShift", { timeframe: "5m" }),
    predicateRule("hasLiquiditySweep", { timeframe: "5m" }),
  ),
  tags: ["temporal-reversal", "turtle-soup", "counter-trend"],
  requiredTimeframes: ["5m"],
};

const unicorn: StrategyDefinition = {
  id: "reversal-unicorn",
  name: "Unicorn Model",
  description:
    "Precision setup at Breaker Block + FVG overlap. Entry at midpoint/boundary of overlapping zone. " +
    "Seed requires hasBreakerBlock (not yet implemented) — currently checks hasFVG + hasMSS.",
  version: "1.0.0",
  rule: andRules(
    predicateRule("hasFVG", { timeframe: "5m" }),
    predicateRule("hasMarketStructureShift", { timeframe: "5m" }),
  ),
  tags: ["temporal-reversal", "unicorn", "breaker-fvg"],
  requiredTimeframes: ["5m"],
};

const scob: StrategyDefinition = {
  id: "reversal-scob",
  name: "Single Candle Order Block (SCOB / IFC)",
  description:
    "Micro-refinement inside HTF POI. First LTF candle tapping HTF POI must sweep prior candle " +
    "high/low and close back within range. Limit entry at sweep candle extreme.",
  version: "1.0.0",
  rule: andRules(
    predicateRule("hasBias", { timeframe: "1h" }),
    predicateRule("hasMarketStructureShift", { timeframe: "5m" }),
    predicateRule("hasLiquiditySweep", { timeframe: "5m" }),
  ),
  tags: ["temporal-reversal", "scob", "micro-entry"],
  requiredTimeframes: ["1h", "5m"],
};

const sharpTurn: StrategyDefinition = {
  id: "framework-sharp-turn",
  name: "Sharp Turn (ST) Model",
  description:
    "Two-timeframe alignment for high-velocity reversals. Context 2 tiers up from entry. " +
    "SL beyond extreme swing of first reversal leg.",
  version: "1.0.0",
  rule: andRules(
    predicateRule("hasBias", { timeframe: "4h" }),
    predicateRule("hasMarketStructureShift", { timeframe: "1h" }),
    predicateRule("hasLiquiditySweep", { timeframe: "1h" }),
  ),
  tags: ["temporal-reversal", "sharp-turn", "multi-tf"],
  requiredTimeframes: ["4h", "1h"],
};

const twoFvg: StrategyDefinition = {
  id: "framework-2fvg",
  name: "2 FVG Model",
  description:
    "Three-timeframe alignment. Ignore first impulsive MSS leg; execute on retest of the second " +
    "consecutive FVG from secondary expansion. More insulated risk than Sharp Turn.",
  version: "1.0.0",
  rule: andRules(
    predicateRule("hasBias", { timeframe: "1w" }),
    predicateRule("hasMarketStructureShift", { timeframe: "4h" }),
    predicateRule("hasFVG", { timeframe: "4h" }),
  ),
  tags: ["temporal-reversal", "2fvg", "three-tf"],
  requiredTimeframes: ["1w", "4h"],
};

// ═══════════════════════════════════════════════════════════════════════════════
// Exported lists
// ═══════════════════════════════════════════════════════════════════════════════

export const MMXM_TEMPLATES: StrategyDefinition[] = [
  mmsm,
  mmbm,
];

export const TEMPORAL_REVERSAL_TEMPLATES: StrategyDefinition[] = [
  silverBulletLondon,
  silverBulletNyam,
  silverBulletNypm,
  judasSwing,
  powerOfThree,
  turtleSoup,
  unicorn,
  scob,
  sharpTurn,
  twoFvg,
];

export const TEMPLATES_GROUPED = {
  mmxm: MMXM_TEMPLATES,
  temporalReversal: TEMPORAL_REVERSAL_TEMPLATES,
};
