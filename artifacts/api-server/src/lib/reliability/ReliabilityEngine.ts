/**
 * Reliability Engine — Phase 6
 *
 * Instead of one global confidence score, computes reliability by feature type.
 * Accumulates over time from historical outcomes: performance improves with data.
 *
 * Example output:
 *   Order Blocks: 96%
 *   FVG: 91%
 *   Liquidity: 87%
 *   CHOCH: 72%
 *   SMT: 64%
 *   Bias: 94%
 *   Sessions: 98%
 */

import { logger } from "../../logger.js";

// ─── Types ──────────────────────────────────────────────────────────────

export interface ReliabilityReport {
  overall: number;
  byType: Record<string, number>;
  bySource: {
    tv: number;
    engine: number;
  };
  byTypeBySource: Record<string, { tv: number; engine: number }>;
  sampleSizes: Record<string, number>;
  trend: "improving" | "stable" | "declining" | "insufficient_data";
  recommendedFocus: string[];  // Which detection types need the most improvement
}

interface ReliabilitySample {
  source: "TV" | "ENGINE";
  detectionType: string;
  correct: boolean;
  timestamp: Date;
  marketRegime?: string;
  symbol?: string;
  timeframe?: string;
}

// ─── In-memory accumulator (also persisted to DB) ───────────────────────

export class ReliabilityEngine {
  private samples: ReliabilitySample[] = [];
  private readonly maxSamples = 10000;
  private dbReliabilityLoaded = false;

  /**
   * Record a new reliability data point.
   */
  record(sample: ReliabilitySample): void {
    this.samples.push(sample);
    // Keep memory bounded
    if (this.samples.length > this.maxSamples) {
      this.samples = this.samples.slice(-this.maxSamples);
    }
  }

  /**
   * Record multiple samples at once.
   */
  recordBatch(samples: ReliabilitySample[]): void {
    for (const s of samples) this.record(s);
  }

  /**
   * Get the current reliability report.
   */
  getReport(): ReliabilityReport {
    if (this.samples.length < 10) {
      return {
        overall: 0.5,
        byType: {},
        bySource: { tv: 0.5, engine: 0.5 },
        byTypeBySource: {},
        sampleSizes: {},
        trend: "insufficient_data",
        recommendedFocus: [],
      };
    }

    const byType: Record<string, { correct: number; total: number }> = {};
    const bySource: Record<string, { correct: number; total: number }> = { tv: { correct: 0, total: 0 }, engine: { correct: 0, total: 0 } };
    const byTypeBySource: Record<string, { tv: { correct: number; total: number }; engine: { correct: number; total: number } }> = {};

    for (const s of this.samples) {
      const type = s.detectionType;
      const src = s.source;

      // By type
      if (!byType[type]) byType[type] = { correct: 0, total: 0 };
      byType[type].total++;
      if (s.correct) byType[type].correct++;

      // By source
      bySource[src].total++;
      if (s.correct) bySource[src].correct++;

      // By type + source
      if (!byTypeBySource[type]) byTypeBySource[type] = { tv: { correct: 0, total: 0 }, engine: { correct: 0, total: 0 } };
      byTypeBySource[type][src.toLowerCase() as "tv" | "engine"].total++;
      if (s.correct) byTypeBySource[type][src.toLowerCase() as "tv" | "engine"].correct++;
    }

    const computeRate = (data: { correct: number; total: number }) =>
      data.total > 0 ? Math.round((data.correct / data.total) * 10000) / 100 : 0;

    const typeRates: Record<string, number> = {};
    const sampleSizes: Record<string, number> = {};
    const typeBySourceRates: Record<string, { tv: number; engine: number }> = {};

    for (const [type, data] of Object.entries(byType)) {
      typeRates[type] = computeRate(data);
      sampleSizes[type] = data.total;
    }
    for (const [type, data] of Object.entries(byTypeBySource)) {
      typeBySourceRates[type] = {
        tv: computeRate(data.tv),
        engine: computeRate(data.engine),
      };
    }

    // Overall = weighted by sample size
    let totalCorrect = 0;
    let totalSamples = 0;
    for (const data of Object.values(byType)) {
      totalCorrect += data.correct;
      totalSamples += data.total;
    }
    const overall = totalSamples > 0 ? Math.round((totalCorrect / totalSamples) * 10000) / 100 : 0;

    // Trend analysis
    const trend = this.analyzeTrend();

    // Recommended focus: types with low reliability AND high strategic importance
    const importance: Record<string, number> = {
      OB: 1.0, FVG: 0.9, LIQUIDITY_SWEEP: 1.0, BOS: 0.85, CHOCH: 0.8,
      BIAS: 0.95, SMT: 0.7, SESSION_BREAKOUT: 0.6,
    };
    const recommendedFocus = Object.entries(typeRates)
      .filter(([type, rate]) => (rate < 70) && (importance[type] ?? 0.5) > 0.6)
      .sort(([, a], [, b]) => a - b)
      .slice(0, 3)
      .map(([type]) => type);

    return {
      overall,
      byType: typeRates,
      bySource: {
        tv: computeRate(bySource.tv),
        engine: computeRate(bySource.engine),
      },
      byTypeBySource: typeBySourceRates,
      sampleSizes,
      trend,
      recommendedFocus,
    };
  }

  private analyzeTrend(): ReliabilityReport["trend"] {
    if (this.samples.length < 50) return "insufficient_data";

    // Split into recent (last 25%) and older (first 75%)
    const splitIndex = Math.floor(this.samples.length * 0.75);
    const older = this.samples.slice(0, splitIndex);
    const recent = this.samples.slice(splitIndex);

    const olderRate = older.filter(s => s.correct).length / older.length;
    const recentRate = recent.filter(s => s.correct).length / recent.length;
    const diff = recentRate - olderRate;

    if (diff > 0.05) return "improving";
    if (diff < -0.05) return "declining";
    return "stable";
  }

  /**
   * Get reliability for a specific detection type and source.
   */
  getTypeReliability(detectionType: string, source: "TV" | "ENGINE"): number {
    const relevant = this.samples.filter(s => s.detectionType === detectionType && s.source === source);
    if (relevant.length < 5) {
      // Fall back to defaults for low sample counts
      const defaults: Record<string, { tv: number; engine: number }> = {
        OB: { tv: 0.90, engine: 0.85 },
        FVG: { tv: 0.88, engine: 0.82 },
        LIQUIDITY_SWEEP: { tv: 0.85, engine: 0.87 },
        BOS: { tv: 0.82, engine: 0.78 },
        CHOCH: { tv: 0.76, engine: 0.72 },
        SMT: { tv: 0.68, engine: 0.64 },
        BIAS: { tv: 0.90, engine: 0.88 },
      };
      return defaults[detectionType]?.[source === "TV" ? "tv" : "engine"] ?? 0.7;
    }
    const correct = relevant.filter(s => s.correct).length;
    return Math.round((correct / relevant.length) * 10000) / 100;
  }
}

export const reliabilityEngine = new ReliabilityEngine();
