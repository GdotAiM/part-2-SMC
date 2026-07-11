/**
 * Loop Evaluator — post-run scoring and memory ingestion.
 *
 * Scores completed AgentLoop runs, compares predicted outcomes against actual
 * results, and stores the evaluation back into semantic memory for future learning.
 */

import type { RunEvaluation } from "./types.js";
import type { LoopIteration, LoopResult } from "../loop/types.js";
import type { UnifiedTradeSignal } from "../services/SignalGenerator.js";
import { SemanticMemory } from "../memory/SemanticMemory.js";

export class LoopEvaluator {
  private semanticMemory: SemanticMemory;

  constructor(semanticMemory: SemanticMemory) {
    this.semanticMemory = semanticMemory;
  }

  /**
   * Score a completed run based on its iterations and result.
   */
  scoreRun(iterations: LoopIteration[], result: LoopResult): RunEvaluation {
    const closedIterations = iterations.filter((i) => i.completedAt);
    const totalTime = closedIterations.reduce((sum, i) => sum + (i.completedAt! - i.startedAt), 0);

    // Count tool calls across all steps
    let totalTools = 0;
    let totalTokens = 0;
    for (const iter of closedIterations) {
      for (const step of iter.steps) {
        totalTools += step.toolCalls?.length ?? 0;
        totalTokens += step.tokensUsed ?? 0;
      }
    }

    // Base score on result quality
    let baseScore = 0;
    switch (result.action) {
      case "signal_generated":
        baseScore = 80; // Generated a signal — most valuable outcome
        break;
      case "analysis_complete":
        baseScore = 60; // Produced analysis
        break;
      case "no_action":
        baseScore = 40; // Correctly decided no action
        break;
      case "error":
        baseScore = 10; // Something went wrong
        break;
    }

    // Adjust for confidence
    const confidenceBonus = Math.round((result.confidence / 100) * 15);
    // Adjust for tool usage (using too few may mean incomplete, too many may mean inefficient)
    const toolEfficiency = totalTools > 0 && totalTools <= 11
      ? Math.round((1 - totalTools / 20) * 5)
      : 0;

    const finalScore = Math.min(100, Math.max(0, baseScore + confidenceBonus + toolEfficiency));

    // Determine strengths and weaknesses
    const strengths: string[] = [];
    const weaknesses: string[] = [];

    if (result.action === "signal_generated") strengths.push("Generated actionable signal");
    if (result.confidence >= 70) strengths.push(`High confidence decision (${result.confidence}%)`);
    if (totalTools >= 3 && totalTools <= 8) strengths.push(`Used ${totalTools} tools for comprehensive analysis`);
    if (totalTime < 30000) strengths.push("Fast execution");

    if (result.action === "error") weaknesses.push("Run completed with errors");
    if (result.confidence < 50) weaknesses.push(`Low confidence decision (${result.confidence}%)`);
    if (totalTools === 0) weaknesses.push("No tools were called — analysis may be incomplete");
    if (totalTime > 60000) weaknesses.push(`Slow execution (${(totalTime / 1000).toFixed(1)}s)`);

    return {
      loopRunId: "",
      score: finalScore,
      metrics: {
        accuracy: 0, // Unknown until outcome is known
        confidenceCalibration: result.confidence / 100,
        responseTimeMs: totalTime,
        toolsUsed: totalTools,
        tokensUsed: totalTokens,
        iterationsUsed: closedIterations.length,
      },
      strengths,
      weaknesses,
      suggestedImprovements: weaknesses.map((w) => `Address: ${w.toLowerCase()}`),
    };
  }

  /**
   * Compare predicted signal direction/levels against actual outcome.
   * Only meaningful after a trade has closed.
   */
  evaluateSignalPrediction(
    signal: UnifiedTradeSignal,
    actualOutcome: { exitPrice: number; win: boolean; pnl: number },
  ): { accuracy: number; error: number; calibrated: boolean } {
    // Direction accuracy: was the predicted direction correct?
    const entryPrice = signal.entry_price;
    const isLongSignal = signal.setup_subtype.includes("BULLISH") || signal.analysis_context.htf_bias === "BULLISH";
    const expectedDirection = isLongSignal ? "long" : "short";

    const actualDirection = actualOutcome.exitPrice > entryPrice ? "long" : "short";
    const directionCorrect = expectedDirection === actualDirection;

    // Price error as percentage of entry
    const priceError = Math.abs(actualOutcome.exitPrice - entryPrice) / entryPrice;

    // Calibration: did confidence correlate with outcome?
    const calibrated = actualOutcome.win
      ? signal.confidence_score >= 60
      : signal.confidence_score < 60;

    return {
      accuracy: directionCorrect ? 1 : 0,
      error: Math.round(priceError * 10000) / 10000,
      calibrated,
    };
  }

  /**
   * Store an evaluation result as a semantic memory entry.
   */
  async persistEvaluation(evaluation: RunEvaluation, runId: string): Promise<void> {
    // Store the aggregate evaluation on the run record
    const { db } = await import("@workspace/db");
    const { agentLoopRuns } = await import("@workspace/db/schema");
    const { eq } = await import("drizzle-orm");

    await (db as any)
      .update(agentLoopRuns)
      .set({
        evaluation_score: evaluation.score,
        evaluation: evaluation as any,
      })
      .where(eq(agentLoopRuns.id, runId));

    // Store evaluation insights as semantic memory
    for (const weakness of evaluation.weaknesses) {
      await this.semanticMemory.storeEntry({
        key: `eval|${runId.slice(0, 8)}|weakness`,
        content: `Run ${runId.slice(0, 8)} weakness: ${weakness}`,
        source: "evaluation",
        score: 0.5,
        tags: ["evaluation", "weakness"],
        isDurable: true,
        sourceRunId: runId,
      });
    }

    for (const strength of evaluation.strengths) {
      await this.semanticMemory.storeEntry({
        key: `eval|${runId.slice(0, 8)}|strength`,
        content: `Run ${runId.slice(0, 8)} strength: ${strength}`,
        source: "evaluation",
        score: 0.8,
        tags: ["evaluation", "strength"],
        isDurable: true,
        sourceRunId: runId,
      });
    }
  }
}
