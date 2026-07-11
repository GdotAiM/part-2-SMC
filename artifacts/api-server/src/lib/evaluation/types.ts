/**
 * Evaluation Types — Ragas-equivalent evaluation schemas.
 *
 * Used by the LLM-as-judge evaluator to score agent outputs on
 * faithfulness, answer relevance, and correctness.
 */

export interface EvaluationScore {
  /** Faithfulness: Are claims supported by the context? 0-1 */
  faithfulness: number;
  /** Answer relevance: How well does the answer address the question? 0-1 */
  answerRelevance: number;
  /** Correctness: Are price levels, bias, and SMC analysis accurate? 0-1 */
  correctness: number;
  /** Overall composite score 0-100 */
  overall: number;
  /** Human-readable feedback */
  feedback: string;
}

export interface AgentOutputEvaluation {
  agentName: string;
  input: string;
  output: string;
  scores: EvaluationScore;
  timestamp: number;
}

export interface SignalQualityEvaluation {
  signalId: string;
  symbol: string;
  direction: "long" | "short" | null;
  predictedEntry: number | null;
  predictedStop: number | null;
  predictedTarget: number | null;
  /** After outcome is known */
  actualOutcome?: {
    exitPrice: number;
    win: boolean;
    pnl: number;
  };
  /** Accuracy metrics */
  entryAccuracy: number | null;
  directionCorrect: boolean | null;
  score: number;
}
