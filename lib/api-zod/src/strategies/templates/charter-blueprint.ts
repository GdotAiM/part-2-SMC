/**
 * Charter Price Action Blueprint — Strategy Templates
 *
 * Encodes the 12 Charter Blueprint models from the ICT/SMC taxonomy as
 * StrategyDefinition objects with rule trees.  These correspond 1:1 with
 * the seed data in lib/db/seeds/model-definitions.ts (ids charter-01
 * through charter-12).
 *
 * All predicates referenced by the seed are now implemented.
 * See predicates.ts for the full list of 21 functions.
 */

import type { StrategyDefinition } from "../rules";
import { andRules, predicateRule, orRules } from "../rules";

// ─── Model 1: Market Structure ───────────────────────────────────────────────

const model1: StrategyDefinition = {
  id: "charter-01",
  name: "Charter Model 1 — Market Structure",
  description:
    "Foundational mechanics of price delivery — swing point identification, HH/HL/LH/LL mapping. " +
    "Trains the analyst to read market structure as the primary filter.",
  version: "1.0.0",
  rule: andRules(
    predicateRule("hasBias", { timeframe: "4h" }),
    predicateRule("hasMarketStructureShift", { timeframe: "4h" }),
  ),
  tags: ["charter-blueprint", "foundations", "structure"],
  requiredTimeframes: ["4h"],
};

// ─── Model 2: Fair Value Gaps ────────────────────────────────────────────────

const model2: StrategyDefinition = {
  id: "charter-02",
  name: "Charter Model 2 — Fair Value Gaps",
  description:
    "Mechanics of FVGs — imbalance identification, fill fraction analysis, inversion mechanics. " +
    "Seed also requires hasDisplacement (not yet implemented).",
  version: "1.0.0",
  rule: predicateRule("hasFVG", { timeframe: "4h" }),
  tags: ["charter-blueprint", "foundations", "fvg"],
  requiredTimeframes: ["4h"],
};

// ─── Model 3: Order Blocks ───────────────────────────────────────────────────

const model3: StrategyDefinition = {
  id: "charter-03",
  name: "Charter Model 3 — Order Blocks",
  description:
    "Structural identification of OBs as institutional footprint zones. Covers valid vs mitigated, " +
    "breaker blocks, strength scoring, and OB+FVG overlap.",
  version: "1.0.0",
  rule: predicateRule("hasOrderBlock", { timeframe: "4h" }),
  tags: ["charter-blueprint", "foundations", "order-block"],
  requiredTimeframes: ["4h"],
};

// ─── Model 4: Liquidity Runs ─────────────────────────────────────────────────

const model4: StrategyDefinition = {
  id: "charter-04",
  name: "Charter Model 4 — Liquidity Runs",
  description:
    "Synthesis of structure + liquidity — how institutions target BSL above swing highs and SSL " +
    "below swing lows. Uses hasLiquiditySweep as a proxy for hasLiquiditySweep (not yet implemented).",
  version: "1.0.0",
  rule: andRules(
    predicateRule("hasLiquiditySweep", { timeframe: "4h" }),
    predicateRule("hasMarketStructureShift", { timeframe: "4h" }),
  ),
  tags: ["charter-blueprint", "liquidity", "structure"],
  requiredTimeframes: ["4h"],
};

// ─── Model 5: Bias & Direction ───────────────────────────────────────────────

const model5: StrategyDefinition = {
  id: "charter-05",
  name: "Charter Model 5 — Bias & Direction",
  description:
    "Daily and weekly bias determination using HTF structure, PD Array positioning, daily bias strength, " +
    "and session context. Primary filter for all lower-timeframe entries.",
  version: "1.0.0",
  rule: orRules(
    predicateRule("hasDailyBias", { timeframe: "1d" }),
    predicateRule("hasBias", { timeframe: "4h" }),
  ),
  tags: ["charter-blueprint", "bias", "direction"],
  requiredTimeframes: ["1d", "4h"],
};

// ─── Model 6: Weekly Range Expansion ─────────────────────────────────────────

const model6: StrategyDefinition = {
  id: "charter-06",
  name: "Charter Model 6 — Weekly Range Expansion",
  description:
    "Aligns trades with the broader weekly cycle using weekly open anchor and Monday/Tuesday bias. " +
    "Seed also requires hasRangeExpansion and hasWeeklyExpansionContext (not yet implemented).",
  version: "1.0.0",
  rule: predicateRule("hasBias", { timeframe: "4h" }),
  tags: ["charter-blueprint", "weekly", "range-expansion"],
  requiredTimeframes: ["4h"],
};

// ─── Model 7: Intraday Trading Techniques ─────────────────────────────────────

const model7: StrategyDefinition = {
  id: "charter-07",
  name: "Charter Model 7 — Intraday Trading Techniques",
  description:
    "Session-based execution (Asian, London, NY overlap) with killzone identification. " +
    "Aligns intraday entry triggers with daily bias. Uses hasSessionAlignment as a proxy " +
    "for hasSessionAlignment.",
  version: "1.0.0",
  rule: andRules(
    predicateRule("hasBias", { timeframe: "1h" }),
    predicateRule("hasMarketStructureShift", { timeframe: "15m" }),
    predicateRule("hasSessionAlignment", { timeframe: "15m", args: ["LONDON"] }),
  ),
  tags: ["charter-blueprint", "intraday", "session"],
  requiredTimeframes: ["1h", "15m"],
};

// ─── Model 8: Advanced Entry Techniques ──────────────────────────────────────

const model8: StrategyDefinition = {
  id: "charter-08",
  name: "Charter Model 8 — Advanced Entry Techniques",
  description:
    "High-probability confluence stacking: FVGs within OBs, OBs within PD Array zones, " +
    "liquidity sweeps tapping multiple POI levels simultaneously.",
  version: "1.0.0",
  rule: andRules(
    predicateRule("hasBias", { timeframe: "4h" }),
    predicateRule("hasMarketStructureShift", { timeframe: "15m" }),
    predicateRule("hasFVG", { timeframe: "15m" }),
    predicateRule("hasOrderBlock", { timeframe: "15m" }),
  ),
  tags: ["charter-blueprint", "advanced-entry", "confluence"],
  requiredTimeframes: ["4h", "15m"],
};

// ─── Model 9: One Shot One Kill ──────────────────────────────────────────────

const model9: StrategyDefinition = {
  id: "charter-09",
  name: "Charter Model 9 — One Shot One Kill Strategy",
  description:
    "Single highest-conviction setup per day/week. HTF bias + LTF liquidity sweep + MSS + displacement. " +
    "Minimum 1:3 R:R. Uses hasLiquiditySweep as proxy for hasLiquiditySweep (not yet implemented).",
  version: "1.0.0",
  rule: andRules(
    predicateRule("hasBias", { timeframe: "1d" }),
    predicateRule("hasMarketStructureShift", { timeframe: "1h" }),
    predicateRule("hasLiquiditySweep", { timeframe: "1h" }),
  ),
  tags: ["charter-blueprint", "osok", "high-conviction"],
  requiredTimeframes: ["1d", "1h"],
};

// ─── Model 10: Dealing Ranges & Premium/Discount ─────────────────────────────

const model10: StrategyDefinition = {
  id: "charter-10",
  name: "Charter Model 10 — Dealing Ranges & Premium/Discount",
  description:
    "PD Array matrix discipline: buy only in discount (below equilibrium), sell only in premium " +
    "(above equilibrium). Uses dealing range high/low and equilibrium as reference.",
  version: "1.0.0",
  rule: predicateRule("hasBias", { timeframe: "1d" }),
  tags: ["charter-blueprint", "pd-array", "premium-discount"],
  requiredTimeframes: ["1d"],
};

// ─── Model 11: Scalping Techniques ───────────────────────────────────────────

const model11: StrategyDefinition = {
  id: "charter-11",
  name: "Charter Model 11 — Scalping Techniques",
  description:
    "Scalping within daily range boundaries using micro-structure shifts in session killzones. " +
    "Seed also requires hasRangeExpansion and hasSessionAlignment (not yet implemented).",
  version: "1.0.0",
  rule: andRules(
    predicateRule("hasBias", { timeframe: "1h" }),
    predicateRule("hasMarketStructureShift", { timeframe: "5m" }),
  ),
  tags: ["charter-blueprint", "scalping", "micro-structure"],
  requiredTimeframes: ["1h", "5m"],
};

// ─── Model 12: Algorithmic Theory (IPDA) ─────────────────────────────────────

const model12: StrategyDefinition = {
  id: "charter-12",
  name: "Charter Model 12 — Algorithmic Theory (IPDA)",
  description:
    "Unified market narrative framework — IPDA time-based price delivery cycles of accumulation, " +
    "manipulation, and distribution across all timeframes simultaneously.",
  version: "1.0.0",
  rule: andRules(
    predicateRule("hasBias", { timeframe: "1d" }),
    predicateRule("hasMarketStructureShift", { timeframe: "4h" }),
  ),
  tags: ["charter-blueprint", "ipda", "synthesis"],
  requiredTimeframes: ["1d", "4h"],
};

// ─── Exported list ───────────────────────────────────────────────────────────

export const CHARTER_BLUEPRINT_TEMPLATES: StrategyDefinition[] = [
  model1,  model2,  model3,  model4,
  model5,  model6,  model7,  model8,
  model9,  model10, model11, model12,
];

export function getCharterBlueprintTemplate(
  id: string,
): StrategyDefinition | undefined {
  return CHARTER_BLUEPRINT_TEMPLATES.find((t) => t.id === id);
}
