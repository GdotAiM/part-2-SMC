/**
 * Model Definitions — Database Schema
 *
 * Catalog of inference model definitions used across the system. Each row
 * describes one model: its required/optional predicates, asset scope,
 * tunable parameters, and accumulated performance statistics.
 *
 * Taxonomy v2: Extended with SMC-EVAL ontology classification, priority,
 * invalidation rules, temporal constraints, confusion guards, and
 * curriculum prerequisites.
 */

import {
  pgTable,
  text,
  boolean,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

export const modelDefinitions = pgTable(
  "model_definitions",
  {
    id: text("id").primaryKey(),

    name: text("name").notNull(),
    category: text("category").notNull(),
    version: text("version").notNull(),
    description: text("description").notNull(),

    // Predicates the model unconditionally requires
    requires: jsonb("requires").notNull().$type<string[]>().default([]),

    // Predicates the model may use (optional)
    optional: jsonb("optional").notNull().$type<string[]>().default([]),

    // Optional time window constraint (e.g. { type: "session", value: "LONDON" })
    timeWindow: jsonb("timeWindow").$type<{
      type: string;
      value: string;
    } | null>().default(null),

    // Assets the model applies to (symbols or patterns)
    assets: jsonb("assets").notNull().$type<string[]>().default([]),

    // Tunable parameters with metadata
    parameters: jsonb("parameters").notNull().$type<Array<{
      key: string;
      label: string;
      type: "number" | "string" | "boolean" | "select";
      default: unknown;
      min?: number;
      max?: number;
      options?: string[];
    }>>().default([]),

    // Accumulated performance statistics
    performanceStats: jsonb("performanceStats").notNull().$type<Record<string, unknown>>().default({}),

    isPublished: boolean("isPublished").notNull().default(false),

    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),

    // ═══════════════════════════════════════════════════════════════════════
    // SMC-EVAL Taxonomy v2 columns (all nullable — additive, non-breaking)
    // ═══════════════════════════════════════════════════════════════════════

    /** SMC-EVAL ontology layer: CONCEPT | STRUCTURAL_PATTERN | EXECUTION_MODEL | TEMPORAL_MODEL | MARKET_CYCLE | TRADING_HORIZON | CURRICULUM */
    ontology: text("ontology"),

    /** Model priority for ranking: PRIMARY | ALTERNATIVE | INFORMATIONAL */
    priority: text("priority").default("ALTERNATIVE"),

    /** Invalidation rules — conditions that MUST NOT be true for this model to match */
    invalidation: jsonb("invalidation").$type<Array<{
      predicate: string;
      timeframe?: string;
      args?: unknown[];
      reason: string;
    }>>().default([]),

    /** Temporal/session constraints */
    temporalRules: jsonb("temporalRules").$type<{
      session?: string[];
      window?: { before?: number; after?: number };
    } | null>().default(null),

    /** Confusion guards — models this is often confused with and how to discriminate */
    confusionGuards: jsonb("confusionGuards").$type<Array<{
      similarTo: string;
      discriminator: string;
      discriminatorArgs?: unknown[];
    }>>().default([]),

    /** Prerequisite predicate/concept IDs that must be understood first */
    prerequisites: jsonb("prerequisites").$type<string[]>().default([]),
  },
  (table) => ({
    idxCategory: index("idx_md_category").on(table.category),
    idxVersion: index("idx_md_version").on(table.version),
    idxPublished: index("idx_md_published").on(table.isPublished),
    idxCreated: index("idx_md_created").on(table.createdAt),
    idxOntology: index("idx_md_ontology").on(table.ontology),
    idxPriority: index("idx_md_priority").on(table.priority),
  })
);
