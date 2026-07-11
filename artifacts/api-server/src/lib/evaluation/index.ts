/**
 * LLM-as-Judge Evaluator — Ragas-equivalent for Node.js.
 *
 * Scores agent outputs on faithfulness, answer relevance, and correctness
 * using the existing LLM provider. Designed to plug into the AgentLoop
 * evaluation step and the Performance Matrix.
 */

import { z } from "zod";
import { resolveLlmConfig } from "../llm/provider.js";
import { extractStructured, extractArray } from "../llm/structured.js";
import { logger } from "../logger.js";
import type { EvaluationScore, AgentOutputEvaluation, SignalQualityEvaluation } from "./types.js";

// ─── Zod Schemas ──────────────────────────────────────────────────────────

const FaithfulnessSchema = z.object({
  supportedClaims: z.array(z.string()).describe("Claims that ARE supported by the context"),
  unsupportedClaims: z.array(z.string()).describe("Claims NOT supported by the context"),
  score: z.number().min(0).max(1).describe("Faithfulness score: proportion of supported claims"),
});

const RelevanceSchema = z.object({
  relevanceScore: z.number().min(0).max(1).describe("How relevant the answer is to the question/context"),
  missingPoints: z.array(z.string()).describe("Important points the answer missed"),
  feedback: z.string().describe("Brief explanation of the relevance score"),
});

const OverallEvalSchema = z.object({
  faithfulness: z.number().min(0).max(1),
  answerRelevance: z.number().min(0).max(1),
  correctness: z.number().min(0).max(1),
  overall: z.number().min(0).max(100),
  feedback: z.string(),
});

// ─── Evaluator Class ──────────────────────────────────────────────────────

export class AgentEvaluator {
  /**
   * Evaluate a single agent output — faithfulness + relevance + correctness.
   */
  async evaluateAgentOutput(
    agentName: string,
    input: string,
    output: string,
  ): Promise<AgentOutputEvaluation> {
    const scores = await Promise.all([
      this.scoreFaithfulness(output, input),
      this.scoreRelevance(output, input),
      this.scoreCorrectness(output, input),
    ]);

    const [faithfulness, answerRelevance, correctness] = scores;

    const overall = Math.round(
      (faithfulness.score * 40 + answerRelevance.relevanceScore * 30 + correctness * 30),
    );

    return {
      agentName,
      input,
      output,
      scores: {
        faithfulness: faithfulness.score,
        answerRelevance: answerRelevance.relevanceScore,
        correctness,
        overall,
        feedback: `Faithfulness: ${faithfulness.score.toFixed(2)}, Relevance: ${answerRelevance.relevanceScore.toFixed(2)}, Correctness: ${correctness.toFixed(2)}`,
      },
      timestamp: Date.now(),
    };
  }

  /**
   * Evaluate a batch of agent outputs and return aggregate scores.
   */
  async evaluateBatch(
    items: Array<{ agentName: string; input: string; output: string }>,
  ): Promise<{ evaluations: AgentOutputEvaluation[]; aggregate: EvaluationScore }> {
    const evaluations = await Promise.all(
      items.map((item) => this.evaluateAgentOutput(item.agentName, item.input, item.output)),
    );

    const aggregate: EvaluationScore = {
      faithfulness: evaluations.reduce((s, e) => s + e.scores.faithfulness, 0) / evaluations.length,
      answerRelevance: evaluations.reduce((s, e) => s + e.scores.answerRelevance, 0) / evaluations.length,
      correctness: evaluations.reduce((s, e) => s + e.scores.correctness, 0) / evaluations.length,
      overall: Math.round(evaluations.reduce((s, e) => s + e.scores.overall, 0) / evaluations.length),
      feedback: `Aggregated from ${evaluations.length} evaluations`,
    };

    return { evaluations, aggregate };
  }

  /**
   * Evaluate a signal after outcome is known (for the Performance Matrix).
   */
  evaluateSignal(signal: SignalQualityEvaluation): SignalQualityEvaluation {
    if (!signal.actualOutcome) return signal;

    const entryPrice = signal.predictedEntry;
    const exitPrice = signal.actualOutcome.exitPrice;

    let entryAccuracy: number | null = null;
    if (entryPrice && exitPrice) {
      entryAccuracy = Math.max(0, 1 - Math.abs(exitPrice - entryPrice) / entryPrice);
    }

    let directionCorrect: boolean | null = null;
    if (signal.direction && entryPrice && exitPrice) {
      if (signal.direction === "long") {
        directionCorrect = exitPrice >= entryPrice;
      } else {
        directionCorrect = exitPrice <= entryPrice;
      }
    }

    const score = signal.actualOutcome.win
      ? Math.round(60 + (directionCorrect ? 20 : 0) + (entryAccuracy ? entryAccuracy * 20 : 0))
      : Math.round(Math.max(10, 50 - (directionCorrect ? 0 : 20) - (entryAccuracy ? (1 - entryAccuracy) * 20 : 10)));

    return {
      ...signal,
      entryAccuracy: entryAccuracy ? Math.round(entryAccuracy * 10000) / 10000 : null,
      directionCorrect,
      score,
    };
  }

  // ── Private scoring methods ──────────────────────────────────────────

  private async scoreFaithfulness(
    output: string,
    context: string,
  ): Promise<{ score: number; supported: string[]; unsupported: string[] }> {
    try {
      const { data } = await extractStructured(
        FaithfulnessSchema,
        "You evaluate AI analyst outputs for faithfulness. Identify which claims are supported by the provided context and which are not.",
        `CONTEXT:\n${context.slice(0, 2000)}\n\nOUTPUT:\n${output.slice(0, 2000)}\n\nIdentify claims and classify them as supported or unsupported.`,
        { maxTokens: 512, temperature: 0.1 },
      );
      return {
        score: data.score,
        supported: data.supportedClaims,
        unsupported: data.unsupportedClaims,
      };
    } catch (err: any) {
      logger.warn({ err: err.message }, "Faithfulness eval failed, returning default");
      return { score: 0.5, supported: [], unsupported: ["Evaluation failed"] };
    }
  }

  private async scoreRelevance(
    output: string,
    context: string,
  ): Promise<{ relevanceScore: number; missingPoints: string[]; feedback: string }> {
    try {
      const { data } = await extractStructured(
        RelevanceSchema,
        "You evaluate how relevant an AI analyst's answer is to the given context.",
        `QUESTION/CONTEXT:\n${context.slice(0, 1500)}\n\nANSWER:\n${output.slice(0, 1500)}\n\nHow relevant is this answer?`,
        { maxTokens: 512, temperature: 0.1 },
      );
      return data;
    } catch (err: any) {
      logger.warn({ err: err.message }, "Relevance eval failed, returning default");
      return { relevanceScore: 0.5, missingPoints: [], feedback: "Evaluation failed" };
    }
  }

  private async scoreCorrectness(
    output: string,
    context: string,
  ): Promise<number> {
    try {
      const { data } = await extractStructured(
        OverallEvalSchema.pick({ overall: true, correctness: true, feedback: true }),
        "You evaluate the correctness of SMC/ICT trading analysis. Check if price levels, bias, and analysis are accurate.",
        `CONTEXT:\n${context.slice(0, 1500)}\n\nANALYSIS:\n${output.slice(0, 1500)}\n\nScore the correctness of this analysis.`,
        { maxTokens: 512, temperature: 0.1 },
      );
      return data.correctness;
    } catch (err: any) {
      return 0.5;
    }
  }
}
