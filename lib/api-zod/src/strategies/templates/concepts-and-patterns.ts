/**
 * SMC-EVAL Primitive Concepts & Structural Patterns — Strategy Templates
 *
 * These are NOT tradeable execution models. They serve as the foundational
 * ontology layer for SMC-EVAL benchmark evaluation:
 *
 *   CONCEPT — primitive market concepts
 *   STRUCTURAL_PATTERN — composite events formed from multiple concepts
 *
 * All are marked priority: INFORMATIONAL so they don't appear in
 * detectAll() execution results by default.
 */

import type { StrategyDefinition } from "../rules";
import { predicateRule } from "../rules";

// ═══════════════════════════════════════════════════════════════════════════════
// CONCEPTS (Primitive)
// ═══════════════════════════════════════════════════════════════════════════════

const conceptFvg: StrategyDefinition = {
  id: "concept-fvg",
  name: "Fair Value Gap",
  description: "Price imbalance between three consecutive candles where the wicks fail to overlap. Acts as a liquidity magnet that price is expected to return to and fill.",
  version: "1.0.0",
  ontology: "CONCEPT",
  priority: "INFORMATIONAL",
  rule: predicateRule("hasFVG"),
  tags: ["smc-eval", "concept", "fvg"],
  requiredTimeframes: [],
};

const conceptBOS: StrategyDefinition = {
  id: "concept-bos",
  name: "Break of Structure",
  description: "Price breaks through a previous swing high (bullish BOS) or swing low (bearish BOS), indicating directional momentum.",
  version: "1.0.0",
  ontology: "CONCEPT",
  priority: "INFORMATIONAL",
  rule: predicateRule("hasMarketStructureShift"),
  tags: ["smc-eval", "concept", "bos"],
  requiredTimeframes: [],
};

const conceptMSS: StrategyDefinition = {
  id: "concept-mss",
  name: "Market Structure Shift",
  description: "A sequence of pivots that breaks the prior trend structure — an HH→LH transition (bearish MSS) or LL→HL transition (bullish MSS).",
  version: "1.0.0",
  ontology: "CONCEPT",
  priority: "INFORMATIONAL",
  rule: predicateRule("hasMarketStructureShift"),
  tags: ["smc-eval", "concept", "mss"],
  requiredTimeframes: [],
};

const conceptOB: StrategyDefinition = {
  id: "concept-ob",
  name: "Order Block",
  description: "A footprint zone of institutional orders — the last candle before a strong displacement move. Represents the price level where institutions entered positions.",
  version: "1.0.0",
  ontology: "CONCEPT",
  priority: "INFORMATIONAL",
  rule: predicateRule("hasOrderBlock"),
  tags: ["smc-eval", "concept", "ob"],
  requiredTimeframes: [],
};

const conceptLiquidity: StrategyDefinition = {
  id: "concept-liquidity",
  name: "Liquidity Pool",
  description: "Clusters of resting stop orders above swing highs (BSL / buy-side liquidity) or below swing lows (SSL / sell-side liquidity). Primary target for institutional price delivery.",
  version: "1.0.0",
  ontology: "CONCEPT",
  priority: "INFORMATIONAL",
  rule: predicateRule("hasLiquidityPool"),
  tags: ["smc-eval", "concept", "liquidity"],
  requiredTimeframes: [],
};

const conceptSMT: StrategyDefinition = {
  id: "concept-smt",
  name: "SMT Divergence",
  description: "Smart Money Technique — divergence between two correlated assets at a key structural level. One asset makes a new high/low while the other fails to confirm, revealing institutional divergence.",
  version: "1.0.0",
  ontology: "CONCEPT",
  priority: "INFORMATIONAL",
  rule: predicateRule("hasSMTConfirmation"),
  tags: ["smc-eval", "concept", "smt"],
  requiredTimeframes: [],
};

const conceptOTE: StrategyDefinition = {
  id: "concept-ote",
  name: "Optimal Trade Entry",
  description: "The 62%–79% Fibonacci retracement zone measured from the displacement leg. Price entering this zone maximizes mathematical expectancy.",
  version: "1.0.0",
  ontology: "CONCEPT",
  priority: "INFORMATIONAL",
  rule: predicateRule("priceWithinOTEzone"),
  tags: ["smc-eval", "concept", "ote"],
  requiredTimeframes: [],
};

const conceptPremium: StrategyDefinition = {
  id: "concept-premium",
  name: "Premium Zone",
  description: "The upper half of the dealing range (above equilibrium). Institutions sell into premium. Retail buys at premium = trapped.",
  version: "1.0.0",
  ontology: "CONCEPT",
  priority: "INFORMATIONAL",
  rule: predicateRule("hasConsolidationZone"),
  tags: ["smc-eval", "concept", "premium"],
  requiredTimeframes: [],
};

// ═══════════════════════════════════════════════════════════════════════════════
// STRUCTURAL PATTERNS (Composite)
// ═══════════════════════════════════════════════════════════════════════════════

const patternLiquiditySweep: StrategyDefinition = {
  id: "pattern-liquidity-sweep",
  name: "Liquidity Sweep",
  description: "Price temporarily moves beyond a known liquidity level (BSL/SSL/EQH/EQL) to trigger resting stops, then reverses sharply. The sweep provides fuel for the institutional move.",
  version: "1.0.0",
  ontology: "STRUCTURAL_PATTERN",
  priority: "INFORMATIONAL",
  rule: predicateRule("hasLiquiditySweep"),
  tags: ["smc-eval", "structural-pattern", "liquidity-sweep"],
  requiredTimeframes: [],
};

const patternDisplacement: StrategyDefinition = {
  id: "pattern-displacement",
  name: "Displacement",
  description: "A strong, high-velocity directional candle with a body that significantly exceeds the average true range. Indicates aggressive institutional participation.",
  version: "1.0.0",
  ontology: "STRUCTURAL_PATTERN",
  priority: "INFORMATIONAL",
  rule: predicateRule("hasDisplacement"),
  tags: ["smc-eval", "structural-pattern", "displacement"],
  requiredTimeframes: [],
};

const patternInducement: StrategyDefinition = {
  id: "pattern-inducement",
  name: "Inducement (IDM)",
  description: "A minor internal consolidation or counter-trend pivot within a larger displacement leg. Traps retail into premature entries, then gets swept before the true continuation.",
  version: "1.0.0",
  ontology: "STRUCTURAL_PATTERN",
  priority: "INFORMATIONAL",
  rule: predicateRule("hasInducementZone"),
  tags: ["smc-eval", "structural-pattern", "inducement"],
  requiredTimeframes: [],
};

const patternBreaker: StrategyDefinition = {
  id: "pattern-breaker",
  name: "Breaker Formation",
  description: "An order block that has been broken with strong displacement, then fails as support/resistance. Traps breakout traders on the wrong side.",
  version: "1.0.0",
  ontology: "STRUCTURAL_PATTERN",
  priority: "INFORMATIONAL",
  rule: predicateRule("hasBreakerBlock"),
  tags: ["smc-eval", "structural-pattern", "breaker"],
  requiredTimeframes: [],
};

const patternRangeExpansion: StrategyDefinition = {
  id: "pattern-range-expansion",
  name: "Range Expansion",
  description: "A directional move that extends beyond the established range boundaries, characterized by expansion phase, aligned BOS breaks, and trending structure.",
  version: "1.0.0",
  ontology: "STRUCTURAL_PATTERN",
  priority: "INFORMATIONAL",
  rule: predicateRule("hasRangeExpansion"),
  tags: ["smc-eval", "structural-pattern", "range-expansion"],
  requiredTimeframes: [],
};

const patternConsolidation: StrategyDefinition = {
  id: "pattern-consolidation",
  name: "Consolidation Zone",
  description: "Price ranging within a defined area, building equal highs/lows and engineering liquidity. Precedes the next expansion phase.",
  version: "1.0.0",
  ontology: "STRUCTURAL_PATTERN",
  priority: "INFORMATIONAL",
  rule: predicateRule("hasConsolidationZone"),
  tags: ["smc-eval", "structural-pattern", "consolidation"],
  requiredTimeframes: [],
};

// ═══════════════════════════════════════════════════════════════════════════════
// TRADING HORIZONS
// ═══════════════════════════════════════════════════════════════════════════════

const horizonScalping: StrategyDefinition = {
  id: "horizon-scalping",
  name: "Scalping Horizon",
  description: "Fast-paced trading on M1–M5 timeframes. Positions held seconds to minutes. Targets small price movements (10–20 pips). Requires high precision entries.",
  version: "1.0.0",
  ontology: "TRADING_HORIZON",
  priority: "INFORMATIONAL",
  rule: { type: "predicate", predicate: "hasBias" },
  tags: ["smc-eval", "horizon", "scalping"],
  requiredTimeframes: ["1m", "5m"],
};

const horizonIntraday: StrategyDefinition = {
  id: "horizon-intraday",
  name: "Intraday Horizon",
  description: "Trading within a single day on M15–H1 timeframes. Positions held minutes to hours. Targets daily range expansions and session liquidity moves.",
  version: "1.0.0",
  ontology: "TRADING_HORIZON",
  priority: "INFORMATIONAL",
  rule: { type: "predicate", predicate: "hasBias" },
  tags: ["smc-eval", "horizon", "intraday"],
  requiredTimeframes: ["15m", "1h"],
};

const horizonSwing: StrategyDefinition = {
  id: "horizon-swing",
  name: "Swing Horizon",
  description: "Multi-day position holding on H4–D1 timeframes. Positions held days to weeks. Targets larger structural moves and liquidity draws across weekly ranges.",
  version: "1.0.0",
  ontology: "TRADING_HORIZON",
  priority: "INFORMATIONAL",
  rule: { type: "predicate", predicate: "hasBias" },
  tags: ["smc-eval", "horizon", "swing"],
  requiredTimeframes: ["4h", "1d"],
};

const horizonPosition: StrategyDefinition = {
  id: "horizon-position",
  name: "Position Horizon",
  description: "Long-term holding on D1–W1 timeframes. Positions held weeks to months. Targets macro structural shifts, quarterly pivots, and intermarket correlations.",
  version: "1.0.0",
  ontology: "TRADING_HORIZON",
  priority: "INFORMATIONAL",
  rule: { type: "predicate", predicate: "hasBias" },
  tags: ["smc-eval", "horizon", "position"],
  requiredTimeframes: ["1d", "1w"],
};

// ═══════════════════════════════════════════════════════════════════════════════
// Exported lists
// ═══════════════════════════════════════════════════════════════════════════════

export const CONCEPT_TEMPLATES: StrategyDefinition[] = [
  conceptFvg,
  conceptBOS,
  conceptMSS,
  conceptOB,
  conceptLiquidity,
  conceptSMT,
  conceptOTE,
  conceptPremium,
];

export const STRUCTURAL_PATTERN_TEMPLATES: StrategyDefinition[] = [
  patternLiquiditySweep,
  patternDisplacement,
  patternInducement,
  patternBreaker,
  patternRangeExpansion,
  patternConsolidation,
];

export const TRADING_HORIZON_TEMPLATES: StrategyDefinition[] = [
  horizonScalping,
  horizonIntraday,
  horizonSwing,
  horizonPosition,
];
