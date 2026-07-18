/**
 * Model Definitions — Database Schema
 *
 * Catalog of inference model definitions used across the system. Each row
 * describes one model: its required/optional predicates, asset scope,
 * tunable parameters, and accumulated performance statistics.
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
  },
  (table) => ({
    idxCategory: index("idx_md_category").on(table.category),
    idxVersion: index("idx_md_version").on(table.version),
    idxPublished: index("idx_md_published").on(table.isPublished),
    idxCreated: index("idx_md_created").on(table.createdAt),
  })
);
