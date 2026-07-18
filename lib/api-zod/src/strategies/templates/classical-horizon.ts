/**
 * Classical Horizon Models (2019) — Strategy Templates
 *
 * Encodes the 12 Classical Horizon models from the ICT/SMC taxonomy as
 * StrategyDefinition objects with rule trees.  Corresponds 1:1 with the
 * seed data (ids classical-01 through classical-12).
 *
 * Taxonomy v2 classification:
 *   - Models 1-4: TRADING_HORIZON (holding-period classifiers)
 *   - Models 5-7, 9-11: EXECUTION_MODEL (actual execution setups)
 *   - Model 8: TEMPORAL_MODEL (weekly-specific)
 *   - Model 12: CONCEPT (pure FVG-after-displacement pattern)
 */

import type { StrategyDefinition } from "../rules";
import { andRules, predicateRule } from "../rules";

// ─── Model 1: Intraday Scalping (TRADING_HORIZON) ──────────────────────────

const model1: StrategyDefinition = {
  id: "classical-01",
  name: "Model 1 — Intraday Scalping",
  description:
    "High-frequency intraday scalping, 20-day lookback on M5–M1. Targets session high/low " +
    "liquidity sweeps within NY/London open windows. Execution on fresh FVGs after displacement.",
  version: "1.0.0",
  ontology: "TRADING_HORIZON",
  priority: "INFORMATIONAL",
  rule: andRules(
    predicateRule("hasBias", { timeframe: "1h" }),
    predicateRule("hasFVG", { timeframe: "5m" }),
  ),
  tags: ["classical-horizon", "scalping", "intraday"],
  requiredTimeframes: ["1h", "5m"],
};

// ─── Model 2: Short-Term Trading (TRADING_HORIZON) ────────────────────────────

const model2: StrategyDefinition = {
  id: "classical-02",
  name: "Model 2 — Short-Term Trading",
  description:
    "Short-term trading on major forex and indices. H1 bias, M15–M5 entries at daily/4h " +
    "unmitigated POI zones targeting premium/discount inefficiencies.",
  version: "1.0.0",
  ontology: "TRADING_HORIZON",
  priority: "INFORMATIONAL",
  rule: andRules(
    predicateRule("hasBias", { timeframe: "1h" }),
    predicateRule("hasMarketStructureShift", { timeframe: "15m" }),
    predicateRule("hasOrderBlock", { timeframe: "15m" }),
  ),
  tags: ["classical-horizon", "short-term", "poi"],
  requiredTimeframes: ["1h", "15m"],
};

// ─── Model 3: Swing Trading (TRADING_HORIZON) ─────────────────────────────────

const model3: StrategyDefinition = {
  id: "classical-03",
  name: "Model 3 — Swing Trading",
  description:
    "Swing trading commodities and major forex. Combines COT data with daily liquidity setups " +
    "and OTE zones. Daily/H4 bias with H1 entry.",
  version: "1.0.0",
  ontology: "TRADING_HORIZON",
  priority: "INFORMATIONAL",
  rule: andRules(
    predicateRule("hasBias", { timeframe: "1d" }),
    predicateRule("hasLiquiditySweep", { timeframe: "1d" }),
    predicateRule("priceWithinOTEzone", { timeframe: "1h", args: ["bullish"] }),
  ),
  tags: ["classical-horizon", "swing", "ote"],
  requiredTimeframes: ["1d", "1h"],
};

// ─── Model 4: Position Trading (TRADING_HORIZON) ──────────────────────────────

const model4: StrategyDefinition = {
  id: "classical-04",
  name: "Model 4 — Position Trading",
  description:
    "Multi-month position trading. Quarterly structural shifts, seasonal tendencies, " +
    "intermarket correlation matrices. Monthly/weekly bias with daily entry.",
  version: "1.0.0",
  ontology: "TRADING_HORIZON",
  priority: "INFORMATIONAL",
  rule: predicateRule("hasBias", { timeframe: "1w" }),
  tags: ["classical-horizon", "position", "macro"],
  requiredTimeframes: ["1w"],
};

// ─── Model 5: Advanced Session Setup (EXECUTION_MODEL) ────────────────────────

const model5: StrategyDefinition = {
  id: "classical-05",
  name: "Model 5 — Advanced Session Setup",
  description:
    "Day trading weekdays only. Std dev extensions of daily manipulation leg targeting " +
    "precise expansion points. M15–M5 entry within session killzones.",
  version: "1.0.0",
  ontology: "EXECUTION_MODEL",
  priority: "ALTERNATIVE",
  rule: andRules(
    predicateRule("hasBias", { timeframe: "1h" }),
    predicateRule("hasMarketStructureShift", { timeframe: "15m" }),
  ),
  tags: ["classical-horizon", "session", "stddev"],
  requiredTimeframes: ["1h", "15m"],
};

// ─── Model 6: Universal Buy Model (EXECUTION_MODEL) ───────────────────────────

const model6: StrategyDefinition = {
  id: "classical-06",
  name: "Model 6 — Universal Buy Model",
  description:
    "Multi-asset buyside expansion. Discount-zone entries after sellside liquidity sweeps.",
  version: "1.0.0",
  ontology: "EXECUTION_MODEL",
  priority: "ALTERNATIVE",
  rule: andRules(
    predicateRule("hasBias", { timeframe: "4h" }),
    predicateRule("hasLiquiditySweep", { timeframe: "4h" }),
    predicateRule("hasMarketStructureShift", { timeframe: "15m" }),
  ),
  tags: ["classical-horizon", "universal", "buyside"],
  requiredTimeframes: ["4h", "15m"],
};

// ─── Model 7: Universal Sell Model (EXECUTION_MODEL) ──────────────────────────

const model7: StrategyDefinition = {
  id: "classical-07",
  name: "Model 7 — Universal Sell Model",
  description:
    "Multi-asset sellside expansion. Premium-zone entries after buyside liquidity sweeps.",
  version: "1.0.0",
  ontology: "EXECUTION_MODEL",
  priority: "ALTERNATIVE",
  rule: andRules(
    predicateRule("hasBias", { timeframe: "4h" }),
    predicateRule("hasLiquiditySweep", { timeframe: "4h" }),
    predicateRule("hasMarketStructureShift", { timeframe: "15m" }),
  ),
  tags: ["classical-horizon", "universal", "sellside"],
  requiredTimeframes: ["4h", "15m"],
};

// ─── Model 8: Weekly Range Strategy (TEMPORAL_MODEL) ──────────────────────────

const model8: StrategyDefinition = {
  id: "classical-08",
  name: "Model 8 — Weekly Range Strategy",
  description:
    "Major forex pairs. Captures weekly expansions by anticipating weekly high/low between " +
    "Mon–Wed. Weekly context with H1 entry.",
  version: "1.0.0",
  ontology: "TEMPORAL_MODEL",
  priority: "ALTERNATIVE",
  rule: predicateRule("hasBias", { timeframe: "4h" }),
  tags: ["classical-horizon", "weekly", "range"],
  requiredTimeframes: ["4h"],
};

// ─── Model 9: One Shot One Kill (EXECUTION_MODEL) ─────────────────────────────

const model9: StrategyDefinition = {
  id: "classical-09",
  name: "Model 9 — One Shot One Kill (OSOK)",
  description:
    "Weekly position trading — single largest high-probability leg of the week. " +
    "Daily bias, H1/M15 entry, minimum 1:3 R:R.",
  version: "1.0.0",
  ontology: "EXECUTION_MODEL",
  priority: "PRIMARY",
  rule: andRules(
    predicateRule("hasBias", { timeframe: "1d" }),
    predicateRule("hasMarketStructureShift", { timeframe: "1h" }),
    predicateRule("hasLiquiditySweep", { timeframe: "1h" }),
  ),
  tags: ["classical-horizon", "osok", "high-conviction"],
  requiredTimeframes: ["1d", "1h"],
};

// ─── Model 10: Swing Stalking (EXECUTION_MODEL) ───────────────────────────────

const model10: StrategyDefinition = {
  id: "classical-10",
  name: "Model 10 — Swing Stalking",
  description:
    "Day-to-swing trading — 50–75 pips/week by exploiting external range liquidity runs.",
  version: "1.0.0",
  ontology: "EXECUTION_MODEL",
  priority: "ALTERNATIVE",
  rule: andRules(
    predicateRule("hasBias", { timeframe: "1d" }),
    predicateRule("hasLiquiditySweep", { timeframe: "1h" }),
  ),
  tags: ["classical-horizon", "swing-stalking", "range"],
  requiredTimeframes: ["1d", "1h"],
};

// ─── Model 11: Daily Range Scalping (EXECUTION_MODEL) ─────────────────────────

const model11: StrategyDefinition = {
  id: "classical-11",
  name: "Model 11 — Daily Range Scalping",
  description:
    "Scalping indices and forex on M15–M5. Daily range expansion + OB retests in session killzones.",
  version: "1.0.0",
  ontology: "EXECUTION_MODEL",
  priority: "ALTERNATIVE",
  rule: andRules(
    predicateRule("hasBias", { timeframe: "1h" }),
    predicateRule("hasOrderBlock", { timeframe: "15m" }),
  ),
  tags: ["classical-horizon", "scalping", "ob"],
  requiredTimeframes: ["1h", "15m"],
};

// ─── Model 12: Core Scalping Model (CONCEPT) ─────────────────────────────────

const model12: StrategyDefinition = {
  id: "classical-12",
  name: "Model 12 — Core Scalping Model",
  description:
    "Scalping highly liquid assets on M5–M1. Fixed 20 pip target by entering fresh FVGs " +
    "after displacement.",
  version: "1.0.0",
  ontology: "CONCEPT",
  priority: "INFORMATIONAL",
  rule: predicateRule("hasFVG", { timeframe: "5m" }),
  tags: ["classical-horizon", "scalping", "fvg"],
  requiredTimeframes: ["5m"],
};

// ─── Exported list ───────────────────────────────────────────────────────────

export const CLASSICAL_HORIZON_TEMPLATES: StrategyDefinition[] = [
  model1,  model2,  model3,  model4,
  model5,  model6,  model7,  model8,
  model9,  model10, model11, model12,
];

export function getClassicalHorizonTemplate(
  id: string,
): StrategyDefinition | undefined {
  return CLASSICAL_HORIZON_TEMPLATES.find((t) => t.id === id);
}
