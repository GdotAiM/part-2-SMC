/**
 * AI Agent Loop — Type Definitions
 *
 * Types for the Observe → Interpret → Reason → Decide → Act → Evaluate → Update
 * agent loop cycle, its configuration, guardrails, and persistence.
 */

export type LoopStepType =
  | "observe"
  | "interpret"
  | "reason"
  | "decide"
  | "act"
  | "evaluate"
  | "update_memory";

export type LoopStatus =
  | "idle"
  | "running"
  | "awaiting_data"
  | "completed"
  | "error"
  | "stopped";

export type LoopTrigger = "candle_close" | "api" | "scheduled" | "manual";

export interface GuardrailConfig {
  /** Max tool calls per single iteration */
  maxToolCallsPerIteration: number;
  /** Minimum number of confluence factors required (0-6) */
  requireConfluenceMin: number;
  /** Maximum allowed drawdown percent before halting */
  maxDrawdownPercent: number;
  /** Symbols the loop is prohibited from trading */
  prohibitSymbols: string[];
  /** Minimum confidence score (0-100) to generate a signal */
  confidenceThreshold: number;
}

export interface LoopConfig {
  symbol: string;
  timeframe: string;
  market: "crypto" | "forex";
  /** Max iterations per single run() call */
  maxIterations: number;
  /** Max wall-clock ms per iteration */
  iterationTimeoutMs: number;
  /** Minimum confidence (0-100) to act on a decision */
  confidenceFloor: number;
  /** Max risk per trade as a decimal fraction (e.g. 0.02 = 2%) */
  maxRiskPerTrade: number;
  /** Allowed action types the loop may take */
  allowedActions: string[];
  guardrails: GuardrailConfig;
  llmOverride?: {
    provider?: string;
    model?: string;
  };
}

export const DEFAULT_LOOP_CONFIG: LoopConfig = {
  symbol: "BTCUSDT",
  timeframe: "1h",
  market: "crypto",
  maxIterations: 3,
  iterationTimeoutMs: 60000,
  confidenceFloor: 60,
  maxRiskPerTrade: 0.02,
  allowedActions: ["generate_signal", "analysis_report", "monitor"],
  guardrails: {
    maxToolCallsPerIteration: 11,
    requireConfluenceMin: 2,
    maxDrawdownPercent: 15,
    prohibitSymbols: [],
    confidenceThreshold: 50,
  },
};

export interface LoopStep {
  id: string;
  type: LoopStepType;
  startedAt: number;
  completedAt?: number;
  input?: unknown;
  output?: unknown;
  toolCalls?: Array<{ name: string; args: unknown; result: unknown }>;
  tokensUsed?: number;
  error?: string;
}

export interface LoopIteration {
  id: string;
  sequence: number;
  startedAt: number;
  completedAt?: number;
  steps: LoopStep[];
  result?: LoopResult;
  error?: string;
}

export interface LoopResult {
  signal?: unknown;
  analysis?: string;
  action: "signal_generated" | "analysis_complete" | "no_action" | "error";
  confidence: number;
  narrative: string;
}

export interface Decision {
  action: "generate_signal" | "analysis_report" | "monitor" | "escalate" | "no_action";
  confidence: number;
  reasoning: string;
  proposedSignal?: Record<string, unknown>;
}
