/**
 * StrategyRegistry — loads template strategies, registers custom ones,
 * and provides detectAll() to evaluate all registered strategies against
 * a multi-timeframe report set.
 *
 * Usage:
 *   const registry = new StrategyRegistry();
 *   const results = registry.detectAll(reports);
 *   // → Map<string, PredicateResult>
 */

import type { SmcReport } from "../generated/types";
import type { StrategyDefinition } from "./rules";
import { StrategyEvaluator } from "./evaluator";
import type { PredicateResult } from "./predicates";
import { MODERN_CONFLUENCE_TEMPLATES } from "./templates/modern-confluence";
import { CHARTER_BLUEPRINT_TEMPLATES } from "./templates/charter-blueprint";
import { CLASSICAL_HORIZON_TEMPLATES } from "./templates/classical-horizon";
import { MMXM_TEMPLATES, TEMPORAL_REVERSAL_TEMPLATES } from "./templates/mmxm-and-temporal";

// ─── Detection result ────────────────────────────────────────────────────────

export interface DetectionResult extends PredicateResult {
  /** Which strategy produced this result. */
  strategyId: string;
  /** Strategy name for display. */
  strategyName: string;
  /** Human-readable label: matched / failed / error. */
  status: "matched" | "failed" | "error";
}

// ─── Registry ────────────────────────────────────────────────────────────────

export class StrategyRegistry {
  private strategies: Map<string, StrategyDefinition> = new Map();

  constructor() {
    // Load built-in templates on construction.
    this.loadTemplates(MODERN_CONFLUENCE_TEMPLATES);
    this.loadTemplates(CHARTER_BLUEPRINT_TEMPLATES);
    this.loadTemplates(CLASSICAL_HORIZON_TEMPLATES);
    this.loadTemplates(MMXM_TEMPLATES);
    this.loadTemplates(TEMPORAL_REVERSAL_TEMPLATES);
  }

  // ── Registration ─────────────────────────────────────────────────────────

  /**
   * Register a single custom strategy. Overwrites any existing strategy with
   * the same id.
   */
  register(strategy: StrategyDefinition): void {
    this.strategies.set(strategy.id, strategy);
  }

  /**
   * Load an array of templates (bulk register).
   */
  loadTemplates(templates: StrategyDefinition[]): void {
    for (const t of templates) {
      this.strategies.set(t.id, t);
    }
  }

  /**
   * Remove a strategy by id. Returns true if it existed.
   */
  unregister(id: string): boolean {
    return this.strategies.delete(id);
  }

  /**
   * Get a strategy definition by id.
   */
  get(id: string): StrategyDefinition | undefined {
    return this.strategies.get(id);
  }

  /**
   * List all registered strategy ids and names.
   */
  list(): Array<{ id: string; name: string; tags: string[] }> {
    return [...this.strategies.values()].map((s) => ({
      id: s.id,
      name: s.name,
      tags: s.tags,
    }));
  }

  // ── Detection ────────────────────────────────────────────────────────────

  /**
   * Evaluate every registered strategy against the report map and return
   * a map of strategyId → DetectionResult.
   *
   * A default timeframe must be provided — it's used for predicate rules
   * that do not explicitly specify a timeframe.  If your template rules
   * always set their own timeframe, the default is only a safety net.
   *
   * @param reports    Timeframe-keyed report map (e.g. "4h" → SmcReport).
   * @param defaultTf  Fallback timeframe for rules that omit it.
   */
  detectAll(
    reports: Map<string, SmcReport>,
    defaultTf = "4h",
  ): Map<string, DetectionResult> {
    const results = new Map<string, DetectionResult>();

    for (const [id, strategy] of this.strategies) {
      const det = this.detectOne(strategy, reports, defaultTf);
      results.set(id, det);
    }

    return results;
  }

  /**
   * Evaluate a single named strategy.
   */
  detect(
    id: string,
    reports: Map<string, SmcReport>,
    defaultTf = "4h",
  ): DetectionResult | undefined {
    const strategy = this.strategies.get(id);
    if (!strategy) return undefined;
    return this.detectOne(strategy, reports, defaultTf);
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private detectOne(
    strategy: StrategyDefinition,
    reports: Map<string, SmcReport>,
    defaultTf: string,
  ): DetectionResult {
    try {
      const evaluator = new StrategyEvaluator(reports, defaultTf);
      const result = evaluator.evaluate(strategy.rule);
      return {
        strategyId: strategy.id,
        strategyName: strategy.name,
        status: result.matched ? "matched" : "failed",
        ...result,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        strategyId: strategy.id,
        strategyName: strategy.name,
        status: "error",
        matched: false,
        evidence: [`Evaluation error: ${msg}`],
      };
    }
  }
}
