/**
 * Loop Tracer — step-level observability with optional DB persistence.
 *
 * Logs every step, iteration, and tool call. Persists run records to the
 * agent_loop_runs and agent_loop_steps tables when DATABASE_URL is set.
 * Emits real-time events for SSE broadcasting to the frontend.
 *
 * Gracefully degrades when no database is configured — all operations
 * work in memory/fallback mode without throwing.
 */

import { EventEmitter } from "events";
import { logger } from "../logger.js";
import type { LoopConfig, LoopIteration, LoopStep, LoopResult, LoopStepType } from "../loop/types.js";
import type { TradeLedgerEntry } from "../services/TradeLedgerService.js";

// Lazy DB import — only loaded when DATABASE_URL is set
let _dbModule: any = null;
async function getDb() {
  if (!process.env.DATABASE_URL) return null;
  if (!_dbModule) {
    try {
      _dbModule = await import("@workspace/db");
    } catch {
      return null;
    }
  }
  return _dbModule.db;
}
async function getSchema() {
  if (!process.env.DATABASE_URL) return null;
  try {
    return await import("@workspace/db/schema");
  } catch {
    return null;
  }
}

export declare interface LoopTracer {
  on(event: "step_event", listener: (runId: string, step: LoopStep) => void): this;
}

export class LoopTracer extends EventEmitter {
  constructor() {
    super();
  }

  /** Begin tracing a new loop run. Returns the runId. */
  async startRun(config: LoopConfig, triggeredBy: string): Promise<string> {
    if (!process.env.DATABASE_URL) return "local-" + Date.now();
    try {
      const db = await getDb();
      const schema = await getSchema();
      if (!db || !schema) return "local-" + Date.now();

      const result = await db
        .insert(schema.agentLoopRuns)
        .values({
          symbol: config.symbol,
          timeframe: config.timeframe,
          market: config.market,
          config_snapshot: config as any,
          status: "running",
          triggered_by: triggeredBy,
        })
        .returning({ id: schema.agentLoopRuns.id });

      const runId = result[0]?.id;
      logger.info({ runId, symbol: config.symbol, timeframe: config.timeframe, trigger: triggeredBy }, "Agent loop run started");
      return runId;
    } catch (err: any) {
      logger.warn({ err: err.message }, "DB unavailable — using local run ID");
      return "local-" + Date.now();
    }
  }

  /** Trace a step within an iteration. */
  async traceStep(
    runId: string,
    iterationSequence: number,
    step: LoopStep,
  ): Promise<void> {
    if (process.env.DATABASE_URL) {
      try {
        const db = await getDb();
        const schema = await getSchema();
        if (db && schema) {
          const durationMs = step.completedAt
            ? step.completedAt - step.startedAt
            : null;

          await db.insert(schema.agentLoopSteps).values({
            run_id: runId,
            iteration_sequence: iterationSequence,
            step_type: step.type,
            started_at: new Date(step.startedAt),
            completed_at: step.completedAt ? new Date(step.completedAt) : null,
            duration_ms: durationMs,
            input_snapshot: step.input as any,
            output_snapshot: step.output as any,
            tool_calls: step.toolCalls as any,
            error: step.error || null,
          });
        }
      } catch { /* DB unavailable — skip persistence */ }
    }

    logger.info(
      { runId, iterationSequence, stepType: step.type },
      "Loop step traced",
    );

    this.emit("step_event", runId, step);
  }

  /** Complete a loop iteration — update the run's iteration count. */
  async completeIteration(runId: string, _iteration: LoopIteration): Promise<void> {
    if (!process.env.DATABASE_URL) return;
    try {
      const db = await getDb();
      const schema = await getSchema();
      if (db && schema) {
        const { eq, sql } = await import("drizzle-orm");
        await db
          .update(schema.agentLoopRuns)
          .set({
            total_iterations: sql`${schema.agentLoopRuns.total_iterations} + 1`,
          })
          .where(eq(schema.agentLoopRuns.id, runId));
      }
    } catch { /* skip */ }
  }

  /** Finalize the run record. */
  async completeRun(runId: string, result: LoopResult, status: string): Promise<void> {
    logger.info({ runId, status, action: result.action }, "Agent loop run completed");
    if (!process.env.DATABASE_URL) return;
    try {
      const db = await getDb();
      const schema = await getSchema();
      if (db && schema) {
        const { eq } = await import("drizzle-orm");
        await db
          .update(schema.agentLoopRuns)
          .set({
            status,
            result: result as any,
            completed_at: new Date(),
          })
          .where(eq(schema.agentLoopRuns.id, runId));
      }
    } catch { /* skip */ }
  }

  /** Mark run as failed with an error. */
  async failRun(runId: string, error: string): Promise<void> {
    logger.error({ runId, error }, "Agent loop run failed");
    if (!process.env.DATABASE_URL) return;
    try {
      const db = await getDb();
      const schema = await getSchema();
      if (db && schema) {
        const { eq } = await import("drizzle-orm");
        await db
          .update(schema.agentLoopRuns)
          .set({
            status: "error",
            error,
            completed_at: new Date(),
          })
          .where(eq(schema.agentLoopRuns.id, runId));
      }
    } catch { /* skip */ }
  }

  /** Get the full trace for a run (run record + all steps). */
  async getRunTrace(runId: string): Promise<{ run: any; steps: any[] }> {
    if (!process.env.DATABASE_URL) return { run: null, steps: [] };
    try {
      const db = await getDb();
      const schema = await getSchema();
      if (!db || !schema) return { run: null, steps: [] };
      const { eq } = await import("drizzle-orm");

      const [run] = await db
        .select()
        .from(schema.agentLoopRuns)
        .where(eq(schema.agentLoopRuns.id, runId))
        .limit(1);

      const steps = await db
        .select()
        .from(schema.agentLoopSteps)
        .where(eq(schema.agentLoopSteps.run_id, runId))
        .orderBy(schema.agentLoopSteps.iteration_sequence, schema.agentLoopSteps.started_at);

      return { run: run || null, steps: steps || [] };
    } catch { return { run: null, steps: [] }; }
  }

  /** Query historical runs with filters. */
  async queryRuns(filters: {
    symbol?: string;
    status?: string;
    limit?: number;
  }): Promise<any[]> {
    if (!process.env.DATABASE_URL) return [];
    try {
      const db = await getDb();
      const schema = await getSchema();
      if (!db || !schema) return [];
      const { eq, and, desc } = await import("drizzle-orm");

      const conditions: any[] = [];

      if (filters.symbol) {
        conditions.push(eq(schema.agentLoopRuns.symbol, filters.symbol.toUpperCase()));
      }
      if (filters.status) {
        conditions.push(eq(schema.agentLoopRuns.status, filters.status));
      }

      const query = db.select().from(schema.agentLoopRuns).$dynamic();

      if (conditions.length > 0) {
        query.where(and(...conditions));
      }

      return query
        .orderBy(desc(schema.agentLoopRuns.started_at))
        .limit(filters.limit ?? 20);
    } catch { return []; }
  }
}
