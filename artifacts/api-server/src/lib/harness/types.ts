/**
 * AI Agent Harness — Trace and Evaluation Types
 *
 * Types for observability tracing and post-run evaluation scoring.
 */

import type { LoopStep, LoopIteration, LoopConfig, LoopResult } from "../loop/types.js";

export interface TraceSpan {
  id: string;
  parentId: string | null;
  type: "loop" | "iteration" | "step";
  name: string;
  startedAt: number;
  completedAt?: number;
  durationMs?: number;
  metadata: Record<string, unknown>;
  children?: TraceSpan[];
}

export interface RunEvaluationMetrics {
  accuracy: number;
  confidenceCalibration: number;
  responseTimeMs: number;
  toolsUsed: number;
  tokensUsed: number;
  iterationsUsed: number;
}

export interface RunEvaluation {
  loopRunId: string;
  /** Overall score 0-100 */
  score: number;
  metrics: RunEvaluationMetrics;
  strengths: string[];
  weaknesses: string[];
  suggestedImprovements: string[];
}
