/**
 * Loop Tracer — step-level observability with DB persistence.
 *
 * Logs every step, iteration, and tool call. Persists run records to the
 * agent_loop_runs and agent_loop_steps tables. Emits real-time events
 * for SSE broadcasting to the frontend.
 */

import { EventEmitter } from "events";
import { logger } from "../logger.js";
import { db } from "@workspace/db";
import { agentLoopRuns, agentLoopSteps } from "@workspace/db/schema";
import { eq, and, desc, like, sql } from "drizzle-orm";
import type { LoopConfig, LoopIteration, LoopStep, LoopResult, LoopStepType } from "../loop/types.js";
import type { TradeLedgerEntry } from "../services/TradeLedgerService.js";

export declare interface LoopTracer {
  on(event: "step_event", listener: (runId: string, step: LoopStep) => void): this;
}

export class LoopTracer extends EventEmitter {
  constructor() {
    super();
  }

  /** Begin tracing a new loop run. Returns the runId. */
  async startRun(config: LoopConfig, triggeredBy: string): Promise<string> {
    const result = await db
      .insert(agentLoopRuns)
      .values({
        symbol: config.symbol,
        timeframe: config.timeframe,
        market: config.market,
        config_snapshot: config as any,
        status: "running",
        triggered_by: triggeredBy,
      })
      .returning({ id: agentLoopRuns.id });

    const runId = result[0]?.id;
    logger.info({ runId, symbol: config.symbol, timeframe: config.timeframe, trigger: triggeredBy }, "Agent loop run started");
    return runId;
  }

  /** Trace a step within an iteration. */
  async traceStep(
    runId: string,
    iterationSequence: number,
    step: LoopStep,
  ): Promise<void> {
    const durationMs = step.completedAt
      ? step.completedAt - step.startedAt
      : null;

    await db.insert(agentLoopSteps).values({
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

    logger.info(
      { runId, iterationSequence, stepType: step.type, durationMs },
      "Loop step traced",
    );

    this.emit("step_event", runId, step);
  }

  /** Complete a loop iteration — update the run's iteration count. */
  async completeIteration(runId: string, _iteration: LoopIteration): Promise<void> {
    // Increment the iteration counter on the run
    await db
      .update(agentLoopRuns)
      .set({
        total_iterations: sql`${agentLoopRuns.total_iterations} + 1`,
      })
      .where(eq(agentLoopRuns.id, runId));
  }

  /** Finalize the run record. */
  async completeRun(runId: string, result: LoopResult, status: string): Promise<void> {
    await db
      .update(agentLoopRuns)
      .set({
        status,
        result: result as any,
        completed_at: new Date(),
      })
      .where(eq(agentLoopRuns.id, runId));

    logger.info({ runId, status, action: result.action }, "Agent loop run completed");
  }

  /** Mark run as failed with an error. */
  async failRun(runId: string, error: string): Promise<void> {
    await db
      .update(agentLoopRuns)
      .set({
        status: "error",
        error,
        completed_at: new Date(),
      })
      .where(eq(agentLoopRuns.id, runId));

    logger.error({ runId, error }, "Agent loop run failed");
  }

  /** Get the full trace for a run (run record + all steps). */
  async getRunTrace(runId: string): Promise<{ run: any; steps: any[] }> {
    const [run] = await db
      .select()
      .from(agentLoopRuns)
      .where(eq(agentLoopRuns.id, runId))
      .limit(1);

    const steps = await db
      .select()
      .from(agentLoopSteps)
      .where(eq(agentLoopSteps.run_id, runId))
      .orderBy(agentLoopSteps.iteration_sequence, agentLoopSteps.started_at);

    return { run: run || null, steps: steps || [] };
  }

  /** Query historical runs with filters. */
  async queryRuns(filters: {
    symbol?: string;
    status?: string;
    limit?: number;
  }): Promise<any[]> {
    const conditions = [];

    if (filters.symbol) {
      conditions.push(eq(agentLoopRuns.symbol, filters.symbol.toUpperCase()));
    }
    if (filters.status) {
      conditions.push(eq(agentLoopRuns.status, filters.status));
    }

    const query = db.select().from(agentLoopRuns).$dynamic();

    if (conditions.length > 0) {
      query.where(and(...conditions));
    }

    return query
      .orderBy(desc(agentLoopRuns.started_at))
      .limit(filters.limit ?? 20);
  }
}
