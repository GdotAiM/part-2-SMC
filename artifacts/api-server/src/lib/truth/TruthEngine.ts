/**
 * Truth Engine — Decision Arbitration Layer
 *
 * Sits between Evidence Fusion and the AI. Consumes FusedDecision[]
 * and produces a single authoritative TruthVerdict per detection level.
 *
 * The AI no longer has to compare 50 things.
 * The Truth Engine hands it one clear answer per level.
 *
 * Arbitration factors:
 *   1. Historical reliability per detection type per source
 *   2. Outcome history (did this source's levels hold last time?)
 *   3. Current market context (session, volatility regime)
 *   4. Agreement pattern (both see it? only one? conflicting?)
 *   5. Confidence gap between sources
 *
 * Output: the AI gets { level, price, source, confidence, reasoning }
 *   — not a comparison to figure out.
 */

import { logger } from "../logger.js";
import type { FusedDecision } from "../fusion/EvidenceFusionLayer.js";

// ─── Truth Verdict — what the AI actually needs ────────────────────────

export interface TruthVerdict {
  detectionType: string;

  // The single authoritative price level (not two competing ones)
  adoptedPrice: number;

  // Who was chosen as the truth source
  chosenSource: "TV" | "ENGINE" | "BOTH_AGREE" | "COMPOSITE";
  /** Why this source was chosen */
  selectionRationale: string;

  // Final confidence after arbitration (0–1)
  finalConfidence: number;

  // Fallback strategy used when sources disagree
  arbitrationStrategy: ArbitrationStrategy;

  // Clean explanation for the AI
  verdictNarrative: string;

  // Supporting evidence (already resolved — not conflicting)
  evidence: string[];

  // What was discarded and why
  discardedInfo: Array<{ source: string; reason: string }>;

  // Arbitration timestamp
  arbitratedAt: Date;
}

export type ArbitrationStrategy =
  | "BOTH_AGREE"           // Both sources detected, price matches — highest confidence
  | "TRUST_HIGHER_RELIABILITY" // One source has much better historical accuracy for this type
  | "TRUST_MORE_RECENT"    // One source has better recent outcome trend
  | "FALLBACK_COMPOSITE"   // Neither reliable enough — blend both with discount
  | "TV_FALLBACK"          // Engine missed it, TV caught it — trust TV
  | "ENGINE_FALLBACK"      // TV missed it, engine caught it — trust engine
  | "INSUFFICIENT_DATA"    // Neither source detected, or too few samples
  ;

// ─── Arbitration context ───────────────────────────────────────────────

export interface ArbitrationContext {
  /** Current market regime (trending, ranging, volatile) */
  marketRegime: string;
  /** Current session */
  session: string;
  /** ATR % of current price (volatility proxy) */
  volatilityPct: number;
}

// ─── Truth Engine ─────────────────────────────────────────────────────

export class TruthEngine {
  /**
   * Arbitrate a single detection level and produce one authoritative verdict.
   */
  arbitrate(
    fused: FusedDecision,
    reliabilityByType: Record<string, { tv: number; engine: number }>,
    outcomeHistory: { tv: { correct: number; total: number }; engine: { correct: number; total: number } },
    context: ArbitrationContext,
  ): TruthVerdict {
    const { detectionType, priceLevel, tvConfidence, engineConfidence } = fused;
    const discardedInfo: Array<{ source: string; reason: string }> = [];

    // Get reliability scores from actual data (fall back to defaults via ReliabilityEngine)
    const tvRel = reliabilityByType[detectionType]?.tv ?? 0.75;
    const engRel = reliabilityByType[detectionType]?.engine ?? 0.70;

    // Compute outcome-based adjustment
    const tvOutcomeRate = outcomeHistory.tv.total > 5
      ? outcomeHistory.tv.correct / outcomeHistory.tv.total
      : null;
    const engOutcomeRate = outcomeHistory.engine.total > 5
      ? outcomeHistory.engine.correct / outcomeHistory.engine.total
      : null;

    // Combine reliability + outcome into effective trust score
    const tvTrust = tvOutcomeRate != null
      ? (tvRel * 0.6 + tvOutcomeRate * 0.4)
      : tvRel;
    const engTrust = engOutcomeRate != null
      ? (engRel * 0.6 + engOutcomeRate * 0.4)
      : engRel;

    // ─── Arbitration logic ───────────────────────────────────────────────

    let chosenSource: TruthVerdict["chosenSource"];
    let adoptedPrice: number;
    let finalConfidence: number;
    let strategy: ArbitrationStrategy;
    let selectionRationale: string;

    // Case 1: Both detected and agree on price
    if (fused.agreementScore > 0.8 && fused.recommendedSource === "BOTH") {
      chosenSource = "BOTH_AGREE";
      adoptedPrice = priceLevel;
      finalConfidence = Math.min(0.98, fused.compositeConfidence * (1 + Math.min(tvTrust, engTrust) * 0.1));
      strategy = "BOTH_AGREE";
      selectionRationale = `Both sources detected ${detectionType} at ${priceLevel.toFixed(5)} with price discrepancy of ${((fused as any).priceDiscrepancyPct || 0) * 100}%. High agreement.`;
    }

    // Case 2: Only TV detected
    else if (fused.recommendedSource === "TV") {
      chosenSource = "TV";
      adoptedPrice = fused.tvConfidence != null ? (fused as any).tvPrice ?? priceLevel : priceLevel;
      finalConfidence = tvTrust * (fused.tvConfidence ?? 0.8);
      strategy = "TV_FALLBACK";
      selectionRationale = `Engine missed this ${detectionType}. TV detected it with ${((fused.tvConfidence ?? 0.8) * 100).toFixed(0)}% native confidence. TV historical reliability for ${detectionType}: ${(tvTrust * 100).toFixed(0)}%.`;
      discardedInfo.push({ source: "ENGINE", reason: `Did not detect ${detectionType} at this level` });
    }

    // Case 3: Only Engine detected
    else if (fused.recommendedSource === "ENGINE") {
      chosenSource = "ENGINE";
      adoptedPrice = fused.engineConfidence != null ? (fused as any).enginePrice ?? priceLevel : priceLevel;
      finalConfidence = engTrust * (fused.engineConfidence ?? 0.7);
      strategy = "ENGINE_FALLBACK";
      selectionRationale = `TV missed this ${detectionType}. Engine detected it with ${((fused.engineConfidence ?? 0.7) * 100).toFixed(0)}% confidence. Engine reliability for ${detectionType}: ${(engTrust * 100).toFixed(0)}%.`;
      discardedInfo.push({ source: "TV", reason: `Did not detect ${detectionType} at this level` });
    }

    // Case 4: Neither — insufficient data
    else if (fused.recommendedSource === "NEITHER") {
      chosenSource = "COMPOSITE";
      adoptedPrice = priceLevel;
      finalConfidence = 0.15;
      strategy = "INSUFFICIENT_DATA";
      selectionRationale = `Neither source detected ${detectionType}. Level inferred from broader context. Low confidence.`;
    }

    // Case 5: Both disagree (conflicting levels or sources) — arbitrate by trust
    else {
      const trustGap = Math.abs(tvTrust - engTrust);

      if (trustGap > 0.15) {
        // Clear reliability leader
        chosenSource = tvTrust > engTrust ? "TV" : "ENGINE";
        adoptedPrice = chosenSource === "TV"
          ? ((fused as any).tvPrice ?? priceLevel)
          : ((fused as any).enginePrice ?? priceLevel);
        finalConfidence = Math.max(tvTrust, engTrust) * 0.85;
        strategy = "TRUST_HIGHER_RELIABILITY";
        selectionRationale = `Sources disagree. ${chosenSource} has significantly higher historical reliability for ${detectionType} (${(Math.max(tvTrust, engTrust) * 100).toFixed(0)}% vs ${(Math.min(tvTrust, engTrust) * 100).toFixed(0)}%). Trusting ${chosenSource}.`;
        const discarded = chosenSource === "TV" ? "ENGINE" : "TV";
        discardedInfo.push({ source: discarded, reason: `Lower historical reliability for ${detectionType} (${(Math.min(tvTrust, engTrust) * 100).toFixed(0)}%)` });
      } else {
        // Close trust scores — use market context as tiebreaker
        const tvAdaptsToVolatility = context.volatilityPct > 0.01 ? 0.05 : 0; // TV handles vol slightly better
        const engineFinal = engTrust + (context.session === "london" || context.session === "newYork" ? 0.03 : 0); // Engine slightly better in liquid sessions

        chosenSource = tvTrust + tvAdaptsToVolatility > engineFinal ? "TV" : "ENGINE";
        adoptedPrice = chosenSource === "TV"
          ? ((fused as any).tvPrice ?? priceLevel)
          : ((fused as any).enginePrice ?? priceLevel);
        finalConfidence = Math.max(tvTrust, engTrust) * 0.80;
        strategy = "FALLBACK_COMPOSITE";
        selectionRationale = `Sources disagree but reliability is similar. Market context tiebreaker: ${context.session} session, ${(context.volatilityPct * 100).toFixed(2)}% volatility. Trusting ${chosenSource} by narrow margin.`;
        const discarded = chosenSource === "TV" ? "ENGINE" : "TV";
        discardedInfo.push({ source: discarded, reason: "Tiebreaker: session context and volatility" });
      }
    }

    // ─── Build verdict narrative ─────────────────────────────────────────

    const parts: string[] = [];
    parts.push(`${detectionType}: ${adoptedPrice.toFixed(5)} (source: ${chosenSource}).`);
    parts.push(`Confidence: ${(finalConfidence * 100).toFixed(0)}%.`);
    parts.push(selectionRationale);

    if (discardedInfo.length > 0) {
      parts.push(`Discarded: ${discardedInfo.map(d => `${d.source} (${d.reason})`).join("; ")}.`);
    }

    const evidence: string[] = [];
    evidence.push(`TV reliability for ${detectionType}: ${(tvTrust * 100).toFixed(0)}%`);
    evidence.push(`Engine reliability for ${detectionType}: ${(engTrust * 100).toFixed(0)}%`);
    if (tvOutcomeRate != null) evidence.push(`TV outcome accuracy: ${(tvOutcomeRate * 100).toFixed(0)}% (${outcomeHistory.tv.total} samples)`);
    if (engOutcomeRate != null) evidence.push(`Engine outcome accuracy: ${(engOutcomeRate * 100).toFixed(0)}% (${outcomeHistory.engine.total} samples)`);
    evidence.push(`Market context: ${context.session}, ${context.marketRegime}, ${(context.volatilityPct * 100).toFixed(2)}% vol`);

    return {
      detectionType,
      adoptedPrice,
      chosenSource,
      selectionRationale,
      finalConfidence: Math.min(0.99, Math.max(0.05, finalConfidence)),
      arbitrationStrategy: strategy,
      verdictNarrative: parts.join(" "),
      evidence,
      discardedInfo,
      arbitratedAt: new Date(),
    };
  }

  /**
   * Arbitrate an entire set of fused decisions and return a full market picture.
   * This is what gets handed to the AI — one clean, resolved structure.
   */
  arbitrateAll(
    fusedDecisions: FusedDecision[],
    reliabilityByType: Record<string, { tv: number; engine: number }>,
    outcomeHistory: { tv: { correct: number; total: number }; engine: { correct: number; total: number } },
    context: ArbitrationContext,
  ): ArbitratedMarketView {
    const verdicts = fusedDecisions.map(fd =>
      this.arbitrate(fd, reliabilityByType, outcomeHistory, context)
    );

    // Compute overall market confidence
    const confidentVerdicts = verdicts.filter(v => v.finalConfidence > 0.5);
    const overallConfidence = verdicts.length > 0
      ? Math.round((verdicts.reduce((s, v) => s + v.finalConfidence, 0) / verdicts.length) * 10000) / 100
      : 0;

    // Group verdicts by strategy for the summary
    const strategyBreakdown: Record<string, number> = {};
    for (const v of verdicts) {
      strategyBreakdown[v.arbitrationStrategy] = (strategyBreakdown[v.arbitrationStrategy] || 0) + 1;
    }

    // Build concise market summary for the AI
    const summaryParts: string[] = [];
    summaryParts.push(`MARKET INTELLIGENCE — ${verdicts.length} levels analyzed, ${confidentVerdicts.length} with >50% confidence.`);
    summaryParts.push(`Overall arbitration confidence: ${overallConfidence}%.`);
    summaryParts.push(`Context: ${context.session}, ${context.marketRegime}, ${(context.volatilityPct * 100).toFixed(2)}% vol.`);

    // Add the most significant levels
    const topVerdicts = verdicts.filter(v => v.finalConfidence > 0.3).sort((a, b) => b.finalConfidence - a.finalConfidence);
    for (const v of topVerdicts.slice(0, 8)) {
      summaryParts.push(`  ${v.detectionType}: ${v.adoptedPrice.toFixed(5)} [${(v.finalConfidence * 100).toFixed(0)}%] — ${v.chosenSource}`);
    }

    return {
      overallConfidence,
      verdicts,
      strategyBreakdown,
      marketSummary: summaryParts.join("\n"),
      arbitratedAt: new Date(),
      context,
    };
  }
}

// ─── Arbitrated Market View — the AI's input ───────────────────────────

export interface ArbitratedMarketView {
  overallConfidence: number;
  verdicts: TruthVerdict[];
  strategyBreakdown: Record<string, number>;
  marketSummary: string;
  arbitratedAt: Date;
  context: ArbitrationContext;
}

export const truthEngine = new TruthEngine();
