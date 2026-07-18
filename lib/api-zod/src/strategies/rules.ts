/**
 * Rule & Strategy Definition Zod Schemas
 *
 * Defines the Rule discriminated union for composing ICT/SMC predicates
 * into complex boolean trees, and the StrategyDefinition envelope that
 * wraps a rule tree with metadata for persistence in model_definitions.
 *
 * Taxonomy v2: Extended with SMC-EVAL ontology classification, priority,
 * invalidation rules, temporal constraints, confusion guards, and
 * prerequisite metadata.
 */

import { z } from "zod";

// ─── Rule Schema ─────────────────────────────────────────────────────────────

/**
 * Rule — recursive discriminated union.
 *
 *   predicate  → calls a single predicate function from predicates.ts.
 *                 `timeframe` selects which SmcReport in the map to use.
 *                 `args` are passed as additional positional arguments.
 *   and        → all sub-rules must match.
 *   or         → at least one sub-rule must match.
 *   not        → negates the wrapped rule.
 */
export const ruleSchema: z.ZodType<Rule> = z.lazy(() =>
  z.discriminatedUnion("type", [
    z.object({
      type: z.literal("predicate"),
      /** Name of the predicate function (matches export from predicates.ts). */
      predicate: z.string().min(1),
      /** Timeframe key to select a report from the evaluator's map. Omitted = default. */
      timeframe: z.string().optional(),
      /** Additional positional arguments passed after the report. */
      args: z.array(z.unknown()).optional(),
    }),
    z.object({
      type: z.literal("and"),
      rules: z.array(ruleSchema).min(1),
    }),
    z.object({
      type: z.literal("or"),
      rules: z.array(ruleSchema).min(1),
    }),
    z.object({
      type: z.literal("not"),
      rule: ruleSchema,
    }),
  ]),
);

export type Rule = {
  type: "predicate";
  predicate: string;
  timeframe?: string;
  args?: unknown[];
} | {
  type: "and";
  rules: Rule[];
} | {
  type: "or";
  rules: Rule[];
} | {
  type: "not";
  rule: Rule;
};

// ─── SMC-EVAL Taxonomy v2 types ─────────────────────────────────────────────

export const ONTOLOGY_CATEGORIES = [
  "CONCEPT",
  "STRUCTURAL_PATTERN",
  "EXECUTION_MODEL",
  "TEMPORAL_MODEL",
  "MARKET_CYCLE",
  "TRADING_HORIZON",
  "CURRICULUM",
] as const;

export type OntologyCategory = typeof ONTOLOGY_CATEGORIES[number];

export const MODEL_PRIORITIES = ["PRIMARY", "ALTERNATIVE", "INFORMATIONAL"] as const;
export type ModelPriority = typeof MODEL_PRIORITIES[number];

export const ontologyCategorySchema = z.enum(ONTOLOGY_CATEGORIES);
export const modelPrioritySchema = z.enum(MODEL_PRIORITIES);

// ─── Invalidation Rule ──────────────────────────────────────────────────────

export const invalidationRuleSchema = z.object({
  predicate: z.string().min(1),
  timeframe: z.string().optional(),
  args: z.array(z.unknown()).optional(),
  reason: z.string(),
});

export type InvalidationRule = z.infer<typeof invalidationRuleSchema>;

// ─── Confusion Guard ─────────────────────────────────────────────────────────

export const confusionGuardSchema = z.object({
  similarTo: z.string(),
  discriminator: z.string(),
  discriminatorArgs: z.array(z.unknown()).optional(),
});

export type ConfusionGuard = z.infer<typeof confusionGuardSchema>;

// ─── Temporal Rules ─────────────────────────────────────────────────────────

export const temporalRulesSchema = z.object({
  session: z.array(z.string()).optional(),
  window: z.object({ before: z.number(), after: z.number() }).optional(),
});

export type TemporalRules = z.infer<typeof temporalRulesSchema>;

// ─── StrategyDefinition Schema (Taxonomy v2) ───────────────────────────────

/**
 * StrategyDefinition — a named, versioned rule tree with metadata.
 *
 * Maps to the model_definitions table in the DB. All Taxonomy v2 fields
 * are optional — existing definitions without these fields remain valid.
 */
export const strategyDefinitionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().default(""),
  version: z.string().default("1.0.0"),
  /** The entry-point rule tree that defines the strategy. */
  rule: ruleSchema,
  /** Categorical tags for grouping / filtering. */
  tags: z.array(z.string()).default([]),
  /** Which timeframes this strategy expects in the report map. */
  requiredTimeframes: z.array(z.string()).default([]),

  // ── SMC-EVAL Taxonomy v2 (all optional) ─────────────────────────────────
  /** Ontology classification layer. */
  ontology: ontologyCategorySchema.optional(),
  /** Model priority for ranking. */
  priority: modelPrioritySchema.optional(),
  /** Invalidation rules — conditions that must not match. */
  invalidation: z.array(invalidationRuleSchema).optional(),
  /** Temporal/session constraints. */
  temporalRules: temporalRulesSchema.optional(),
  /** Confusion guards for discrimination. */
  confusionGuards: z.array(confusionGuardSchema).optional(),
  /** Prerequisite concept/predicate IDs. */
  prerequisites: z.array(z.string()).optional(),
});

export type StrategyDefinition = z.infer<typeof strategyDefinitionSchema>;

// ─── Convenience constructors ────────────────────────────────────────────────

export function predicateRule(
  predicate: string,
  opts?: { timeframe?: string; args?: unknown[] },
): Rule {
  return { type: "predicate", predicate, ...opts };
}

export function andRules(...rules: Rule[]): Rule {
  return { type: "and", rules };
}

export function orRules(...rules: Rule[]): Rule {
  return { type: "or", rules };
}

export function notRule(rule: Rule): Rule {
  return { type: "not", rule };
}
