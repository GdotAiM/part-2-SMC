/**
 * Economic Events — Database Schema
 *
 * Stores fundamental economic calendar events from sources like ForexFactory.
 * Each row represents one scheduled release, with the actual/forecast/previous
 * values filled in as they become available.
 *
 * The composite unique key on (time, currency, event) enables idempotent
 * upserts — the refresh job never duplicates rows.
 */

import { pgTable, text, timestamp, integer, uniqueIndex, index } from "drizzle-orm/pg-core";

export const economicEvents = pgTable(
  "economic_events",
  {
    /** Unix timestamp (seconds) of the scheduled release. */
    time: integer("time").notNull(),

    /** ISO 4217 currency code (USD, EUR, GBP, JPY, etc.). */
    currency: text("currency").notNull(),

    /** Event name as displayed on ForexFactory (e.g. "Non-Farm Employment Change"). */
    event: text("event").notNull(),

    /** Impact level: "High", "Medium", "Low", or null. */
    impact: text("impact"),

    /** Forecasted value as a string (preserves formatting like "1.2%", "0.5M"). */
    forecast: text("forecast"),

    /** Previously released value. */
    previous: text("previous"),

    /** Actual released value (null until released). */
    actual: text("actual"),

    /** ISO timestamp of when this event was last refreshed from the source. */
    refreshedAt: timestamp("refreshed_at").notNull().defaultNow(),

    /** Human-readable label for the source (e.g. "ForexFactory"). */
    source: text("source").notNull().default("forexfactory"),
  },
  (table) => ({
    /** Unique key for upsert — prevents duplicates on re-scrape. */
    upsertKey: uniqueIndex("idx_ee_upsert").on(table.time, table.currency, table.event),
    idxCurrency: index("idx_ee_currency").on(table.currency),
    idxImpact: index("idx_ee_impact").on(table.impact),
    idxTime: index("idx_ee_time").on(table.time),
  }),
);
