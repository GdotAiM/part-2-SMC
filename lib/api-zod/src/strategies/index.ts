/**
 * Strategies — public API barrel
 *
 * Exposes the strategy evaluation engine, registry, rule builder,
 * and template libraries for use by the api-server routes.
 */

export { StrategyEvaluator } from "./evaluator";
export { StrategyRegistry } from "./registry";
export type { DetectionResult } from "./registry";

export { ruleSchema, strategyDefinitionSchema } from "./rules";
export type { Rule, StrategyDefinition } from "./rules";
export { predicateRule, andRules, orRules, notRule } from "./rules";

export type { PredicateResult } from "./predicates";

export { MODERN_CONFLUENCE_TEMPLATES, getModernConfluenceTemplate } from "./templates/modern-confluence";
export { CHARTER_BLUEPRINT_TEMPLATES, getCharterBlueprintTemplate } from "./templates/charter-blueprint";
export { CLASSICAL_HORIZON_TEMPLATES, getClassicalHorizonTemplate } from "./templates/classical-horizon";
export { MMXM_TEMPLATES, TEMPORAL_REVERSAL_TEMPLATES } from "./templates/mmxm-and-temporal";
