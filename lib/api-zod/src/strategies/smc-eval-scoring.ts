/**
 * SMC-EVAL 100-Point Scoring Engine (§8)
 *
 * Pure functions for scoring AI reasoning against SMC ground truth across
 * five dimensions:
 *   - Structural Accuracy (30)
 *   - Model Alignment (25)
 *   - Confluence & Reasoning (20)
 *   - Trade Precision (15)
 *   - Hallucination Avoidance (10)
 *
 * All functions are deterministic: same inputs always produce same scores.
 */

import type {
  StructuralAccuracyScore,
  ModelAlignmentScore,
  ConfluenceReasoningScore,
  TradePrecisionScore,
  HallucinationAvoidanceScore,
  SmcEvalScore,
  SMCGroundTruth,
  AiReasoningInput,
  SMCEvent,
  ModelCandidate,
  FailureFlag,
  ModelClassification,
} from "./smc-eval-types";

// ─── Structural Accuracy Scoring (§8.1) ──────────────────────────────────────

/**
 * Score structural accuracy by comparing detected events against ground truth.
 *
 * @param groundTruth   The ground-truth scenario record.
 * @param detectedEvents  Events identified by the AI/system.
 * @returns StructuralAccuracyScore (0-30).
 */
export function scoreStructuralAccuracy(
  groundTruth: SMCGroundTruth,
  detectedEvents: SMCEvent[],
): StructuralAccuracyScore {
  const gt = groundTruth.structure;

  // 1. Market structure direction (0-8)
  const aiDirection = normalizeDirection(detectedEvents);
  const correctDirection = aiDirection === gt.direction;
  const marketStructureDirection = correctDirection ? 8 : 0;

  // 2. BOS / MSS / CHoCH identification (0-8)
  const gtEventCount = gt.events.length;
  const matched = gt.events.filter((gte) =>
    detectedEvents.some(
      (de) =>
        de.type === gte.type &&
        de.direction === gte.direction &&
        de.timeframe === gte.timeframe,
    ),
  ).length;
  const bosMssChoCh = gtEventCount > 0
    ? Math.round((matched / gtEventCount) * 8)
    : 0;

  // 3. Liquidity events (0-6)
  const hasLiquiditySweep = detectedEvents.some(
    (e) => e.type === "LIQUIDITY_SWEEP",
  );
  const sweepMatches = groundTruth.liquidity.swept
    ? hasLiquiditySweep
      ? 3
      : 0
    : 3; // No sweep expected = full marks
  const liquidityEvents = sweepMatches + 3; // Remaining liquidity detection

  // 4. SMC structures (0-8)
  const conceptMatches = groundTruth.concepts.filter((c) =>
    detectedEvents.some((e) => e.type.toLowerCase() === c.toLowerCase()),
  ).length;
  const smcStructures = groundTruth.concepts.length > 0
    ? Math.round((conceptMatches / groundTruth.concepts.length) * 8)
    : 0;

  return {
    marketStructureDirection,
    bosMssChoCh: Math.min(8, bosMssChoCh),
    liquidityEvents: Math.min(6, liquidityEvents),
    smcStructures: Math.min(8, smcStructures),
    total: Math.min(30, marketStructureDirection + bosMssChoCh + liquidityEvents + smcStructures),
  };
}

function normalizeDirection(events: SMCEvent[]): string {
  const bullish = events.filter((e) => e.direction === "bullish").length;
  const bearish = events.filter((e) => e.direction === "bearish").length;
  if (bullish > bearish) return "BULLISH";
  if (bearish > bullish) return "BEARISH";
  return "RANGE";
}

// ─── Model Alignment Scoring (§8.2) ──────────────────────────────────────────

/**
 * Score how well AI model identification matches ground truth.
 *
 * @param groundTruth   The ground-truth scenario record.
 * @param aiModels      Models identified by the AI.
 * @returns ModelAlignmentScore (0-25).
 */
export function scoreModelAlignment(
  groundTruth: SMCGroundTruth,
  aiModels: ModelCandidate[],
): ModelAlignmentScore {
  const gtPrimary = groundTruth.models.primary;
  const gtAlternatives = groundTruth.models.alternatives;

  // 1. Primary model (0-12)
  const primaryMatch = aiModels.find(
    (m) => m.id === gtPrimary.id || m.name === gtPrimary.name,
  );
  const primaryModel = primaryMatch ? 12 : 0;

  // 2. Model prerequisites (0-6)
  // Score based on how many required predicates/concepts the AI identified
  const required = groundTruth.concepts;
  const aiConceptIds = aiModels.map((m) => m.id);
  const prereqsMatch = required.filter((c) =>
    aiConceptIds.some((aid) => aid.toLowerCase().includes(c.toLowerCase())),
  ).length;
  const modelPrerequisites = required.length > 0
    ? Math.round((prereqsMatch / required.length) * 6)
    : 6;

  // 3. Time/session constraints (0-4)
  const sessionInAnswer = aiModels.some((m) =>
    m.id.includes("silver-bullet") || m.id.includes("judas") || m.id.includes("temporal"),
  );
  const sessionInGround = gtPrimary.id.includes("silver-bullet") ||
    gtPrimary.id.includes("judas") ||
    gtPrimary.id.includes("temporal");
  const timeSessionConstraints = sessionInAnswer === sessionInGround ? 4 : 0;

  // 4. Model discrimination (0-3)
  const falsePositives = aiModels.filter(
    (m) =>
      m.id !== gtPrimary.id &&
      !gtAlternatives.some((a) => a.id === m.id) &&
      !groundTruth.models.rejected.some((r) => r.id === m.id),
  ).length;
  const modelDiscrimination = falsePositives === 0 ? 3 : Math.max(0, 3 - falsePositives);

  return {
    primaryModel,
    modelPrerequisites: Math.min(6, modelPrerequisites),
    timeSessionConstraints,
    modelDiscrimination,
    total: Math.min(25, primaryModel + modelPrerequisites + timeSessionConstraints + modelDiscrimination),
  };
}

// ─── Confluence & Reasoning Scoring (§8.3) ────────────────────────────────────

/**
 * Score reasoning quality. Uses AI-provided reasoning text length and
 * confidence score as proxies when full semantic analysis isn't available.
 *
 * @param groundTruth    The ground-truth scenario record.
 * @param aiInput        The AI's reasoning input (includes confidence score).
 * @param reasoningText  The AI's free-text reasoning.
 * @returns ConfluenceReasoningScore (0-20).
 */
export function scoreConfluenceReasoning(
  groundTruth: SMCGroundTruth,
  aiInput: AiReasoningInput | undefined,
  reasoningText: string,
): ConfluenceReasoningScore {
  // 1. HTF/LTF alignment (0-5)
  const tfAlignments = groundTruth.timeframeAlignment.length;
  const hasTfAwareness = reasoningText.toLowerCase().includes("htf") ||
    reasoningText.toLowerCase().includes("ltf") ||
    reasoningText.toLowerCase().includes("timeframe") ||
    tfAlignments > 0;
  const htfLtfAlignment = hasTfAwareness ? Math.min(5, 2 + Math.floor(tfAlignments / 2)) : 0;

  // 2. Liquidity narrative (0-5)
  const hasLiquidityDiscussion = reasoningText.toLowerCase().includes("liquidity") ||
    reasoningText.toLowerCase().includes("bsl") ||
    reasoningText.toLowerCase().includes("ssl") ||
    reasoningText.toLowerCase().includes("sweep");
  const liquidityNarrative = hasLiquidityDiscussion ? 5 : 0;

  // 3. Structural sequence (0-5)
  const hasSequence = reasoningText.toLowerCase().includes("first") ||
    reasoningText.toLowerCase().includes("then") ||
    reasoningText.toLowerCase().includes("subsequently") ||
    reasoningText.toLowerCase().includes("after");
  const structuralSequence = hasSequence ? 5 : 0;

  // 4. Causal reasoning (0-5)
  const hasCausality = reasoningText.toLowerCase().includes("because") ||
    reasoningText.toLowerCase().includes("therefore") ||
    reasoningText.toLowerCase().includes("indicates") ||
    reasoningText.toLowerCase().includes("confirms");
  const causalReasoning = hasCausality ? 5 : 0;

  return {
    htfLtfAlignment,
    liquidityNarrative,
    structuralSequence,
    causalReasoning,
    total: htfLtfAlignment + liquidityNarrative + structuralSequence + causalReasoning,
  };
}

// ─── Trade Precision Scoring (§8.4) ──────────────────────────────────────────

/**
 * Score the precision of the AI's proposed execution parameters.
 *
 * @param aiEntry    Entry zone description.
 * @param aiStop     Stop loss description.
 * @param aiTarget   Take profit description.
 * @param aiRR       Risk-reward ratio.
 * @param aiInvalidation  Invalidation description.
 * @returns TradePrecisionScore (0-15).
 */
export function scoreTradePrecision(
  aiEntry: string,
  aiStop: string,
  aiTarget: string,
  aiRR: number | null,
  aiInvalidation: string,
): TradePrecisionScore {
  // 1. Entry (0-4)
  const hasPrice = /\d/.test(aiEntry);
  const hasStructure = /fvg|ob|order\s*block|fvg|zone/i.test(aiEntry);
  const entry = hasPrice && hasStructure ? 4 : hasPrice || hasStructure ? 2 : 0;

  // 2. Stop loss (0-3)
  const hasSlLevel = /\d/.test(aiStop);
  const hasSlReason = /sweep|low|high|below|above|beyond/i.test(aiStop);
  const stopLoss = hasSlLevel && hasSlReason ? 3 : hasSlLevel || hasSlReason ? 1 : 0;

  // 3. Take profit (0-3)
  const hasTpLevel = /\d/.test(aiTarget);
  const hasTpReason = /liquidity|bsl|ssl|target|draw/i.test(aiTarget);
  const takeProfit = hasTpLevel && hasTpReason ? 3 : hasTpLevel || hasTpReason ? 1 : 0;

  // 4. Risk/reward (0-2)
  const riskReward = aiRR !== null && aiRR >= 2 ? 2 : aiRR !== null ? 1 : 0;

  // 5. Invalidation (0-3)
  const hasInvalidationLevel = /\d/.test(aiInvalidation);
  const hasInvalidationReason = /below|above|beyond|breaks|sweep|fails/i.test(aiInvalidation);
  const invalidation = hasInvalidationLevel && hasInvalidationReason ? 3 : hasInvalidationLevel || hasInvalidationReason ? 1 : 0;

  return {
    entry,
    stopLoss,
    takeProfit,
    riskReward,
    invalidation,
    total: entry + stopLoss + takeProfit + riskReward + invalidation,
  };
}

// ─── Hallucination Avoidance Scoring (§8.5) ──────────────────────────────────

/**
 * Score how well the AI avoids fabricating concepts or models.
 *
 * @param groundTruth     The ground-truth scenario record.
 * @param aiModelIds       IDs of models claimed by the AI.
 * @param allAvailableModelIds  All valid model IDs in the registry.
 * @returns HallucinationAvoidanceScore (0-10).
 */
export function scoreHallucinationAvoidance(
  groundTruth: SMCGroundTruth,
  aiModelIds: string[],
  allAvailableModelIds: string[],
): HallucinationAvoidanceScore {
  const valid = new Set(allAvailableModelIds);

  // 1. No unsupported concepts (0-4)
  const invalidModels = aiModelIds.filter((id) => !valid.has(id));
  const noUnsupportedConcepts = invalidModels.length === 0 ? 4 : Math.max(0, 4 - invalidModels.length);

  // 2. No fabricated model (0-3)
  // A fabricated model is one that doesn't exist in the registry at all
  const fabrications = aiModelIds.filter((id) => !valid.has(id) && id !== "").length;
  const noFabricatedModel = fabrications === 0 ? 3 : 0;

  // 3. Correctly identifies uncertainty (0-3)
  // Count how many rejected models the AI correctly identified as invalid
  const rejectedIds = new Set(groundTruth.models.rejected.map((m) => m.id));
  const correctlyRejected = aiModelIds.filter((id) => rejectedIds.has(id)).length;
  const correctUncertainty = correctlyRejected > 0 ? 3 : 0;

  return {
    noUnsupportedConcepts,
    noFabricatedModel,
    correctUncertainty,
    total: noUnsupportedConcepts + noFabricatedModel + correctUncertainty,
  };
}

// ─── Composite Score (§8) ────────────────────────────────────────────────────

const CLASSIFICATION_THRESHOLDS = [
  { min: 90, label: "Expert-Level" },
  { min: 80, label: "Strong" },
  { min: 70, label: "Competent" },
  { min: 55, label: "Developing" },
  { min: 0, label: "Weak" },
];

function classifyScore(total: number): string {
  for (const t of CLASSIFICATION_THRESHOLDS) {
    if (total >= t.min) return t.label;
  }
  return "Weak";
}

/**
 * Compute the full 100-point SMC-EVAL composite score.
 *
 * @returns SmcEvalScore with all dimension scores and overall total.
 */
export function computeSmcEvalScore(params: {
  groundTruth: SMCGroundTruth;
  detectedEvents: SMCEvent[];
  aiModels: ModelCandidate[];
  aiInput?: AiReasoningInput;
  reasoningText: string;
  aiEntry: string;
  aiStop: string;
  aiTarget: string;
  aiRR: number | null;
  aiInvalidation: string;
  allModelIds: string[];
}): SmcEvalScore {
  const structuralAccuracy = scoreStructuralAccuracy(params.groundTruth, params.detectedEvents);
  const modelAlignment = scoreModelAlignment(params.groundTruth, params.aiModels);
  const confluenceReasoning = scoreConfluenceReasoning(params.groundTruth, params.aiInput, params.reasoningText);
  const tradePrecision = scoreTradePrecision(params.aiEntry, params.aiStop, params.aiTarget, params.aiRR, params.aiInvalidation);
  const hallucinationAvoidance = scoreHallucinationAvoidance(params.groundTruth, params.aiModels.map((m) => m.id), params.allModelIds);

  const total = structuralAccuracy.total + modelAlignment.total +
    confluenceReasoning.total + tradePrecision.total + hallucinationAvoidance.total;

  // Compute failure flags
  const failureFlags: FailureFlag[] = [];
  if (hallucinationAvoidance.noFabricatedModel < 3) failureFlags.push("MODEL_HALLUCINATION");
  if (modelAlignment.timeSessionConstraints < 3) failureFlags.push("TIME_CONSTRAINT_VIOLATION");
  if (confluenceReasoning.htfLtfAlignment < 2) failureFlags.push("HTF_LTF_CONFLICT");

  return {
    structuralAccuracy,
    modelAlignment,
    confluenceReasoning,
    tradePrecision,
    hallucinationAvoidance,
    total: Math.min(100, total),
    classification: classifyScore(total),
    failureFlags: failureFlags.length > 0 ? failureFlags : undefined,
  };
}

// ─── Model Classification Helper (§9) ────────────────────────────────────────

/**
 * Determine how an AI's model identification classifies against ground truth.
 */
export function classifyModelMatch(
  aiModelIds: string[],
  groundTruth: SMCGroundTruth,
): { classification: ModelClassification; failureFlags: FailureFlag[] } {
  const gtPrimaryId = groundTruth.models.primary.id;
  const gtAltIds = new Set(groundTruth.models.alternatives.map((m) => m.id));
  const gtRejectedIds = new Set(groundTruth.models.rejected.map((m) => m.id));
  const validIds = new Set([
    gtPrimaryId,
    ...gtAltIds,
    ...gtRejectedIds,
    ...groundTruth.concepts.map((c) => c.toLowerCase()),
  ]);

  const flags: FailureFlag[] = [];
  let classification: ModelClassification;

  const foundPrimary = aiModelIds.includes(gtPrimaryId);
  const foundAlts = aiModelIds.filter((id) => gtAltIds.has(id));
  const foundRejected = aiModelIds.filter((id) => gtRejectedIds.has(id));
  const foundInvalid = aiModelIds.filter((id) => !validIds.has(id));

  if (foundPrimary) {
    classification = aiModelIds.length === 1 ? "PRIMARY" : "ALTERNATIVE";
  } else if (foundAlts.length > 0) {
    classification = "PARTIAL";
  } else if (foundRejected.length > 0) {
    classification = "PARTIAL";
  } else if (foundInvalid.length > 0) {
    classification = "HALLUCINATED";
    flags.push("MODEL_HALLUCINATION");
  } else {
    classification = "INCORRECT";
  }

  if (foundInvalid.length > 0 && classification !== "HALLUCINATED") {
    flags.push("MODEL_HALLUCINATION");
  }

  return { classification, failureFlags: flags };
}
