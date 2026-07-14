/**
 * Evidence Fusion Layer — Phase 3
 *
 * Combines TradingView evidence + Internal Engine evidence + Historical reliability
 * + Market context + Previous outcomes + AI confidence into a unified decision.
 *
 * The result is NOT "TradingView wins" or "Engine wins".
 * It produces: Composite Confidence, Agreement Score, Reliability Score,
 * Decision Explanation, Supporting Evidence, Contradicting Evidence, Unknown Factors.
 */

import { logger } from "../logger.js";
import type { ComparisonRecord } from "../comparison/ComparisonEngine.js";

// ─── Fusion Result ─────────────────────────────────────────────────────

export interface FusedDecision {
  detectionType: string;
  priceLevel: number;

  // Composite scores
  compositeConfidence: number;       // 0–1 final confidence
  agreementScore: number;            // 0–1 how much the two sources agree
  reliabilityScore: number;          // 0–1 based on historical accuracy

  // What each source says
  tvConfidence: number | null;
  engineConfidence: number | null;

  // Explicit reasoning
  supportingEvidence: string[];
  contradictingEvidence: string[];
  unknownFactors: string[];

  // Decision explanation
  explanation: string;

  // Winner (if determinable)
  recommendedSource: "TV" | "ENGINE" | "BOTH" | "NEITHER";

  // Timestamp
  fusedAt: Date;
}

// ─── Per-type historical reliability defaults ───────────────────────────

const DEFAULT_RELIABILITY: Record<string, number> = {
  OB: 0.85, FVG: 0.82, BOS: 0.78, CHOCH: 0.72, MSS: 0.70,
  LIQUIDITY_SWEEP: 0.87, EQH: 0.65, EQL: 0.65,
  PREMIUM: 0.80, DISCOUNT: 0.80, SMT: 0.64,
  SESSION_BREAKOUT: 0.90, DISPLACEMENT: 0.75, BIAS: 0.88,
};

const DEFAULT_TV_RELIABILITY: Record<string, number> = {
  OB: 0.90, FVG: 0.88, BOS: 0.82, CHOCH: 0.76, MSS: 0.74,
  LIQUIDITY_SWEEP: 0.85, EQH: 0.70, EQL: 0.70,
  PREMIUM: 0.82, DISCOUNT: 0.82, SMT: 0.68,
  SESSION_BREAKOUT: 0.88, DISPLACEMENT: 0.78, BIAS: 0.90,
};

// ─── Fusion Engine ─────────────────────────────────────────────────────

export class EvidenceFusionLayer {
  private reliabilityOverrides: Record<string, { engine: number; tv: number }> = {};

  /**
   * Update reliability scores based on accumulated data.
   */
  updateReliabilityOverride(detectionType: string, engineReliability: number, tvReliability: number): void {
    this.reliabilityOverrides[detectionType] = { engine: engineReliability, tv: tvReliability };
  }

  getReliability(source: "TV" | "ENGINE", detectionType: string): number {
    const override = this.reliabilityOverrides[detectionType];
    if (override) return source === "ENGINE" ? override.engine : override.tv;
    return source === "ENGINE"
      ? (DEFAULT_RELIABILITY[detectionType] ?? 0.7)
      : (DEFAULT_TV_RELIABILITY[detectionType] ?? 0.75);
  }

  /**
   * Fuse evidence from a comparison record into a decision.
   */
  fuse(comparison: ComparisonRecord): FusedDecision {
    const { detectionType, priceLevel, tv, engine, agreement } = comparison;

    const engineReliability = this.getReliability("ENGINE", detectionType);
    const tvReliability = this.getReliability("TV", detectionType);

    // Weighted composite confidence
    let compositeConfidence: number;
    const supporting: string[] = [];
    const contradicting: string[] = [];
    const unknown: string[] = [];

    if (agreement === "BOTH_DETECTED") {
      // Both agree — boost confidence
      const avg = ((tv.confidence ?? tvReliability) + (engine.confidence ?? engineReliability)) / 2;
      const boost = Math.min(tvReliability, engineReliability) * 0.15;
      compositeConfidence = Math.min(0.98, avg + boost);
      supporting.push(`TV and Internal Engine both detected ${detectionType}`);
      supporting.push(`TV reliability: ${(tvReliability * 100).toFixed(0)}%, Engine reliability: ${(engineReliability * 100).toFixed(0)}%`);
      if (comparison.priceDiscrepancyPct != null && comparison.priceDiscrepancyPct < 0.001) {
        supporting.push(`Price levels agree within ${(comparison.priceDiscrepancyPct * 100).toFixed(2)}%`);
      }
    } else if (agreement === "TV_ONLY") {
      // Only TV detected
      compositeConfidence = (tv.confidence ?? tvReliability) * 0.85;
      supporting.push(`TradingView detected ${detectionType} which the engine missed`);
      supporting.push(`TV reliability for ${detectionType}: ${(tvReliability * 100).toFixed(0)}%`);
      contradicting.push(`Internal Engine did not detect this ${detectionType}`);
      unknown.push(`Engine may lack sensitivity for this specific ${detectionType} pattern`);
    } else if (agreement === "ENGINE_ONLY") {
      // Only engine detected
      compositeConfidence = (engine.confidence ?? engineReliability) * 0.85;
      supporting.push(`Internal Engine detected ${detectionType} which TV did not`);
      supporting.push(`Engine reliability for ${detectionType}: ${(engineReliability * 100).toFixed(0)}%`);
      contradicting.push(`TradingView did not show this ${detectionType}`);
      unknown.push(`TV indicator may not be configured for this specific detection pattern`);
    } else {
      // Neither
      compositeConfidence = 0.1;
      unknown.push(`Neither source detected ${detectionType} at this level`);
      unknown.push("Consider checking if the indicator is properly configured");
    }

    // Agreement score
    const agreementScore = agreement === "BOTH_DETECTED" ? 0.95
      : agreement === "TV_ONLY" ? 0.5
      : agreement === "ENGINE_ONLY" ? 0.5
      : 0.05;

    // Recommended source
    let recommendedSource: FusedDecision["recommendedSource"] = "BOTH";
    if (agreement === "BOTH_DETECTED") {
      recommendedSource = (engineReliability > tvReliability) ? "ENGINE" : "TV";
    } else if (agreement === "TV_ONLY") {
      recommendedSource = "TV";
    } else if (agreement === "ENGINE_ONLY") {
      recommendedSource = "ENGINE";
    } else {
      recommendedSource = "NEITHER";
    }

    // Explanation
    const explanation = this.buildExplanation(detectionType, priceLevel, agreement, compositeConfidence, supporting, contradicting, unknown);

    return {
      detectionType,
      priceLevel,
      compositeConfidence: Math.round(compositeConfidence * 10000) / 10000,
      agreementScore: Math.round(agreementScore * 10000) / 10000,
      reliabilityScore: Math.round(((engineReliability + tvReliability) / 2) * 10000) / 10000,
      tvConfidence: tv.confidence,
      engineConfidence: engine.confidence,
      supportingEvidence: supporting,
      contradictingEvidence: contradicting,
      unknownFactors: unknown,
      explanation,
      recommendedSource,
      fusedAt: new Date(),
    };
  }

  private buildExplanation(
    detectionType: string,
    priceLevel: number,
    agreement: string,
    confidence: number,
    supporting: string[],
    contradicting: string[],
    unknown: string[],
  ): string {
    const parts: string[] = [];
    const dirWord = agreement === "BOTH_DETECTED" ? "Confirmed" : agreement === "NEITHER" ? "Unconfirmed" : "Detected by one source";
    parts.push(`${dirWord} ${detectionType} at ${priceLevel.toFixed(5)}.`);
    parts.push(`Composite confidence: ${(confidence * 100).toFixed(0)}%.`);
    if (supporting.length > 0) parts.push(`Supporting: ${supporting.join("; ")}.`);
    if (contradicting.length > 0) parts.push(`Contradicting: ${contradicting.join("; ")}.`);
    if (unknown.length > 0) parts.push(`Unknown factors: ${unknown.join("; ")}.`);
    return parts.join(" ");
  }

  /**
   * Fuse multiple comparison records into a single array of decisions.
   */
  fuseAll(comparisons: ComparisonRecord[]): FusedDecision[] {
    return comparisons.map(c => this.fuse(c));
  }
}

export const evidenceFusionLayer = new EvidenceFusionLayer();
