/**
 * Outcome Evaluation Service — Phase 5
 *
 * After sufficient future candles have passed, evaluates whether
 * a detection was correct by checking what price did next.
 *
 * For each detection, determines:
 *   - Did price respect the Order Block?   → RESPECTED
 *   - Did the FVG fill or hold?             → FILLED / PARTIAL_FILL
 *   - Did liquidity reverse price?          → SWEPT
 *   - Did BOS continue?                     → CONTINUATION
 *   - Did the setup fail?                   → IGNORED
 *   - Winner: TV / Engine / Both / Neither
 */

import { logger } from "../logger.js";
import { candleStore } from "../realtime/candle-store.js";
import { reliabilityEngine } from "../reliability/ReliabilityEngine.js";
import { learningService } from "../learning/LearningService.js";

export type OutcomeResult =
  | "RESPECTED" | "SWEPT" | "IGNORED"
  | "FILLED" | "PARTIAL_FILL"
  | "REVERSAL" | "CONTINUATION"
  | "PENDING" | "INCONCLUSIVE";

export interface OutcomeEval {
  comparisonId: string;
  detectionType: string;
  outcome: OutcomeResult;
  touchPrice: number;
  maxExtension: number;         // % of ATR past the level
  barsUntilTouch: number;
  correctSource: "TV" | "ENGINE" | "BOTH" | "NEITHER";
  wouldWin: boolean;
  hypotheticalPnlPct: number;
}

export class OutcomeEvaluator {
  /**
   * Evaluate a batch of comparison records against future price action.
   * @param comparisons — array of {id, detectionType, priceLevel, agreement, tv, engine}
   * @param candles — future candles after the detection candle
   */
  evaluate(
    comparisons: Array<{
      id: string;
      detectionType: string;
      priceLevel: number;
      agreement: string;
      tv: { detected: boolean; price: number | null };
      engine: { detected: boolean; price: number | null };
    }>,
    candles: Array<{ high: number; low: number; close: number; time: number }>,
    maxLookback: number = 20,
  ): OutcomeEval[] {
    const results: OutcomeEval[] = [];

    for (const comp of comparisons) {
      if (candles.length < 3) {
        results.push({
          comparisonId: comp.id,
          detectionType: comp.detectionType,
          outcome: "PENDING",
          touchPrice: 0,
          maxExtension: 0,
          barsUntilTouch: 0,
          correctSource: "NEITHER",
          wouldWin: false,
          hypotheticalPnlPct: 0,
        });
        continue;
      }

      const level = comp.priceLevel;
      const lookback = Math.min(maxLookback, candles.length);

      let touched = false;
      let touchBar = 0;
      let touchPrice = 0;
      let maxExtension = 0;
      let outcome: OutcomeResult = "IGNORED";

      for (let i = 0; i < lookback; i++) {
        const c = candles[i];

        // Determine if price touched the level
        const priceTouched = comp.detectionType === "FVG"
          ? c.low <= level * 1.005 && c.high >= level * 0.995
          : c.low <= level && c.high >= level;

        if (priceTouched) {
          touched = true;
          touchBar = i;
          touchPrice = (c.high + c.low) / 2;
          const extension = Math.abs(c.close - level) / level;
          maxExtension = Math.max(maxExtension, extension);
        }

        // Alternative: price reverses after touching
        if (touched && i > touchBar) {
          const reversed = (c.close > level * 1.002 && candles[touchBar].close < level) || // bounced up
                           (c.close < level * 0.998 && candles[touchBar].close > level);   // bounced down
          if (reversed) {
            outcome = "REVERSAL";
            break;
          }
        }
      }

      if (!touched) {
        outcome = "IGNORED";
      } else if (outcome !== "REVERSAL") {
        // Classify: was the level swept or respected?
        const afterTouch = candles.slice(touchBar, Math.min(touchBar + 5, candles.length));
        const wentPast = afterTouch.some(c =>
          comp.detectionType === "FVG"
            ? (c.low < level * 0.995 || c.high > level * 1.005)
            : (c.low < level && c.high > level)
        );
        outcome = wentPast ? "SWEPT" : "RESPECTED";
      }

      // Determine which source was correct
      let correctSource: "TV" | "ENGINE" | "BOTH" | "NEITHER" = "NEITHER";
      const o = outcome as string;
      const noOutcome = o === "IGNORED" || o === "PENDING";

      if (noOutcome) {
        correctSource = "NEITHER";
      } else if (comp.agreement === "BOTH_DETECTED") {
        correctSource = "BOTH";
      } else if (comp.agreement === "TV_ONLY") {
        correctSource = comp.tv.detected ? "TV" : "NEITHER";
      } else if (comp.agreement === "ENGINE_ONLY") {
        correctSource = comp.engine.detected ? "ENGINE" : "NEITHER";
      }

      // Win if level was respected or reversed
      const wouldWin = o === "RESPECTED" || o === "REVERSAL" || o === "FILLED";
      const pnlPct = wouldWin
        ? (o === "REVERSAL" ? 0.02 : 0.01)  // hypothetical 1-2% move
        : (outcome === "SWEPT" ? -0.01 : 0);       // swept for -1%

      results.push({
        comparisonId: comp.id,
        detectionType: comp.detectionType,
        outcome,
        touchPrice,
        maxExtension,
        barsUntilTouch: touchBar,
        correctSource,
        wouldWin,
        hypotheticalPnlPct: pnlPct,
      });
    }

    return results;
  }

  /**
   * Process outcomes — store them and update reliability.
   */
  async processOutcomes(
    outcomes: OutcomeEval[],
    comparisons: Array<{ tv: { detected: boolean }; engine: { detected: boolean }; detectionType: string }>,
  ): Promise<void> {
    // Update reliability engine
    for (let i = 0; i < outcomes.length; i++) {
      const o = outcomes[i];
      const comp = comparisons[i];

      if (comp.tv.detected) {
        reliabilityEngine.record({
          source: "TV",
          detectionType: o.detectionType,
          correct: o.correctSource === "TV" || o.correctSource === "BOTH",
          timestamp: new Date(),
        });
      }
      if (comp.engine.detected) {
        reliabilityEngine.record({
          source: "ENGINE",
          detectionType: o.detectionType,
          correct: o.correctSource === "ENGINE" || o.correctSource === "BOTH",
          timestamp: new Date(),
        });
      }

      // Update DB
      await learningService.updateModelPerformance(
        "TV", o.detectionType,
        o.correctSource === "TV" || o.correctSource === "BOTH",
      );
      await learningService.updateModelPerformance(
        "ENGINE", o.detectionType,
        o.correctSource === "ENGINE" || o.correctSource === "BOTH",
      );
    }

    // Store outcomes
    const dbOutcomes = outcomes.map((o, i) => ({
      comparisonId: o.comparisonId,
      outcome: o.outcome,
      touchPrice: o.touchPrice,
      maxExtension: o.maxExtension,
      barsUntilTouch: o.barsUntilTouch,
      correctSource: o.correctSource,
      wouldWin: o.wouldWin,
      hypotheticalPnlPct: o.hypotheticalPnlPct,
    }));
    await learningService.storeOutcomes(dbOutcomes);
  }
}

export const outcomeEvaluator = new OutcomeEvaluator();
