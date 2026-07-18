/**
 * Strategies — public API barrel
 *
 * Exposes the strategy evaluation engine, registry, rule builder,
 * and template libraries for use by the api-server routes.
 *
 * Taxonomy v2: Exports new concept, pattern, horizon templates,
 * ontology types, and registry options.
 */

export { StrategyEvaluator } from "./evaluator";
export { StrategyRegistry } from "./registry";
export type { DetectionResult, DetectOptions } from "./registry";

export { ruleSchema, strategyDefinitionSchema, ontologyCategorySchema, modelPrioritySchema } from "./rules";
export type { Rule, StrategyDefinition, OntologyCategory, ModelPriority, InvalidationRule, ConfusionGuard, TemporalRules } from "./rules";
export { predicateRule, andRules, orRules, notRule, ONTOLOGY_CATEGORIES, MODEL_PRIORITIES } from "./rules";

export type { PredicateResult } from "./predicates";
export type { EconomicEvent } from "./predicates";

// Template exports
export { MODERN_CONFLUENCE_TEMPLATES, getModernConfluenceTemplate } from "./templates/modern-confluence";
export { CHARTER_BLUEPRINT_TEMPLATES, getCharterBlueprintTemplate } from "./templates/charter-blueprint";
export { CLASSICAL_HORIZON_TEMPLATES, getClassicalHorizonTemplate } from "./templates/classical-horizon";
export { MMXM_TEMPLATES, TEMPORAL_REVERSAL_TEMPLATES } from "./templates/mmxm-and-temporal";
export { CONCEPT_TEMPLATES, STRUCTURAL_PATTERN_TEMPLATES, TRADING_HORIZON_TEMPLATES } from "./templates/concepts-and-patterns";

// SMC-EVAL types & scoring
export type {
  SMCGroundTruth, SMCEvent, LiquidityTarget, ModelCandidate,
  TimeframeRelationship, ExecutionContext, EvaluationMetadata,
  ModelClassification, FailureFlag,
  StructuralAccuracyScore, ModelAlignmentScore, ConfluenceReasoningScore,
  TradePrecisionScore, HallucinationAvoidanceScore, SmcEvalScore,
  AiReasoningInput, SmcEvalEvaluationResult,
} from "./smc-eval-types";

export {
  scoreStructuralAccuracy,
  scoreModelAlignment,
  scoreConfluenceReasoning,
  scoreTradePrecision,
  scoreHallucinationAvoidance,
  computeSmcEvalScore,
  classifyModelMatch,
} from "./smc-eval-scoring";
