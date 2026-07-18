/**
 * Modern Step-by-Step Confluence Models — Strategy Templates
 *
 * Encodes the 5 Modern Confluence Models from the ICT/SMC taxonomy as
 * StrategyDefinition objects with rule trees.  These correspond 1:1 with
 * the seed data in lib/db/seeds/model-definitions.ts (ids smc-confluence-1
 * through smc-confluence-5).
 *
 * Predicate → timeframe convention:
 *   "4h" — HTF context (bias, structure, liquidity, consolidation)
 *   "5m" — LTF entry triggers (FVG, inducement, MSS, OTE)
 *
 * All parameters from the seed are stored in the template metadata so the
 * registry can expose them for UI / parameter-override flows.
 */

import type { StrategyDefinition } from "../rules";
import { andRules, predicateRule } from "../rules";

// ─── Helper ──────────────────────────────────────────────────────────────────

interface ParamDef {
  key: string;
  label: string;
  type: "number" | "string" | "boolean" | "select";
  default: unknown;
  min?: number;
  max?: number;
  options?: string[];
}

function param(
  key: string,
  label: string,
  type: "number" | "string" | "boolean" | "select",
  defaultVal: unknown,
  opts?: { min?: number; max?: number; options?: string[] },
): ParamDef {
  return { key, label, type, default: defaultVal, ...opts };
}

// ─── Model 1 ─────────────────────────────────────────────────────────────────

const model1: StrategyDefinition = {
  id: "smc-confluence-1",
  name: "HTF POI + BOS + FVG",
  description:
    "Foundational confluence model. HTF bias setter with LTF MSS + FVG on entry timeframe.",
  version: "1.0.0",
  ontology: "EXECUTION_MODEL",
  priority: "PRIMARY",
  rule: andRules(
    predicateRule("hasBias", { timeframe: "4h" }),
    predicateRule("hasMarketStructureShift", { timeframe: "5m" }),
    predicateRule("hasFVG", { timeframe: "5m" }),
  ),
  tags: ["modern-confluence", "entry"],
  requiredTimeframes: ["4h", "5m"],
};

// ─── Model 2 ─────────────────────────────────────────────────────────────────

const model2: StrategyDefinition = {
  id: "smc-confluence-2",
  name: "HTF POI + BOS + IDM + FVG",
  description:
    "Adds an inducement (IDM) filter. Price must first sweep internal inducement liquidity before entering at the FVG.",
  version: "1.0.0",
  ontology: "EXECUTION_MODEL",
  priority: "PRIMARY",
  rule: andRules(
    predicateRule("hasBias", { timeframe: "4h" }),
    predicateRule("hasMarketStructureShift", { timeframe: "5m" }),
    predicateRule("hasInducementZone", { timeframe: "5m" }),
    predicateRule("hasFVG", { timeframe: "5m" }),
  ),
  tags: ["modern-confluence", "entry", "inducement"],
  requiredTimeframes: ["4h", "5m"],
};

// ─── Model 3 ─────────────────────────────────────────────────────────────────

const model3: StrategyDefinition = {
  id: "smc-confluence-3",
  name: "HTF POI + BOS + FVG + OTE",
  description:
    "Integrates OTE zone with Model 1. Entry only when an unfilled FVG overlaps the 62%–79% retracement level.",
  version: "1.0.0",
  ontology: "EXECUTION_MODEL",
  priority: "PRIMARY",
  rule: andRules(
    predicateRule("hasBias", { timeframe: "4h" }),
    predicateRule("hasMarketStructureShift", { timeframe: "5m" }),
    predicateRule("hasFVG", { timeframe: "5m" }),
    predicateRule("priceWithinOTEzone", { timeframe: "5m" }),
  ),
  tags: ["modern-confluence", "entry", "ote"],
  requiredTimeframes: ["4h", "5m"],
};

// ─── Model 4 ─────────────────────────────────────────────────────────────────

const model4: StrategyDefinition = {
  id: "smc-confluence-4",
  name: "HTF POI + BOS + IDM + FVG + OTE",
  description:
    "Highest confluence: inducement sweep + FVG + OTE. Lowest frequency, highest win-rate.",
  version: "1.0.0",
  ontology: "EXECUTION_MODEL",
  priority: "PRIMARY",
  rule: andRules(
    predicateRule("hasBias", { timeframe: "4h" }),
    predicateRule("hasMarketStructureShift", { timeframe: "5m" }),
    predicateRule("hasInducementZone", { timeframe: "5m" }),
    predicateRule("hasFVG", { timeframe: "5m" }),
    predicateRule("priceWithinOTEzone", { timeframe: "5m" }),
  ),
  tags: ["modern-confluence", "entry", "inducement", "ote"],
  requiredTimeframes: ["4h", "5m"],
};

// ─── Model 5 ─────────────────────────────────────────────────────────────────

const model5: StrategyDefinition = {
  id: "smc-confluence-5",
  name: "Five Box Setup",
  description:
    "Multi-stage session model. Consolidation → engineered equal highs/lows → sweep → rejection → entry.",
  version: "1.0.0",
  ontology: "EXECUTION_MODEL",
  priority: "PRIMARY",
  rule: andRules(
    predicateRule("hasBias", { timeframe: "4h" }),
    predicateRule("hasConsolidationZone", { timeframe: "4h" }),
    predicateRule("hasMarketStructureShift", { timeframe: "5m" }),
    predicateRule("hasEqualHighsLows", { timeframe: "4h" }),
  ),
  tags: ["modern-confluence", "reversal", "consolidation"],
  requiredTimeframes: ["4h", "5m"],
};

// ─── Exported list ───────────────────────────────────────────────────────────

/**
 * Built-in template registry for the 5 Modern Confluence Models.
 */
export const MODERN_CONFLUENCE_TEMPLATES: StrategyDefinition[] = [
  model1,
  model2,
  model3,
  model4,
  model5,
];

/**
 * Look up a template by id.
 */
export function getModernConfluenceTemplate(
  id: string,
): StrategyDefinition | undefined {
  return MODERN_CONFLUENCE_TEMPLATES.find((t) => t.id === id);
}
