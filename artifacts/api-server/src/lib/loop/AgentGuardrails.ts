/**
 * Agent Guardrails — pre-flight and post-decision safety checks.
 *
 * Validates market conditions, decisions, and risk metrics before the
 * AgentLoop is allowed to act on a signal.
 */

import type { LoopConfig, Decision } from "./types.js";
import type { SmcReport } from "../smc/types.js";

export interface GuardrailResult {
  passed: boolean;
  reason?: string;
  /** Sanitized/modified decision if applicable */
  modifiedDecision?: Decision;
}

export class AgentGuardrails {
  constructor(private config: LoopConfig) {}

  /**
   * Check if it's safe to start or continue the loop based on market data.
   */
  checkPreConditions(report: SmcReport): GuardrailResult {
    // 1. Check for prohibited symbols
    if (this.config.guardrails.prohibitSymbols.includes(report.symbol)) {
      return { passed: false, reason: `Symbol ${report.symbol} is in the prohibited list` };
    }

    // 2. Check for sufficient candles / data quality
    if (!report.candles || report.candles.length < 10) {
      return { passed: false, reason: `Insufficient candle data (${report.candles?.length ?? 0})` };
    }

    // 3. Check structure confidence isn't zero
    if (report.structure.confidence === 0 && report.structure.bias === "neutral") {
      return { passed: false, reason: "Market structure confidence is zero and bias is neutral" };
    }

    return { passed: true };
  }

  /**
   * Validate a decision before acting. Can modify or block it.
   */
  validateDecision(decision: Decision, report: SmcReport): GuardrailResult {
    // 1. Check if action is allowed
    if (!this.config.allowedActions.includes(decision.action)) {
      return {
        passed: false,
        reason: `Action "${decision.action}" is not in allowed actions list`,
      };
    }

    // 2. Check confidence floor
    if (decision.confidence < this.config.confidenceFloor) {
      return {
        passed: false,
        reason: `Decision confidence (${decision.confidence}) below floor (${this.config.confidenceFloor})`,
      };
    }

    // 3. For signal generation, check confluence factors
    if (decision.action === "generate_signal") {
      const minConfluence = this.config.guardrails.requireConfluenceMin;
      if (report.draw.length < minConfluence) {
        return {
          passed: false,
          reason: `Only ${report.draw.length} draw targets, need at least ${minConfluence} for confluence`,
          modifiedDecision: { ...decision, action: "analysis_report", confidence: decision.confidence * 0.8, reasoning: `${decision.reasoning} (downgraded: insufficient confluence)` },
        };
      }
    }

    return { passed: true };
  }

  /**
   * Validate a potential signal's risk parameters.
   */
  validateSignal(confidence: number, rrRatio: number): GuardrailResult {
    if (confidence < this.config.guardrails.confidenceThreshold) {
      return { passed: false, reason: `Confidence ${confidence} < threshold ${this.config.guardrails.confidenceThreshold}` };
    }

    if (rrRatio < 1.0) {
      return { passed: false, reason: `Risk-reward ratio ${rrRatio.toFixed(2)} < 1.0 minimum` };
    }

    if (rrRatio > 20) {
      return { passed: false, reason: `Risk-reward ratio ${rrRatio.toFixed(2)} > 20 maximum — likely calculation error` };
    }

    return { passed: true };
  }

  /**
   * Check if the loop has exhausted its maximum iterations.
   */
  isIterationsExhausted(iterationCount: number): boolean {
    return iterationCount >= this.config.maxIterations;
  }
}
