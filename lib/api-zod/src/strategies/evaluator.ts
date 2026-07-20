/**
 * StrategyEvaluator — walks a Rule tree against a multi-timeframe report map
 * and the predicates.ts function library.
 *
 * Usage:
 *   const reports = new Map([
 *     ["4h", fourHourReport],
 *     ["1h", oneHourReport],
 *   ]);
 *   const evaluator = new StrategyEvaluator(reports);
 *   const result = evaluator.evaluate(rule);
 *   // → { matched: boolean, evidence: string[], score?: number }
 */

import type { SmcReport } from "../generated/types";
import type { Rule } from "./rules";
import type { PredicateResult } from "./predicates";

// Import every predicate function for the registry.
import {
  hasBias,
  hasOrderBlock,
  hasLiquidityPool,
  hasFVG,
  biasAligned,
  hasDailyBias,
  confluenceScore,
  priceNearOBProximal,
  hasMarketStructureShift,
  hasInducementZone,
  priceWithinOTEzone,
  hasConsolidationZone,
  isWithinSession,
  hasSMTConfirmation,
  hasHighImpactNewsWithin,
  isNewsBlackoutWindow,
  hasDisplacement,
  hasLiquiditySweep,
  hasBreakerBlock,
  hasSession,
  hasSessionAlignment,
  hasRangeExpansion,
  hasWeeklyExpansionContext,
  hasEqualHighsLows,
} from "./predicates";

// ─── Predicate Registry ──────────────────────────────────────────────────────

/**
 * ResolvedPredicate is a function that takes a report and optional extra args
 * and returns a PredicateResult.
 */
type ResolvedPredicate = (
  report: SmcReport,
  ...args: unknown[]
) => PredicateResult;

const PREDICATE_REGISTRY: Record<string, ResolvedPredicate> = {
  hasBias,
  hasOrderBlock,
  hasLiquidityPool,
  hasFVG,
  biasAligned,
  hasDailyBias,
  confluenceScore,
  priceNearOBProximal,
  hasMarketStructureShift,
  hasInducementZone,
  priceWithinOTEzone,
  hasConsolidationZone,
  isWithinSession,
  hasSMTConfirmation,
  hasHighImpactNewsWithin,
  isNewsBlackoutWindow,
  hasDisplacement,
  hasLiquiditySweep,
  hasBreakerBlock,
  hasSession,
  hasSessionAlignment,
  hasRangeExpansion,
  hasWeeklyExpansionContext,
  hasEqualHighsLows,
};

// ─── Evaluator ───────────────────────────────────────────────────────────────

export class StrategyEvaluator {
  /** Reports keyed by timeframe (e.g. "4h", "1h", "15m"). */
  private reports: Map<string, SmcReport>;
  /** Default timeframe used when a predicate rule omits `timeframe`. */
  private defaultTf: string;

  constructor(
    reports: Map<string, SmcReport>,
    defaultTf = "4h",
  ) {
    this.reports = reports;
    this.defaultTf = defaultTf;
  }

  /**
   * Evaluate a rule tree and return the aggregated result.
   */
  evaluate(rule: Rule): PredicateResult {
    switch (rule.type) {
      case "predicate":
        return this.evaluatePredicate(rule);

      case "and":
        return this.evaluateAnd(rule.rules);

      case "or":
        return this.evaluateOr(rule.rules);

      case "not":
        return this.evaluateNot(rule.rule);
    }
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private resolveReport(timeframe?: string): SmcReport {
    const tf = timeframe ?? this.defaultTf;
    const report = this.reports.get(tf);
    if (!report) {
      throw new Error(
        `StrategyEvaluator: no report found for timeframe "${tf}". ` +
          `Available timeframes: [${[...this.reports.keys()].join(", ")}].`,
      );
    }
    return report;
  }

  private evaluatePredicate(rule: Rule & { type: "predicate" }): PredicateResult {
    const fn = PREDICATE_REGISTRY[rule.predicate];
    if (!fn) {
      return {
        matched: false,
        evidence: [`Unknown predicate "${rule.predicate}". Available: ${Object.keys(PREDICATE_REGISTRY).join(", ")}.`],
      };
    }

    const report = this.resolveReport(rule.timeframe);
    const args = rule.args ?? [];

    try {
      return fn(report, ...args);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        matched: false,
        evidence: [`Predicate "${rule.predicate}" threw: ${msg}`],
      };
    }
  }

  private evaluateAnd(rules: Rule[]): PredicateResult {
    const allEvidence: string[] = [];
    let totalScore = 0;
    let matchedCount = 0;
    const count = rules.length;

    for (const sub of rules) {
      const result = this.evaluate(sub);
      allEvidence.push(...result.evidence);
      if (result.matched) {
        matchedCount++;
        totalScore += result.score ?? 0;
      }
    }

    // All must match for AND to succeed
    const matched = matchedCount === count;

    if (matched) {
      const avgScore = count > 0 ? Math.min(1, totalScore / count) : 0;
      return {
        matched: true,
        evidence: [
          `AND: ${matchedCount}/${count} sub-rules matched.`,
          ...allEvidence,
        ],
        score: avgScore,
      };
    }

    return {
      matched: false,
      evidence: [
        `AND: only ${matchedCount}/${count} sub-rules matched (need all). Failing sub-rule(s):`,
        ...allEvidence,
      ],
    };
  }

  private evaluateOr(rules: Rule[]): PredicateResult {
    const allEvidence: string[] = [];
    let bestScore = 0;
    let matched = false;
    const count = rules.length;

    for (const sub of rules) {
      const result = this.evaluate(sub);
      allEvidence.push(...result.evidence);
      if (result.matched) {
        matched = true;
        if ((result.score ?? 0) > bestScore) {
          bestScore = result.score ?? 0;
        }
      }
    }

    if (matched) {
      return {
        matched: true,
        evidence: [
          `OR: at least 1/${count} sub-rules matched.`,
          ...allEvidence,
        ],
        score: bestScore,
      };
    }

    return {
      matched: false,
      evidence: [
        `OR: 0/${count} sub-rules matched.`,
        ...allEvidence,
      ],
    };
  }

  private evaluateNot(rule: Rule): PredicateResult {
    const inner = this.evaluate(rule);

    if (inner.matched) {
      return {
        matched: false,
        evidence: [
          `NOT: inner rule matched — negated to false.`,
          ...inner.evidence,
        ],
        score: inner.score !== undefined ? 1 - inner.score : undefined,
      };
    }

    return {
      matched: true,
      evidence: [
        `NOT: inner rule did NOT match — negated to true.`,
        ...inner.evidence,
      ],
      score: inner.score !== undefined ? 1 - inner.score : undefined,
    };
  }
}
