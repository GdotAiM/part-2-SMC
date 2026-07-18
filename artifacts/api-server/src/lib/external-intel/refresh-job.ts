/**
 * Economic Calendar Refresh Job
 *
 * Scrapes the ForexFactory economic calendar using Firecrawl, then structures
 * the raw HTML into typed rows via ScrapeGraphAI's structured extraction API.
 * Rows are upserted into the `economic_events` table keyed on
 * (time, currency, event) — re-scraping safely updates rather than duplicates.
 *
 * Usage (standalone):
 *   DATABASE_URL="postgresql://..." FOREX_FACTORY_API_KEY="fc-..." \
 *     SCRAPEGRAPH_API_KEY="sg-..." \
 *     pnpm exec tsx artifacts/api-server/src/lib/external-intel/refresh-job.ts
 *
 * Dependencies:
 *   - firecrawl (npm) — web scraping SDK
 *   - ScrapeGraphAI REST API — LLM-driven HTML → structured JSON
 *   - @workspace/db — Drizzle ORM + schema
 */

import { db } from "@workspace/db";
import { economicEvents } from "@workspace/db/schema";
import { sql } from "drizzle-orm";
import { FirecrawlAppV1 } from "firecrawl";
import { logger } from "../logger.js";

// ─── Config ──────────────────────────────────────────────────────────────────

const FOREX_FACTORY_URL = "https://www.forexfactory.com/calendar";
const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY ?? "";
const SCRAPEGRAPH_API_KEY = process.env.SCRAPEGRAPH_API_KEY ?? "";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface EconomicEventRow {
  time: number;         // unix seconds
  currency: string;     // "USD", "EUR", etc.
  event: string;        // "Non-Farm Employment Change"
  impact: string | null; // "High", "Medium", "Low"
  forecast: string | null;
  previous: string | null;
  actual: string | null;
  source: string;
}

export interface RefreshResult {
  scraped: boolean;
  structured: number;
  upserted: number;
  source: string;
  durationMs: number;
  error?: string;
}

// ─── Step 1: Scrape raw HTML via Firecrawl ────────────────────────────────

/**
 * Scrape the ForexFactory calendar page using Firecrawl's JS rendering.
 * Returns the full page markdown (Firecrawl converts HTML → markdown by default).
 */
async function scrapeForexFactory(): Promise<string> {
  if (!FIRECRAWL_API_KEY) {
    throw new Error(
      "FIRECRAWL_API_KEY not set. Get one at https://firecrawl.dev",
    );
  }

  const app = new FirecrawlAppV1({ apiKey: FIRECRAWL_API_KEY });

  const result = await app.scrapeUrl(FOREX_FACTORY_URL, {
    formats: ["markdown"],
    // Wait for the JS-rendered table to load
    waitFor: 5000,
  });

  if (!result.success) {
    throw new Error(
      `Firecrawl scrape failed: ${result.error ?? "unknown error"}`,
    );
  }

  if (!result.markdown) {
    throw new Error("Firecrawl scrape returned no markdown content");
  }

  logger.info(
    { contentLength: result.markdown.length },
    "Firecrawl: ForexFactory calendar scraped",
  );
  return result.markdown;
}

// ─── Step 2: Structure via ScrapeGraphAI REST API ─────────────────────────

/**
 * Send raw markdown to ScrapeGraphAI and receive structured event rows.
 *
 * ScrapeGraphAI endpoint: POST /v1/llm/extract
 * It takes the raw content and a schema description, returns an array of
 * extracted objects using an LLM behind the scenes.
 */
async function structureWithScrapeGraphAI(
  rawMarkdown: string,
): Promise<EconomicEventRow[]> {
  if (!SCRAPEGRAPH_API_KEY) {
    throw new Error(
      "SCRAPEGRAPH_API_KEY not set. Get one at https://scrapegraphai.com",
    );
  }

  const response = await fetch(
    "https://api.scrapegraphai.com/v1/llm/extract",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SCRAPEGRAPH_API_KEY}`,
      },
      body: JSON.stringify({
        content: rawMarkdown,
        schema: {
          type: "array",
          items: {
            type: "object",
            properties: {
              time: {
                type: "integer",
                description:
                  "Unix timestamp in seconds for the scheduled event release",
              },
              currency: {
                type: "string",
                description:
                  "ISO 4217 currency code: USD, EUR, GBP, JPY, AUD, NZD, CAD, CHF, CNY, NZD",
              },
              event: {
                type: "string",
                description:
                  "Event name exactly as shown on ForexFactory, e.g. Non-Farm Employment Change, CPI m/m, Interest Rate Decision",
              },
              impact: {
                type: "string",
                enum: ["High", "Medium", "Low"],
                description: "Volatility impact rating from the calendar",
              },
              forecast: {
                type: "string",
                description:
                  "Forecast value as shown (e.g. 1.2%, 0.5M, 185K). Omit if not available.",
              },
              previous: {
                type: "string",
                description:
                  "Previous value as shown. Omit if not available.",
              },
              actual: {
                type: "string",
                description:
                  "Actual released value. Set to null if event has not yet been released.",
              },
            },
            required: ["time", "currency", "event", "impact"],
          },
        },
      }),
    },
  );

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "Unknown error");
    throw new Error(
      `ScrapeGraphAI API error (HTTP ${response.status}): ${errorBody.slice(0, 500)}`,
    );
  }

  const json = (await response.json()) as {
    data?: EconomicEventRow[];
    error?: string;
  };

  if (json.error) {
    throw new Error(`ScrapeGraphAI extraction error: ${json.error}`);
  }

  const rows = json.data ?? [];
  logger.info({ count: rows.length }, "ScrapeGraphAI: structured rows extracted");
  return rows;
}

// ─── Step 3: Upsert into DB ───────────────────────────────────────────────

/**
 * Upsert rows into economic_events using the composite key (time, currency, event).
 *
 * Uses PostgreSQL ON CONFLICT ... DO UPDATE so re-scraping safely refreshes
 * existing rows (updating forecast/previous/actual) without creating duplicates.
 */
async function upsertEvents(rows: EconomicEventRow[]): Promise<number> {
  let upserted = 0;

  for (const row of rows) {
    const values = {
      time: row.time,
      currency: row.currency,
      event: row.event,
      impact: row.impact,
      forecast: row.forecast,
      previous: row.previous,
      actual: row.actual,
      refreshedAt: new Date(),
      source: row.source ?? "forexfactory",
    };

    await db
      .insert(economicEvents)
      .values(values)
      .onConflictDoUpdate({
        target: [economicEvents.time, economicEvents.currency, economicEvents.event],
        set: {
          impact: sql`COALESCE(excluded.impact, ${economicEvents.impact})`,
          forecast: sql`COALESCE(excluded.forecast, ${economicEvents.forecast})`,
          previous: sql`COALESCE(excluded.previous, ${economicEvents.previous})`,
          actual: sql`COALESCE(excluded.actual, ${economicEvents.actual})`,
          refreshedAt: new Date(),
          source: "forexfactory",
        },
      });
    upserted++;
  }

  return upserted;
}

// ─── Orchestrator ──────────────────────────────────────────────────────────

/**
 * Run the full refresh pipeline: scrape → structure → upsert.
 *
 * Safe to call on a schedule — every step is idempotent.
 *
 * @returns A RefreshResult summary (never throws — errors are captured in the result).
 */
export async function refreshEconomicCalendar(): Promise<RefreshResult> {
  const start = Date.now();

  try {
    // Step 1: Scrape
    const markdown = await scrapeForexFactory();

    // Step 2: Structure
    const rows = await structureWithScrapeGraphAI(markdown);

    if (rows.length === 0) {
      logger.warn("ScrapeGraphAI returned zero rows — nothing to upsert");
      return {
        scraped: true,
        structured: 0,
        upserted: 0,
        source: "forexfactory",
        durationMs: Date.now() - start,
      };
    }

    // Step 3: Upsert
    const upserted = await upsertEvents(rows);

    logger.info(
      { rows: rows.length, upserted, durationMs: Date.now() - start },
      "Economic calendar refresh complete",
    );

    return {
      scraped: true,
      structured: rows.length,
      upserted,
      source: "forexfactory",
      durationMs: Date.now() - start,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err: message }, "Economic calendar refresh failed");
    return {
      scraped: false,
      structured: 0,
      upserted: 0,
      source: "forexfactory",
      durationMs: Date.now() - start,
      error: message,
    };
  }
}

// ── Standalone entry point ──────────────────────────────────────────────────

async function main() {
  console.log("Economic calendar refresh — starting...\n");
  const result = await refreshEconomicCalendar();
  console.log(JSON.stringify(result, null, 2));
  if (result.error) process.exitCode = 1;
}

const isMain = process.argv[1]?.endsWith("refresh-job.ts");
if (isMain) {
  main().catch((err) => {
    console.error("Fatal:", err);
    process.exit(1);
  });
}
