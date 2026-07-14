/**
 * Learning Service — Phase 4
 *
 * Persistence layer for the Learning & Validation Framework.
 * Stores detection comparisons, outcomes, model performance,
 * parameter history, learning events, and pattern statistics.
 *
 * All comparisons are versioned and never overwritten.
 */

import { db } from "@workspace/db";
import type {
  ComparisonRecord,
  DetectionType,
} from "../comparison/ComparisonEngine.js";
import type { FusedDecision } from "../fusion/EvidenceFusionLayer.js";
import { logger } from "../logger.js";

// ─── Detection Comparison Persistence ───────────────────────────────────

export class LearningService {
  /**
   * Store a batch of comparison records to the database.
   */
  async storeComparisons(records: ComparisonRecord[]): Promise<number> {
    if (!process.env.DATABASE_URL) {
      logger.info({ count: records.length }, "[LearningService] DB not configured — skipping comparison storage");
      return 0;
    }

    try {
      if (records.length === 0) return 0;
      const { detectionComparisons } = await import("@workspace/db/schema");
      const fmt = (v: number | null | undefined, places = 8): string | null =>
        v != null ? v.toFixed(places) : null;
      const ts = records[0].candleTime ? new Date(records[0].candleTime).getTime() : Date.now();
      const candleTime = new Date(ts);

      // Insert one row at a time to avoid esbuild naming conflicts
      let inserted = 0;
      for (const r of records) {
        try {
          await db.insert(detectionComparisons).values({
            symbol: r.symbol,
            timeframe: r.timeframe,
            market: r.market,
            detection_type: r.detectionType,
            price_level: fmt(r.priceLevel)!,
            tv_detected: r.tv.detected,
            tv_confidence: r.tv.confidence != null ? fmt(r.tv.confidence, 4) : null,
            tv_price: r.tv.price != null ? fmt(r.tv.price) : null,
            tv_metadata: r.tv.metadata,
            engine_detected: r.engine.detected,
            engine_confidence: r.engine.confidence != null ? fmt(r.engine.confidence, 4) : null,
            engine_price: r.engine.price != null ? fmt(r.engine.price) : null,
            engine_metadata: r.engine.metadata,
            agreement: r.agreement,
            price_discrepancy_pct: r.priceDiscrepancyPct != null ? fmt(r.priceDiscrepancyPct, 4) : null,
            confidence_gap: r.confidenceGap != null ? fmt(r.confidenceGap, 4) : null,
            candle_time: candleTime,
            signal_id: r.signalId,
          });
          inserted++;
        } catch (rowErr: any) {
          logger.warn({ err: rowErr.message, detectionType: r.detectionType, price: r.priceLevel }, "[LearningService] Skipping row insert error");
        }
      }

      logger.info({ count: inserted, total: records.length }, "[LearningService] Stored comparisons");
      return inserted;
    } catch (err: any) {
      logger.error({ err: err.message || String(err) }, "[LearningService] Failed to store comparisons");
      return 0;
    }
  }

  /**
   * Store detection outcomes (after evaluating future candles).
   */
  async storeOutcomes(
    outcomes: Array<{
      comparisonId: string;
      outcome: string;
      touchPrice?: number;
      maxExtension?: number;
      barsUntilTouch?: number;
      correctSource?: string;
      wouldWin?: boolean;
      hypotheticalPnlPct?: number;
      marketRegime?: string;
      sessionAtTouch?: string;
    }>,
  ): Promise<number> {
    if (!process.env.DATABASE_URL) return 0;
    try {
      const { detectionOutcomes } = await import("@workspace/db/schema");
      const values = outcomes.map(o => ({
        comparison_id: o.comparisonId,
        outcome: o.outcome,
        touch_price: o.touchPrice != null ? String(o.touchPrice) : null,
        max_extension: o.maxExtension != null ? String(o.maxExtension) : null,
        bars_until_touch: o.barsUntilTouch ?? null,
        correct_source: o.correctSource ?? null,
        would_win: o.wouldWin ?? null,
        hypothetical_pnl_pct: o.hypotheticalPnlPct != null ? String(o.hypotheticalPnlPct) : null,
        market_regime_at_touch: o.marketRegime ?? null,
        session_at_touch: o.sessionAtTouch ?? null,
      }));
      const result = await db.insert(detectionOutcomes).values(values).returning();
      logger.info({ count: result.length }, "[LearningService] Stored outcomes");
      return result.length;
    } catch (err: any) {
      logger.error({ err: err.message }, "[LearningService] Failed to store outcomes");
      return 0;
    }
  }

  /**
   * Update or create model performance records.
   */
  async updateModelPerformance(
    source: "TV" | "ENGINE",
    detectionType: string,
    wasCorrect: boolean,
  ): Promise<void> {
    if (!process.env.DATABASE_URL) return;
    try {
      const { modelPerformance } = await import("@workspace/db/schema");
      const { eq, and, sql } = await import("drizzle-orm");

      const existing = await db.select()
        .from(modelPerformance)
        .where(and(
          eq(modelPerformance.source, source),
          eq(modelPerformance.detection_type, detectionType),
        ))
        .limit(1);

      if (existing.length > 0) {
        const row = existing[0];
        const newTotal = row.total_detections + 1;
        const newCorrect = row.correct_detections + (wasCorrect ? 1 : 0);
        const reliability = newTotal > 0 ? newCorrect / newTotal : 0;

        await db.update(modelPerformance)
          .set({
            total_detections: newTotal,
            correct_detections: newCorrect,
            false_positives: row.false_positives + (!wasCorrect ? 1 : 0),
            reliability_score: String(reliability),
            rolling_30d_accuracy: String(reliability),
            last_updated: new Date(),
          })
          .where(eq(modelPerformance.id, row.id));
      } else {
        await db.insert(modelPerformance).values({
          source,
          detection_type: detectionType,
          total_detections: 1,
          correct_detections: wasCorrect ? 1 : 0,
          false_positives: wasCorrect ? 0 : 1,
          reliability_score: wasCorrect ? "1.0" : "0.0",
          rolling_30d_accuracy: wasCorrect ? "1.0" : "0.0",
        });
      }
    } catch (err: any) {
      logger.error({ err: err.message }, "[LearningService] Failed to update model performance");
    }
  }

  /**
   * Log a learning event.
   */
  async logLearningEvent(params: {
    eventType: string;
    title: string;
    description: string;
    evidence?: Record<string, any>;
    significance?: number;
  }): Promise<string | null> {
    if (!process.env.DATABASE_URL) return null;
    try {
      const { learningEvents } = await import("@workspace/db/schema");
      const result = await db.insert(learningEvents).values({
        event_type: params.eventType,
        title: params.title,
        description: params.description,
        evidence: params.evidence ?? {},
        significance: params.significance != null ? String(params.significance) : "0.5",
      }).returning();
      return result[0]?.id ?? null;
    } catch (err: any) {
      logger.error({ err: err.message }, "[LearningService] Failed to log learning event");
      return null;
    }
  }

  /**
   * Record a parameter recommendation.
   */
  async recordParameterSuggestion(params: {
    component: string;
    parameterName: string;
    currentValue: number;
    suggestedValue: number;
    sampleSize: number;
    winRateImprovement?: number;
    confidence: number;
  }): Promise<string | null> {
    if (!process.env.DATABASE_URL) return null;
    try {
      const { parameterHistory } = await import("@workspace/db/schema");
      const result = await db.insert(parameterHistory).values({
        component: params.component,
        parameter_name: params.parameterName,
        current_value: String(params.currentValue),
        suggested_value: String(params.suggestedValue),
        sample_size: params.sampleSize,
        win_rate_improvement: params.winRateImprovement != null ? String(params.winRateImprovement) : null,
        confidence: String(params.confidence),
        status: "suggested",
      }).returning();
      return result[0]?.id ?? null;
    } catch (err: any) {
      logger.error({ err: err.message }, "[LearningService] Failed to record parameter suggestion");
      return null;
    }
  }

  /**
   * Update pattern statistics with a new observation.
   */
  async recordPatternObservation(params: {
    patternName: string;
    patternType: string;
    description: string;
    conditions: Record<string, any>;
    win: boolean;
  }): Promise<void> {
    if (!process.env.DATABASE_URL) return;
    try {
      const { patternStatistics } = await import("@workspace/db/schema");
      const { eq, sql } = await import("drizzle-orm");

      const existing = await db.select()
        .from(patternStatistics)
        .where(eq(patternStatistics.pattern_name, params.patternName))
        .limit(1);

      if (existing.length > 0) {
        const row = existing[0];
        const newCount = row.occurrence_count + 1;
        const currentWinRate = row.win_rate_when_present != null ? parseFloat(row.win_rate_when_present) : 0;
        // Weighted update
        const newWinRate = ((currentWinRate * row.occurrence_count) + (params.win ? 1 : 0)) / newCount;

        await db.update(patternStatistics)
          .set({
            occurrence_count: newCount,
            win_rate_when_present: String(newWinRate),
            last_observed: new Date(),
          })
          .where(eq(patternStatistics.id, row.id));
      } else {
        await db.insert(patternStatistics).values({
          pattern_name: params.patternName,
          pattern_type: params.patternType,
          description: params.description,
          conditions: params.conditions,
          occurrence_count: 1,
          win_rate_when_present: params.win ? "1.0" : "0.0",
          confidence: params.win ? "0.5" : "0.3",
        });
      }
    } catch (err: any) {
      logger.error({ err: err.message }, "[LearningService] Failed to record pattern");
    }
  }
}

export const learningService = new LearningService();
