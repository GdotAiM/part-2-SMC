/**
 * Langfuse Observability — LLM call tracing, cost tracking, and evaluation.
 *
 * Wraps Langfuse SDK for tracing every LLM call, Agent Loop step,
 * and MCP tool execution. Gracefully degrades when Langfuse is not
 * configured — no crashes, no required env vars.
 *
 * Environment variables:
 *   LANGFUSE_PUBLIC_KEY  — Langfuse project public key (optional)
 *   LANGFUSE_SECRET_KEY  — Langfuse project secret key (optional)
 *   LANGFUSE_HOST        — Langfuse server URL (default: https://us.cloud.langfuse.com)
 */

import { Langfuse } from "langfuse";
import type { CreateGenerationBody, CreateSpanBody, CreateEventBody } from "langfuse";
import { logger } from "../logger.js";
import type { LlmUsage } from "../llm/provider.js";

// ── Singleton setup ─────────────────────────────────────────────────────

function createLangfuseClient(): Langfuse | null {
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
  const secretKey = process.env.LANGFUSE_SECRET_KEY;

  if (!publicKey || !secretKey) {
    logger.info(
      { publicKey: !!publicKey, secretKey: !!secretKey },
      "Langfuse not configured — observability disabled. Set LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY to enable.",
    );
    return null;
  }

  try {
    const client = new Langfuse({
      publicKey,
      secretKey,
      baseUrl: process.env.LANGFUSE_HOST || "https://us.cloud.langfuse.com",
    });
    logger.info("Langfuse observability initialized");
    return client;
  } catch (err: any) {
    logger.warn({ err: err.message }, "Langfuse initialization failed — observability disabled");
    return null;
  }
}

const _client = createLangfuseClient();

// ── Trace IDs ────────────────────────────────────────────────────────────

let traceCounter = 0;
function nextId(prefix: string): string {
  return `${prefix}_${++traceCounter}_${Date.now()}`;
}

// ── Public API ───────────────────────────────────────────────────────────

export const langfuse = {
  /**
   * Create a root trace for an Agent Loop run, LLM call, or pipeline.
   */
  createTrace(params: {
    name: string;
    sessionId?: string;
    userId?: string;
    metadata?: Record<string, unknown>;
    tags?: string[];
  }): string | null {
    if (!_client) return null;
    const traceId = nextId("trace");
    try {
      _client.trace({
        id: traceId,
        name: params.name,
        sessionId: params.sessionId,
        userId: params.userId,
        metadata: params.metadata,
        tags: params.tags,
      });
    } catch { /* graceful degradation */ }
    return traceId;
  },

  /**
   * Update an existing trace with final metadata (e.g. loop result).
   */
  updateTrace(traceId: string | null, metadata: Record<string, unknown>): void {
    if (!_client || !traceId) return;
    try {
      _client.trace({ id: traceId, metadata });
    } catch { /* ignore */ }
  },

  /**
   * Create a generation span for an LLM call.
   * Returns the generation ID for later updating with token counts.
   */
  createGeneration(params: {
    traceId: string | null;
    name: string;
    model: string;
    provider: string;
    input: unknown;
    output?: unknown;
    metadata?: Record<string, unknown>;
    parentObservationId?: string;
    startTime?: Date;
  }): string | null {
    if (!_client || !params.traceId) return null;
    const genId = nextId("gen");
    try {
      _client.generation({
        id: genId,
        traceId: params.traceId,
        name: params.name,
        model: params.model,
        modelParameters: { provider: params.provider },
        input: params.input,
        output: params.output,
        metadata: params.metadata,
        parentObservationId: params.parentObservationId,
        startTime: params.startTime ?? new Date(),
      });
    } catch { /* ignore */ }
    return genId;
  },

  /**
   * Update a generation with token usage and cost after the LLM call completes.
   */
  endGeneration(
    genId: string | null,
    traceId: string | null,
    usage: LlmUsage,
    output: unknown,
  ): void {
    if (!_client || !genId || !traceId) return;
    try {
      _client.generation({
        id: genId,
        traceId,
        completionStartTime: new Date(),
        endTime: new Date(),
        usage: {
          promptTokens: usage.promptTokens,
          completionTokens: usage.completionTokens,
          totalTokens: usage.totalTokens,
          unit: "TOKENS",
        },
        cost: usage.costUsd,
        output,
        model: usage.model,
      });
    } catch { /* ignore */ }
  },

  /**
   * Create a span for an Agent Loop step or tool execution.
   */
  createSpan(params: {
    traceId: string | null;
    name: string;
    input?: unknown;
    metadata?: Record<string, unknown>;
    parentObservationId?: string;
  }): string | null {
    if (!_client || !params.traceId) return null;
    const spanId = nextId("span");
    try {
      _client.span({
        id: spanId,
        traceId: params.traceId,
        name: params.name,
        input: params.input,
        metadata: params.metadata,
        parentObservationId: params.parentObservationId,
      });
    } catch { /* ignore */ }
    return spanId;
  },

  /**
   * End a span with timing and output.
   */
  endSpan(
    spanId: string | null,
    traceId: string | null,
    output?: unknown,
  ): void {
    if (!_client || !spanId || !traceId) return;
    try {
      _client.span({
        id: spanId,
        traceId,
        endTime: new Date(),
        output,
      });
    } catch { /* ignore */ }
  },

  /**
   * Score a trace or observation (e.g. evaluation result).
   */
  score(params: {
    traceId: string | null;
    name: string;
    value: number;
    comment?: string;
  }): void {
    if (!_client || !params.traceId) return;
    try {
      _client.score({
        traceId: params.traceId,
        name: params.name,
        value: params.value,
        comment: params.comment,
      });
    } catch { /* ignore */ }
  },

  /**
   * Flush all events to Langfuse (call on shutdown).
   */
  async flush(): Promise<void> {
    if (!_client) return;
    try {
      await _client.flushAsync();
      logger.info("Langfuse events flushed");
    } catch { /* ignore */ }
  },

  /**
   * Get a shareable URL for a trace (for frontend display).
   */
  getTraceUrl(traceId: string | null): string | null {
    if (!traceId) return null;
    const host = process.env.LANGFUSE_HOST || "https://us.cloud.langfuse.com";
    return `${host}/trace/${traceId}`;
  },
};
