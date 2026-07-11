/**
 * Loop Context — working memory / session state for a running AgentLoop.
 *
 * Holds the current SmcReport, previous reports, iterations, and provides
 * summarization helpers for LLM prompt injection.
 */

import type { SmcReport } from "../smc/types.js";
import type { LoopConfig, LoopIteration, LoopResult, LoopStep, LoopStepType } from "./types.js";

let stepCounter = 0;
let iterationCounter = 0;

function nextStepId(): string {
  return `step_${++stepCounter}_${Date.now()}`;
}

function nextIterationId(): string {
  return `iter_${++iterationCounter}_${Date.now()}`;
}

export class LoopContext {
  public config: LoopConfig;
  public currentReport: SmcReport | null = null;
  public previousReports: SmcReport[] = [];
  public iterations: LoopIteration[] = [];
  public accumulatedTokens = 0;
  public status: string = "idle";
  public errors: string[] = [];
  public currentIteration: LoopIteration | null = null;

  constructor(config: LoopConfig) {
    this.config = config;
  }

  /** Store the latest SMC report, pushing the previous one to history. */
  updateReport(report: SmcReport): void {
    if (this.currentReport) {
      this.previousReports.push(this.currentReport);
      // Keep only last 10
      if (this.previousReports.length > 10) {
        this.previousReports.shift();
      }
    }
    this.currentReport = report;
  }

  /** Start a new iteration and return it. */
  beginIteration(): LoopIteration {
    const now = Date.now();
    const iter: LoopIteration = {
      id: nextIterationId(),
      sequence: this.iterations.length + 1,
      startedAt: now,
      steps: [],
    };
    this.currentIteration = iter;
    this.iterations.push(iter);
    return iter;
  }

  /** Add a step to the current iteration. */
  addStep(type: LoopStepType, input?: unknown, output?: unknown): LoopStep {
    const step: LoopStep = {
      id: nextStepId(),
      type,
      startedAt: Date.now(),
      input,
      output,
    };
    if (this.currentIteration) {
      this.currentIteration.steps.push(step);
    } else {
      // Auto-create iteration if none exists (safety fallback)
      this.beginIteration();
      this.currentIteration!.steps.push(step);
    }
    return step;
  }

  /** Complete the final opened step by type. */
  completeStep(type: LoopStepType, output?: unknown): void {
    const iter = this.currentIteration;
    if (!iter || iter.steps.length === 0) return;
    // Find the last step of the given type that isn't completed
    for (let i = iter.steps.length - 1; i >= 0; i--) {
      if (iter.steps[i].type === type && !iter.steps[i].completedAt) {
        iter.steps[i].completedAt = Date.now();
        iter.steps[i].output = output;
        break;
      }
    }
  }

  /** Complete the current iteration with a result. */
  completeIteration(result: LoopResult): void {
    if (this.currentIteration) {
      this.currentIteration.completedAt = Date.now();
      this.currentIteration.result = result;
    }
    this.currentIteration = null;

    // Auto-complete all uncompleted steps in the iteration
    const lastIter = this.iterations[this.iterations.length - 1];
    if (lastIter) {
      for (const step of lastIter.steps) {
        if (!step.completedAt) {
          step.completedAt = Date.now();
        }
      }
    }
  }

  /** Summarize the current context for LLM prompt injection. */
  summarizeContext(): string {
    if (!this.currentReport) return "No market data loaded.";

    const r = this.currentReport;
    const prevIterations = this.iterations.filter((i) => i.completedAt);
    const prevActions = prevIterations
      .map((i) => `  Iter ${i.sequence}: ${i.result?.action ?? "unknown"} (confidence: ${i.result?.confidence ?? 0})`)
      .join("\n");

    return [
      `Symbol: ${r.symbol} (${r.market}) | Timeframe: ${r.timeframe}`,
      `Current Price: ${r.currentPrice}`,
      `Structure: ${r.structure.trend} / ${r.structure.bias} (confidence: ${Math.round(r.structure.confidence * 100)}%)`,
      `Phase: ${r.structure.phase} | Session: ${r.sessionState}`,
      `Daily Bias: ${r.dailyBias.bias} (strength: ${Math.round(r.dailyBias.strength * 100)}%)`,
      `SMT Divergence: ${r.smt.detected ? `YES (${r.smt.type})` : "No"}`,
      `Draw Targets: ${r.draw.slice(0, 3).map((d) => `${d.label} @ ${d.price} (${d.direction})`).join(", ")}`,
      this.iterations.length > 0
        ? `\nPrevious iterations in this run:\n${prevActions}`
        : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  /** Get a simple price trend from the last few reports. */
  getPriceTrend(): "up" | "down" | "sideways" {
    const reports = [this.currentReport, ...this.previousReports.slice(0, 3)].filter(
      (r): r is SmcReport => r !== null,
    );

    if (reports.length < 2) return "sideways";

    const prices = reports.map((r) => r.currentPrice);
    const avgChange = prices.slice(1).reduce((sum, p, i) => sum + (prices[i] - p), 0) / (prices.length - 1);
    const threshold = prices[0] * 0.002; // 0.2% threshold

    if (avgChange > threshold) return "up";
    if (avgChange < -threshold) return "down";
    return "sideways";
  }
}
