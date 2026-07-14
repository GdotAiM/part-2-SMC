/**
 * AI Reflection Engine — Phase 8
 *
 * After every completed trade (or detection evaluation), creates a structured
 * reflection answering:
 *   - Where did our engine disagree with TV?
 *   - Who was correct?
 *   - Why?
 *   - What pattern emerged?
 *   - Should confidence change?
 *   - Should reliability change?
 *   - Should new rules be proposed?
 */

import { logger } from "../logger.js";
import { reliabilityEngine } from "../reliability/ReliabilityEngine.js";
import { learningService } from "../learning/LearningService.js";
import type { OutcomeEval } from "../evaluation/OutcomeEvaluator.js";

// ─── Types ──────────────────────────────────────────────────────────────

export interface TradeReflection {
  tradeId: string;
  symbol: string;
  timeframe: string;
  setupType: string;
  entryPrice: number;
  exitPrice: number;
  pnl: number;
  pnlPercent: number;
  win: boolean;

  // Disagreement analysis
  disagreements: Array<{
    detectionType: string;
    engineSaid: boolean;
    tvSaid: boolean;
    correctSource: string;
    priceLevel: number;
  }>;

  // Reflection answers
  keyDisagreement: string;
  whoWasCorrect: "TV" | "ENGINE" | "BOTH" | "NEITHER";
  whyExplanation: string;
  patternIdentified: string | null;

  // Recommended changes
  confidenceChanges: Array<{ detectionType: string; direction: "increase" | "decrease"; amount: number; reason: string }>;
  reliabilityChanges: Array<{ detectionType: string; source: "TV" | "ENGINE"; newScore: number }>;
  newRules: string[];

  // Meta
  reflectedAt: Date;
}

// ─── Engine ─────────────────────────────────────────────────────────────

export class ReflectionEngine {
  /**
   * Generate a structured reflection from trade data and outcome evaluations.
   */
  async reflect(params: {
    tradeId: string;
    symbol: string;
    timeframe: string;
    setupType: string;
    entryPrice: number;
    exitPrice: number;
    pnl: number;
    pnlPercent: number;
    win: boolean;
    outcomeEvaluations: OutcomeEval[];
    comparisons: Array<{ detectionType: string; tv: { detected: boolean }; engine: { detected: boolean }; priceLevel: number }>;
  }): Promise<TradeReflection> {
    const { tradeId, symbol, timeframe, setupType, entryPrice, exitPrice, pnl, pnlPercent, win, outcomeEvaluations, comparisons } = params;

    // 1. Analyze disagreements
    const disagreements: TradeReflection["disagreements"] = [];
    for (const comp of comparisons) {
      const outcome = outcomeEvaluations.find(o => o.detectionType === comp.detectionType);
      if (!outcome) continue;
      disagreements.push({
        detectionType: comp.detectionType,
        engineSaid: comp.engine.detected,
        tvSaid: comp.tv.detected,
        correctSource: outcome.correctSource,
        priceLevel: comp.priceLevel,
      });
    }

    // 2. Determine who was correct overall
    const tvCorrect = outcomeEvaluations.filter(o => o.correctSource === "TV" || o.correctSource === "BOTH").length;
    const engineCorrect = outcomeEvaluations.filter(o => o.correctSource === "ENGINE" || o.correctSource === "BOTH").length;
    const total = outcomeEvaluations.filter(o => o.correctSource !== "NEITHER").length;
    let whoWasCorrect: TradeReflection["whoWasCorrect"] = "NEITHER";
    if (total > 0) {
      if (tvCorrect > engineCorrect) whoWasCorrect = "TV";
      else if (engineCorrect > tvCorrect) whoWasCorrect = "ENGINE";
      else whoWasCorrect = "BOTH";
    }

    // 3. Key disagreement (the one with biggest impact)
    const sortedDisagreements = disagreements
      .filter(d => d.engineSaid !== d.tvSaid)
      .sort((a, b) => Math.abs(b.priceLevel - entryPrice) - Math.abs(a.priceLevel - entryPrice));
    const keyDisagreement = sortedDisagreements[0]?.detectionType ?? "none";

    // 4. Pattern identification
    const patternIdentified = this.identifyPattern(disagreements, win);

    // 5. Confidence change recommendations
    const confidenceChanges: TradeReflection["confidenceChanges"] = [];
    for (const d of disagreements) {
      if (d.correctSource === "BOTH" || d.correctSource === "NEITHER") continue;
      const direction = d.correctSource === "TV" ? "decrease" : "increase";
      confidenceChanges.push({
        detectionType: d.detectionType,
        direction,
        amount: direction === "increase" ? 0.05 : 0.03,
        reason: `${d.detectionType}: ${d.correctSource} was correct, ${d.correctSource === "TV" ? "engine missed" : "TV missed"}`,
      });
    }

    // 6. Reliability changes based on outcome
    const reliabilityChanges: TradeReflection["reliabilityChanges"] = [];
    for (const o of outcomeEvaluations) {
      const engineRel = reliabilityEngine.getTypeReliability(o.detectionType, "ENGINE");
      const tvRel = reliabilityEngine.getTypeReliability(o.detectionType, "TV");

      if (o.correctSource === "ENGINE" || o.correctSource === "BOTH") {
        reliabilityChanges.push({ detectionType: o.detectionType, source: "ENGINE", newScore: Math.min(100, engineRel + 1) });
      }
      if (o.correctSource === "TV" || o.correctSource === "BOTH") {
        reliabilityChanges.push({ detectionType: o.detectionType, source: "TV", newScore: Math.min(100, tvRel + 1) });
      }
      if (o.correctSource === "NEITHER") {
        reliabilityChanges.push({ detectionType: o.detectionType, source: "ENGINE", newScore: Math.max(10, engineRel - 2) });
        reliabilityChanges.push({ detectionType: o.detectionType, source: "TV", newScore: Math.max(10, tvRel - 2) });
      }
    }

    // 7. New rule proposals
    const newRules: string[] = [];
    const failurePatterns = disagreements.filter(d => d.correctSource !== "ENGINE" && d.correctSource !== "BOTH");
    if (failurePatterns.length >= 3) {
      const types = [...new Set(failurePatterns.map(d => d.detectionType))];
      newRules.push(`When ${types.join(" and ")} are present and engine misses, verify against TV levels before trading`);
    }
    if (!win && whoWasCorrect === "ENGINE") {
      newRules.push("Engine was correct but trade lost — check execution parameters and R:R");
    }

    // 8. Why explanation
    const whyExplanation = this.buildExplanation(disagreements, outcomeEvaluations, win, whoWasCorrect);

    // 9. Store reflection as learning event
    await learningService.logLearningEvent({
      eventType: disagreementCount(disagreements) > 0 ? "DISAGREEMENT_PATTERN" : "SUCCESS_PATTERN",
      title: `${symbol} ${timeframe} ${setupType} — ${win ? "Win" : "Loss"} reflection`,
      description: whyExplanation,
      evidence: { disagreements, outcomeEvaluations, pnl, pnlPercent },
      significance: win ? 0.3 : 0.7, // Losses generate more learning
    });

    return {
      tradeId, symbol, timeframe, setupType, entryPrice, exitPrice, pnl, pnlPercent, win,
      disagreements,
      keyDisagreement,
      whoWasCorrect,
      whyExplanation,
      patternIdentified,
      confidenceChanges,
      reliabilityChanges,
      newRules,
      reflectedAt: new Date(),
    };
  }

  private identifyPattern(disagreements: TradeReflection["disagreements"], win: boolean): string | null {
    const patterns: string[] = [];
    const engMissed = disagreements.filter(d => !d.engineSaid && d.tvSaid);
    const tvMissed = disagreements.filter(d => d.engineSaid && !d.tvSaid);

    if (engMissed.length >= 2) patterns.push(`Engine consistently misses ${engMissed.map(d => d.detectionType).join(", ")}`);
    if (tvMissed.length >= 2) patterns.push(`Internal Engine catches ${tvMissed.map(d => d.detectionType).join(", ")} that TV misses`);
    if (engMissed.length > tvMissed.length && !win) patterns.push("Loss correlated with engine blind spots");
    if (tvMissed.length > engMissed.length && win) patterns.push("Win despite TV gaps — engine adding value");

    return patterns.length > 0 ? patterns.join("; ") : null;
  }

  private buildExplanation(
    disagreements: TradeReflection["disagreements"],
    outcomes: OutcomeEval[],
    win: boolean,
    whoWasCorrect: string,
  ): string {
    const parts: string[] = [];
    parts.push(`Trade ${win ? "won" : "lost"}.`);
    parts.push(`Overall, ${whoWasCorrect} was more often correct across ${outcomes.length} detection evaluations.`);

    const tvOnly = disagreements.filter(d => d.tvSaid && !d.engineSaid);
    const engineOnly = disagreements.filter(d => d.engineSaid && !d.tvSaid);
    if (tvOnly.length > 0) parts.push(`TV detected ${tvOnly.length} levels the engine missed (${tvOnly.map(d => d.detectionType).join(", ")}).`);
    if (engineOnly.length > 0) parts.push(`Engine detected ${engineOnly.length} levels TV missed (${engineOnly.map(d => d.detectionType).join(", ")}).`);

    return parts.join(" ");
  }
}

function disagreementCount(d: TradeReflection["disagreements"]): number {
  return d.filter(x => x.engineSaid !== x.tvSaid).length;
}

export const reflectionEngine = new ReflectionEngine();
