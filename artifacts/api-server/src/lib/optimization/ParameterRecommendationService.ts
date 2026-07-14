/**
 * Parameter Recommendation Service — Phase 7
 *
 * Analyzes accumulated detection comparisons and outcomes to recommend
 * parameter changes. Does NOT automatically change production parameters.
 * Generates recommendations requiring human approval.
 *
 * Example:
 *   Current displacement threshold: 1.5 ATR
 *   Suggested: 1.8 ATR
 *   Evidence: 842 examples
 *   Win Rate Improvement: 8.3%
 *   Confidence: 97%
 */

import { logger } from "../logger.js";
import { SMC_CONFIG } from "../smc/config.js";
import { learningService } from "../learning/LearningService.js";

// ─── Types ──────────────────────────────────────────────────────────────

export interface ParameterRecommendation {
  component: string;
  parameterName: string;
  currentValue: number;
  suggestedValue: number;
  sampleSize: number;
  winRateImprovement: number;
  confidence: number;
  evidence: string[];
  id: string | null;  // DB id after stored
}

export const TUNABLE_PARAMETERS = [
  { component: "structure", name: "atrPeriod", current: SMC_CONFIG.atrPeriod, min: 6, max: 30, step: 1 },
  { component: "structure", name: "pivotLookback", current: SMC_CONFIG.pivotLookback, min: 2, max: 10, step: 1 },
  { component: "ob", name: "obLookForward", current: SMC_CONFIG.obLookForward, min: 1, max: 8, step: 1 },
  { component: "fvg", name: "fvgMinBodyRatio", current: SMC_CONFIG.fvgMinBodyRatio, min: 0.2, max: 1.0, step: 0.1 },
  { component: "general", name: "equalLevelThreshold", current: SMC_CONFIG.equalLevelThreshold, min: 0.0001, max: 0.01, step: 0.0001 },
  { component: "liquidity", name: "minTouches", current: SMC_CONFIG.minTouches, min: 1, max: 5, step: 1 },
];

// ─── Service ────────────────────────────────────────────────────────────

export class ParameterRecommendationService {
  /**
   * Analyze comparisons and outcomes to generate parameter recommendations.
   * @param comparisons — grouped by detection type and time period
   * @param outcomes — grouped by same
   */
  async generateRecommendations(
    periodData: Array<{
      detectionType: string;
      winRate: number;
      sampleSize: number;
      avgPriceDiscrepancy: number;
      avgConfidenceGap: number;
    }>,
  ): Promise<ParameterRecommendation[]> {
    const recommendations: ParameterRecommendation[] = [];
    const totalSamples = periodData.reduce((s, d) => s + d.sampleSize, 0);

    if (totalSamples < 50) {
      logger.info({ totalSamples }, "[ParamRec] Insufficient data for recommendations");
      return [];
    }

    for (const param of TUNABLE_PARAMETERS) {
      const relatedData = periodData.filter(d =>
        this.isRelatedDetectionType(d.detectionType, param.component),
      );
      const relatedSamples = relatedData.reduce((s, d) => s + d.sampleSize, 0);

      if (relatedSamples < 30) continue;

      // Analyze: is the current value optimal?
      const avgWinRate = relatedData.reduce((s, d) => s + d.winRate * d.sampleSize, 0) / relatedSamples;

      // Simple heuristic: if certain detection types have low win rates, suggest adjustments
      const lowPerformers = relatedData.filter(d => d.winRate < 0.5);
      const hasIssues = lowPerformers.length > 0;

      if (hasIssues) {
        // Determine direction based on what's failing
        const isSensitivityParam = param.name.includes("Lookback") || param.name.includes("Threshold");
        const suggestedDelta = isSensitivityParam
          ? (param.current * 0.2)  // 20% change in sensitivity params
          : param.step * 2;        // 2 steps for other params

        const direction = lowPerformers.some(d =>
          d.avgConfidenceGap < -0.1,
        ) ? 1 : -1;  // Increase if engine missing things, decrease if false positives

        const suggestedValue = Math.max(param.min, Math.min(param.max, param.current + direction * suggestedDelta));
        const improvement = Math.min(15, Math.max(1, (1 - avgWinRate) * 30)); // 1-15% estimated improvement

        const rec: ParameterRecommendation = {
          component: param.component,
          parameterName: param.name,
          currentValue: param.current,
          suggestedValue: Math.round(suggestedValue * 10000) / 10000,
          sampleSize: relatedSamples,
          winRateImprovement: Math.round(improvement * 10) / 10,
          confidence: Math.min(0.97, Math.max(0.5, relatedSamples / 1000)),
          evidence: [
            `${relatedSamples} samples analyzed across ${relatedData.length} detection types`,
            `Current win rate: ${(avgWinRate * 100).toFixed(0)}%`,
            `Low performers: ${lowPerformers.map(d => `${d.detectionType} (${(d.winRate * 100).toFixed(0)}%)`).join(", ")}`,
          ],
          id: null,
        };

        rec.id = await learningService.recordParameterSuggestion({
          component: rec.component,
          parameterName: rec.parameterName,
          currentValue: rec.currentValue,
          suggestedValue: rec.suggestedValue,
          sampleSize: rec.sampleSize,
          winRateImprovement: rec.winRateImprovement,
          confidence: rec.confidence,
        });

        recommendations.push(rec);
      }
    }

    // Log learning event if significant recommendations found
    if (recommendations.length > 0) {
      await learningService.logLearningEvent({
        eventType: "PARAMETER_SUGGESTION",
        title: `${recommendations.length} parameter adjustments suggested`,
        description: `Based on ${totalSamples} detection comparisons. Requires human approval.`,
        evidence: { recommendations: recommendations.map(r => `${r.parameterName}: ${r.currentValue} → ${r.suggestedValue}`) },
        significance: 0.6,
      });
    }

    return recommendations;
  }

  private isRelatedDetectionType(detectionType: string, component: string): boolean {
    const map: Record<string, string[]> = {
      structure: ["BOS", "CHOCH", "MSS", "BIAS"],
      ob: ["OB", "BREAKER"],
      fvg: ["FVG"],
      liquidity: ["LIQUIDITY_SWEEP", "EQH", "EQL"],
      general: ["PREMIUM", "DISCOUNT", "SMT", "SESSION_BREAKOUT", "DISPLACEMENT"],
    };
    return map[component]?.some(t => detectionType.includes(t)) ?? false;
  }
}

export const parameterRecommendationService = new ParameterRecommendationService();
