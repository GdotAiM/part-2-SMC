/**
 * StrategyRegistry — loads template strategies, registers custom ones,
 * and provides detectAll() to evaluate all registered strategies against
 * a multi-timeframe report set.
 *
 * Taxonomy v2: Adds category filtering, priority-aware ranking,
 * invalidation checking, and horizon detection.
 */

import type { SmcReport } from "../generated/types";
import type { StrategyDefinition, OntologyCategory, ModelPriority } from "./rules";
import { StrategyEvaluator } from "./evaluator";
import type { PredicateResult } from "./predicates";
import { MODERN_CONFLUENCE_TEMPLATES } from "./templates/modern-confluence";
import { CHARTER_BLUEPRINT_TEMPLATES } from "./templates/charter-blueprint";
import { CLASSICAL_HORIZON_TEMPLATES } from "./templates/classical-horizon";
import { MMXM_TEMPLATES, TEMPORAL_REVERSAL_TEMPLATES } from "./templates/mmxm-and-temporal";
import { CONCEPT_TEMPLATES, STRUCTURAL_PATTERN_TEMPLATES, TRADING_HORIZON_TEMPLATES } from "./templates/concepts-and-patterns";

// ─── Detection result ────────────────────────────────────────────────────────

export interface DetectionResult extends PredicateResult {
  /** Which strategy produced this result. */
  strategyId: string;
  /** Strategy name for display. */
  strategyName: string;
  /** Human-readable label: matched / failed / error. */
  status: "matched" | "failed" | "error";
  /** Taxonomy v2: ontology category (if set). */
  ontology?: OntologyCategory;
  /** Taxonomy v2: model priority (if set). */
  priority?: ModelPriority;
  /** Taxonomy v2: invalidation flag — true if model matched but was invalidated. */
  invalidated?: boolean;
}

// ─── Registry options ────────────────────────────────────────────────────────

export interface DetectOptions {
  /** Filter to specific ontology categories. Omitted = all categories. */
  categories?: OntologyCategory[];
  /** Minimum priority level to include. */
  minPriority?: ModelPriority;
  /** Include CURRICULUM models (default false). */
  includeCurriculum?: boolean;
  /** Include TRADING_HORIZON models (default false). */
  includeHorizons?: boolean;
  /** Include CONCEPT models (default false). */
  includeConcepts?: boolean;
  /** Default timeframe fallback. */
  defaultTf?: string;
}

const PRIORITY_RANK: Record<ModelPriority, number> = {
  PRIMARY: 0,
  ALTERNATIVE: 1,
  INFORMATIONAL: 2,
};

// ─── Registry ────────────────────────────────────────────────────────────────

export class StrategyRegistry {
  private strategies: Map<string, StrategyDefinition> = new Map();

  constructor() {
    // Load built-in templates on construction.
    // Execution and temporal models are always loaded.
    this.loadTemplates(MODERN_CONFLUENCE_TEMPLATES);
    this.loadTemplates(CLASSICAL_HORIZON_TEMPLATES);
    this.loadTemplates(MMXM_TEMPLATES);
    this.loadTemplates(TEMPORAL_REVERSAL_TEMPLATES);

    // Curriculum, concept, pattern, and horizon templates are loaded
    // but filtered out of default detectAll() unless explicitly included.
    this.loadTemplates(CHARTER_BLUEPRINT_TEMPLATES);
    this.loadTemplates(CONCEPT_TEMPLATES);
    this.loadTemplates(STRUCTURAL_PATTERN_TEMPLATES);
    this.loadTemplates(TRADING_HORIZON_TEMPLATES);
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

  /**
   * List strategies by ontology category.
   */
  listByCategory(category: OntologyCategory): StrategyDefinition[] {
    return [...this.strategies.values()].filter((s) => s.ontology === category);
  }

  // ── Detection ────────────────────────────────────────────────────────────

  /**
   * Evaluate every registered strategy against the report map and return
   * a map of strategyId → DetectionResult.
   *
   * @param reports    Timeframe-keyed report map (e.g. "4h" → SmcReport).
   * @param options    Detection options (categories, priority, filtering).
   */
  detectAll(
    reports: Map<string, SmcReport>,
    options?: DetectOptions,
  ): Map<string, DetectionResult> {
    const {
      categories,
      minPriority,
      includeCurriculum = false,
      includeHorizons = false,
      includeConcepts = false,
      defaultTf = "4h",
    } = options ?? {};

    const results = new Map<string, DetectionResult>();

    for (const [id, strategy] of this.strategies) {
      // Category filtering
      if (categories && strategy.ontology && !categories.includes(strategy.ontology)) {
        continue;
      }

      // Priority filtering
      if (minPriority && strategy.priority && PRIORITY_RANK[strategy.priority] > PRIORITY_RANK[minPriority]) {
        continue;
      }

      // Category-based opt-out filtering
      if (strategy.ontology === "CURRICULUM" && !includeCurriculum) continue;
      if (strategy.ontology === "TRADING_HORIZON" && !includeHorizons) continue;
      if (strategy.ontology === "CONCEPT" && !includeConcepts) continue;

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

  /**
   * Rank detection results by status then priority then score.
   * Returns a sorted array with matches first (by priority tier, desc score),
   * then failures, then errors.
   */
  rankResults(results: Map<string, DetectionResult>): DetectionResult[] {
    return [...results.values()].sort((a, b) => {
      const order = { matched: 0, failed: 1, error: 2 };
      const ao = order[a.status] ?? 3;
      const bo = order[b.status] ?? 3;
      if (ao !== bo) return ao - bo;

      // Within matched: by priority tier then score
      if (a.status === "matched" && b.status === "matched") {
        const aPri = a.priority ? (PRIORITY_RANK[a.priority] ?? 2) : 2;
        const bPri = b.priority ? (PRIORITY_RANK[b.priority] ?? 2) : 2;
        if (aPri !== bPri) return aPri - bPri;
      }

      // Within same status + priority: higher score first
      const sa = a.score ?? -1;
      const sb = b.score ?? -1;
      if (sa !== sb) return sb - sa;
      return a.strategyId.localeCompare(b.strategyId);
    });
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

      // Invalidation checking
      let invalidated = false;
      if (result.matched && strategy.invalidation && strategy.invalidation.length > 0) {
        for (const inv of strategy.invalidation) {
          const invResult = evaluator.evaluate({
            type: "predicate",
            predicate: inv.predicate,
            timeframe: inv.timeframe,
            args: inv.args,
          });
          if (invResult.matched) {
            invalidated = true;
            break;
          }
        }
      }

      return {
        strategyId: strategy.id,
        strategyName: strategy.name,
        ontology: strategy.ontology,
        priority: strategy.priority,
        status: result.matched && !invalidated ? "matched" : invalidated ? "failed" : result.matched ? "matched" : "failed",
        invalidated: invalidated || undefined,
        ...result,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        strategyId: strategy.id,
        strategyName: strategy.name,
        ontology: strategy.ontology,
        priority: strategy.priority,
        status: "error",
        matched: false,
        evidence: [`Evaluation error: ${msg}`],
      };
    }
  }
}
