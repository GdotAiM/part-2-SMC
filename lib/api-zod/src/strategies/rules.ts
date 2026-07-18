/**
 * Rule & Strategy Definition Zod Schemas
 *
 * Defines the Rule discriminated union for composing ICT/SMC predicates
 * into complex boolean trees, and the StrategyDefinition envelope that
 * wraps a rule tree with metadata for persistence in model_definitions.
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

// ─── StrategyDefinition Schema ────────────────────────────────────────────────

/**
 * StrategyDefinition — a named, versioned rule tree with metadata.
 *
 * This schema maps to the model_definitions table in the DB but exists
 * here as a standalone Zod schema so it can be validated at runtime
 * without a database connection.
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
