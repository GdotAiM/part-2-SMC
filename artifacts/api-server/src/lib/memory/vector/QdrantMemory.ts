/**
 * Qdrant Vector Memory — long-term semantic memory for trading signals.
 *
 * Stores historical signals, setups, and outcomes as vector embeddings.
 * Enables "find similar past setups" retrieval during agent reasoning.
 *
 * Configurable via env vars:
 *   QDRANT_URL (default: http://localhost:6333)
 *   QDRANT_API_KEY (optional)
 *
 * Gracefully falls back when Qdrant is not running.
 */

import { QdrantClient } from "@qdrant/js-client-rest";
import { logger } from "../../logger.js";
import type { VectorSignalRecord, SimilarSetupResult, VectorSearchQuery } from "./types.js";

const QDRANT_URL = process.env.QDRANT_URL || "http://localhost:6333";
const QDRANT_API_KEY = process.env.QDRANT_API_KEY || "";

const COLLECTION_NAME = "smc_signals";
const VECTOR_SIZE = 128; // embedding dimension

// ─── Simple embedding using character n-grams (no external API needed) ────
// In production, replace with a proper embedding model (OpenAI, Cohere, etc.)

function embedText(text: string): number[] {
  const normalized = text.toLowerCase().replace(/[^a-z0-9\s]/g, "");
  const words = normalized.split(/\s+/).filter(Boolean);

  // Simple bag-of-words embedding using character bigrams
  const bigrams = new Map<string, number>();
  for (let i = 0; i < normalized.length - 1; i++) {
    const bg = normalized.slice(i, i + 2);
    bigrams.set(bg, (bigrams.get(bg) || 0) + 1);
  }

  // Normalize to VECTOR_SIZE
  const vec = new Array(VECTOR_SIZE).fill(0);
  let idx = 0;
  for (const [, count] of bigrams) {
    if (idx >= VECTOR_SIZE) break;
    vec[idx] = count / Math.max(1, normalized.length);
    idx++;
  }

  return vec;
}

function embedSignal(record: VectorSignalRecord): number[] {
  const text = [
    record.symbol,
    record.setupType,
    record.setupSubtype,
    record.direction,
    record.marketRegime,
    record.sessionContext,
    record.narrative,
    `conf:${record.confidence}`,
    record.win !== null ? `outcome:${record.win ? "win" : "loss"}` : "",
  ]
    .filter(Boolean)
    .join(" ");
  return embedText(text);
}

// ─── Client singleton ────────────────────────────────────────────────────

let _client: QdrantClient | null = null;
let _ready = false;

function getClient(): QdrantClient | null {
  if (_client && _ready) return _client;

  try {
    _client = new QdrantClient({
      url: QDRANT_URL,
      apiKey: QDRANT_API_KEY || undefined,
    });
    _ready = true;
    return _client;
  } catch (err: any) {
    logger.warn({ err: err.message, url: QDRANT_URL }, "Qdrant client init failed — vector memory disabled");
    return null;
  }
}

async function ensureCollection(): Promise<boolean> {
  const client = getClient();
  if (!client) return false;

  try {
    const collections = await client.getCollections();
    const exists = collections.collections?.some((c) => c.name === COLLECTION_NAME);
    if (!exists) {
      await client.createCollection(COLLECTION_NAME, {
        vectors: {
          size: VECTOR_SIZE,
          distance: "Cosine",
        },
      });
      logger.info({ collection: COLLECTION_NAME }, "Created Qdrant collection");
    }
    return true;
  } catch (err: any) {
    logger.warn({ err: err.message }, "Qdrant collection check failed — vector memory unavailable");
    return false;
  }
}

// ─── QdrantMemory ────────────────────────────────────────────────────────

export class QdrantMemory {
  private initialized = false;

  async init(): Promise<boolean> {
    if (this.initialized) return true;
    this.initialized = await ensureCollection();
    return this.initialized;
  }

  /**
   * Store a signal as a vector record for similarity search.
   */
  async storeSignal(record: VectorSignalRecord): Promise<boolean> {
    if (!(await this.init())) return false;
    const client = getClient();
    if (!client) return false;

    try {
      const vector = embedSignal(record);
      await client.upsert(COLLECTION_NAME, {
        points: [
          {
            id: record.id,
            vector,
            payload: record as any,
          },
        ],
      });
      return true;
    } catch (err: any) {
      logger.warn({ err: err.message, id: record.id }, "Qdrant store failed");
      return false;
    }
  }

  /**
   * Find similar past setups to the current market conditions.
   */
  async findSimilar(
    query: VectorSearchQuery,
    limit = 10,
  ): Promise<SimilarSetupResult[]> {
    if (!(await this.init())) return [];
    const client = getClient();
    if (!client) return [];

    try {
      // Build a search vector from query params
      const queryText = [query.symbol, query.setupType, query.marketRegime].filter(Boolean).join(" ");
      const queryVector = embedText(queryText || "search");

      const must: Record<string, unknown>[] = [];
      if (query.symbol) must.push({ key: "symbol", match: { value: query.symbol } });
      if (query.setupType) must.push({ key: "setupType", match: { value: query.setupType } });

      const results = await client.search(COLLECTION_NAME, {
        vector: queryVector,
        limit,
        filter: must.length > 0 ? { must } : undefined,
      });

      return results.map((r) => {
        const p = r.payload as any;
        return {
          id: String(r.id),
          symbol: p?.symbol || "",
          setupType: p?.setupType || "",
          direction: p?.direction || "",
          confidence: p?.confidence || 0,
          win: p?.win ?? null,
          pnl: p?.pnl ?? null,
          similarity: r.score || 0,
          narrative: p?.narrative?.slice(0, 200) || "",
        };
      });
    } catch (err: any) {
      logger.warn({ err: err.message }, "Qdrant search failed");
      return [];
    }
  }

  /**
   * Format similar setups as LLM context.
   */
  async formatForPrompt(symbol: string, setupType?: string): Promise<string> {
    const similar = await this.findSimilar({ symbol, setupType }, 5);
    if (similar.length === 0) return "";

    const lines = similar.map(
      (s) =>
        `  • ${s.symbol} ${s.setupType} (${s.direction}) — conf: ${s.confidence}, outcome: ${s.win !== null ? (s.win ? "WIN" : "LOSS") : "pending"}, similarity: ${(s.similarity * 100).toFixed(0)}%`,
    );

    return `\nSIMILAR PAST SETUPS:\n${lines.join("\n")}`;
  }

  /**
   * Delete a signal from the vector store.
   */
  async deleteSignal(id: string): Promise<boolean> {
    if (!(await this.init())) return false;
    const client = getClient();
    if (!client) return false;

    try {
      await client.delete(COLLECTION_NAME, {
        points: [id],
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check Qdrant connectivity.
   */
  async health(): Promise<{ connected: boolean; collections: string[] }> {
    const client = getClient();
    if (!client) return { connected: false, collections: [] };

    try {
      const info = await client.getCollections();
      return {
        connected: true,
        collections: info.collections?.map((c) => c.name) || [],
      };
    } catch {
      return { connected: false, collections: [] };
    }
  }
}

// ── Singleton ─────────────────────────────────────────────────────────────

export const qdrantMemory = new QdrantMemory();
