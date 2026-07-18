/**
 * useCascadeStrategy — calls POST /api/strategies/detect and returns
 * the primary (best-matching) strategy alongside alternative runners-up.
 *
 * Designed to be paired with ConfluenceCard: the primary strategy name
 * and confidence score render above the TF-chip cascade, and the
 * alternatives list is collapsible below it.
 *
 * When includeReason is true, the hook also fetches a narrative string
 * and an LLM reasoning assessment (gated behind ?reason=true).
 */

import { useQuery } from "@tanstack/react-query";
import { detectStrategies } from "@/lib/api";
import type { StrategyDetectionResult } from "@/lib/api";

export interface CascadeStrategyResult {
  /** Highest-ranked matched strategy, or null if none matched. */
  primary: StrategyDetectionResult | null;
  /** All matched strategies excluding the primary, sorted by score descending. */
  alternatives: StrategyDetectionResult[];
  /** Total strategies evaluated by the server. */
  totalEvaluated: number;
  /** Whether the query is still loading. */
  isLoading: boolean;
  /** Error message, if any. */
  error: string | null;
  /** Deterministic narrative (only present when includeReason=true). */
  narrative?: string;
  /** LLM reasoning assessment (only present when includeReason=true). */
  reasoning?: { reasoning: string; confidenceScore: number };
}

export function useCascadeStrategy(
  symbol: string | undefined,
  market: string,
  timeframes: string[],
  includeReason?: boolean,
): CascadeStrategyResult {
  const query = useQuery({
    queryKey: ["cascade-strategy", symbol, market, ...timeframes, Boolean(includeReason)],
    queryFn: () => detectStrategies(symbol!, market, timeframes, includeReason),
    enabled: !!symbol && timeframes.length > 0,
    staleTime: 60_000,
    retry: 1,
  });

  if (!query.data || query.error) {
    return {
      primary: null,
      alternatives: [],
      totalEvaluated: 0,
      isLoading: query.isLoading,
      error: query.error instanceof Error ? query.error.message : query.error ? String(query.error) : null,
    };
  }

  const matched = query.data.results.filter((r) => r.status === "matched");
  const sorted = [...matched].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const [primary, ...alternatives] = sorted;

  return {
    primary: primary ?? null,
    alternatives,
    totalEvaluated: query.data.totalStrategies,
    isLoading: query.isLoading,
    error: null,
    narrative: query.data.narrative,
    reasoning: query.data.reasoning,
  };
}
