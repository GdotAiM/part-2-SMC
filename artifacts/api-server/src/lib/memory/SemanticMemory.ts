/**
 * Semantic Memory — wraps PerformanceMatrixService for pattern knowledge
 * and manages the agent_memory table for procedural rules.
 *
 * Provides the AgentLoop's semantic/procedural memory tier: top-performing
 * patterns, strategy rules, and formatted context for LLM prompts.
 */

import { db } from "@workspace/db";
import { agentMemory } from "@workspace/db/schema";
import { sql, eq, and, desc } from "drizzle-orm";
import { PerformanceMatrixService } from "../services/PerformanceMatrixService.js";

export interface MemoryEntry {
  id: string;
  key: string;
  content: string;
  source: "matrix" | "episode" | "manual" | "evaluation";
  score: number;
  tags: string[];
  createdAt: Date;
}

export class SemanticMemory {
  private matrix: PerformanceMatrixService;

  constructor() {
    this.matrix = new PerformanceMatrixService();
  }

  /**
   * Get top-performing patterns for a symbol from the performance matrix.
   */
  async getTopPatterns(symbol: string): Promise<MemoryEntry[]> {
    const rows = await this.matrix.queryMatrix({
      asset: undefined,
      detailed: true,
      limit: 10,
    });

    const filtered = rows.filter((r: any) => r.symbol === symbol);
    return filtered.map((r: any) => ({
      id: r.id,
      key: `pattern|${r.symbol}|${r.setup_type}|${r.setup_subtype}`,
      content: `${r.setup_type}/${r.setup_subtype} on ${r.symbol}: win_rate=${r.win_rate}, sharpe=${r.sharpe_ratio}, profit_factor=${r.profit_factor}, trials=${r.trials}`,
      source: "matrix" as const,
      score: parseFloat(r.sharpe_ratio || "0"),
      tags: [r.setup_type, r.setup_subtype, r.asset_class],
      createdAt: r.last_calculated || new Date(),
    }));
  }

  /**
   * Get procedural rules matching a market regime.
   */
  async getRulesForRegime(regime: string): Promise<MemoryEntry[]> {
    const results = await db
      .select()
      .from(agentMemory)
      .where(
        and(
          sql`${regime} = ANY(${agentMemory.tags})`,
          eq(agentMemory.is_durable, true),
        ),
      )
      .orderBy(desc(agentMemory.score))
      .limit(20);

    return results.map((r) => ({
      id: r.id,
      key: r.memory_key,
      content: r.content,
      source: r.source as MemoryEntry["source"],
      score: parseFloat(r.score || "0"),
      tags: (r.tags || []) as string[],
      createdAt: r.created_at,
    }));
  }

  /**
   * Store a new semantic memory entry (upsert by key).
   */
  async storeEntry(entry: {
    key: string;
    content: string;
    source?: "matrix" | "episode" | "manual" | "evaluation";
    score?: number;
    tags?: string[];
    isDurable?: boolean;
    sourceRunId?: string;
  }): Promise<void> {
    const data = {
      memory_key: entry.key,
      content: entry.content,
      source: entry.source || "episode",
      score: (entry.score ?? 0).toString(),
      tags: entry.tags || [],
      is_durable: entry.isDurable ?? true,
      source_run_id: entry.sourceRunId || null,
      last_accessed_at: new Date(),
    };

    // Upsert: INSERT ... ON CONFLICT DO UPDATE
    await db
      .insert(agentMemory)
      .values(data as any)
      .onConflictDoUpdate({
        target: agentMemory.memory_key,
        set: {
          content: sql`EXCLUDED.content`,
          score: sql`EXCLUDED.score`,
          tags: sql`EXCLUDED.tags`,
          last_accessed_at: sql`EXCLUDED.last_accessed_at`,
        } as any,
      });
  }

  /**
   * Format semantic knowledge as a context string for LLM prompts.
   */
  async formatForPrompt(symbol: string, regime: string): Promise<string> {
    const patterns = await this.getTopPatterns(symbol);
    const rules = await this.getRulesForRegime(regime);

    const parts: string[] = [];

    if (patterns.length > 0) {
      parts.push("Top-performing patterns from performance matrix:");
      parts.push(patterns.map((p) => `  - ${p.content}`).join("\n"));
    }

    if (rules.length > 0) {
      parts.push("\nProcedural rules for current market regime:");
      parts.push(rules.map((r) => `  - [${r.score.toFixed(2)}] ${r.content}`).join("\n"));
    }

    if (parts.length === 0) {
      return "No semantic memory entries available yet.";
    }

    return parts.join("\n");
  }

  /**
   * Query memory entries by tags or key prefix.
   */
  async query(tags?: string[], keyPrefix?: string): Promise<MemoryEntry[]> {
    const conditions = [];

    if (tags && tags.length > 0) {
      for (const tag of tags) {
        conditions.push(sql`${tag} = ANY(${agentMemory.tags})`);
      }
    }

    if (keyPrefix) {
      conditions.push(like(agentMemory.memory_key, `${keyPrefix}%`));
    }

    const query = db.select().from(agentMemory).$dynamic();

    if (conditions.length > 0) {
      query.where(and(...conditions));
    }

    const results = await query
      .orderBy(desc(agentMemory.score))
      .limit(50);

    return results.map((r) => ({
      id: r.id,
      key: r.memory_key,
      content: r.content,
      source: r.source as MemoryEntry["source"],
      score: parseFloat(r.score || "0"),
      tags: (r.tags || []) as string[],
      createdAt: r.created_at,
    }));
  }

  /**
   * Delete a memory entry by ID.
   */
  async deleteEntry(id: string): Promise<void> {
    await db.delete(agentMemory).where(eq(agentMemory.id, id));
  }
}
