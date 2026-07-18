/**
 * SMC-EVAL Ground Truth & Evaluation Types
 *
 * Implements the SMC-EVAL benchmark specification (§10, §8, §9) for
 * evaluating AI systems on ICT/SMC market structure reasoning.
 *
 * All interfaces are pure data types — no runtime logic.
 */

import type { OntologyCategory, ModelPriority } from "./rules";

// ─── SMC-EVAL Result Classification (§9) ─────────────────────────────────----

/**
 * Classification of an AI's model identification against ground truth.
 */
export type ModelClassification =
  | "PRIMARY"       // AI identified the exact primary model
  | "ALTERNATIVE"   // AI identified a valid alternative model
  | "PARTIAL"       // AI identified some but not all required elements
  | "INCORRECT"     // AI identified a model not present
  | "HALLUCINATED"; // AI fabricated a concept or model

/**
 * Failure flags that downgrade a classification.
 */
export type FailureFlag =
  | "MODEL_HALLUCINATION"
  | "STRUCTURAL_CONTRADICTION"
  | "TIME_CONSTRAINT_VIOLATION"
  | "HTF_LTF_CONFLICT"
  | "UNSUPPORTED_TRADE";

// ─── SMC-EVAL 100-Point Scoring Dimensions (§8) ──────────────────────────────

export interface StructuralAccuracyScore {
  marketStructureDirection: number;  // 0-8
  bosMssChoCh: number;               // 0-8
  liquidityEvents: number;           // 0-6
  smcStructures: number;             // 0-8
  total: number;                     // 0-30
}

export interface ModelAlignmentScore {
  primaryModel: number;       // 0-12
  modelPrerequisites: number; // 0-6
  timeSessionConstraints: number; // 0-4
  modelDiscrimination: number;    // 0-3
  total: number;                  // 0-25
}

export interface ConfluenceReasoningScore {
  htfLtfAlignment: number;   // 0-5
  liquidityNarrative: number; // 0-5
  structuralSequence: number; // 0-5
  causalReasoning: number;    // 0-5
  total: number;             // 0-20
}

export interface TradePrecisionScore {
  entry: number;       // 0-4
  stopLoss: number;    // 0-3
  takeProfit: number;  // 0-3
  riskReward: number;  // 0-2
  invalidation: number;// 0-3
  total: number;       // 0-15
}

export interface HallucinationAvoidanceScore {
  noUnsupportedConcepts: number;   // 0-4
  noFabricatedModel: number;       // 0-3
  correctUncertainty: number;      // 0-3
  total: number;                   // 0-10
}

export interface SmcEvalScore {
  structuralAccuracy: StructuralAccuracyScore;
  modelAlignment: ModelAlignmentScore;
  confluenceReasoning: ConfluenceReasoningScore;
  tradePrecision: TradePrecisionScore;
  hallucinationAvoidance: HallucinationAvoidanceScore;
  total: number;             // 0-100
  classification?: string;   // "Expert-Level" | "Strong" | "Competent" | "Developing" | "Weak"
  failureFlags?: FailureFlag[];
}

// ─── SMC-EVAL Ground Truth Record (§10) ──────────────────────────────────────

export interface SMCEvent {
  type: string;          // "BOS" | "MSS" | "CHoCH" | "FVG" | "LIQUIDITY_SWEEP" etc.
  timeframe: string;
  direction: string;
  price?: number;
  index?: number;
}

export interface LiquidityTarget {
  type: string;          // "BSL" | "SSL" | "EQH" | "EQL"
  price: number;
  distance?: number;
}

export interface ModelCandidate {
  id: string;
  name: string;
  ontology: OntologyCategory;
  confidence: number;
}

export interface TimeframeRelationship {
  higherTf: string;
  lowerTf: string;
  alignment: "BULLISH" | "BEARISH" | "NEUTRAL" | "CONFLICT";
}

export interface ExecutionContext {
  direction: "LONG" | "SHORT";
  entryTrigger: string;
  stopLevel: string;
  targetLevel: string;
  minimumRR: number;
  invalidation: string;
}

export interface EvaluationMetadata {
  evaluator: "DETERMINISTIC" | "AI" | "HUMAN";
  version: string;
  timestamp: string;
  scenarioId: string;
}

export interface SMCGroundTruth {
  scenarioId: string;

  market: {
    asset: string;
    session?: string;
    timestamp: string;
  };

  structure: {
    direction: "BULLISH" | "BEARISH" | "RANGE";
    events: SMCEvent[];
  };

  liquidity: {
    swept?: string;
    remaining?: LiquidityTarget[];
  };

  concepts: string[];

  models: {
    primary: ModelCandidate;
    alternatives: ModelCandidate[];
    rejected: ModelCandidate[];
  };

  timeframeAlignment: TimeframeRelationship[];

  execution?: ExecutionContext;

  evaluation: EvaluationMetadata;
}

// ─── Evaluation Result ───────────────────────────────────────────────────────

export interface AiReasoningInput {
  modelId: string;
  modelName: string;
  reasoning: string;
  confidenceScore: number;
}

export interface SmcEvalEvaluationResult {
  scenarioId: string;
  timestamp: string;
  groundTruth: SMCGroundTruth;
  aiInput?: AiReasoningInput;
  scores: SmcEvalScore;
  modelClassification: ModelClassification;
  failureFlags: FailureFlag[];
}
