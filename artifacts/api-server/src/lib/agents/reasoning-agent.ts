/**
 * Reasoning Agent — uses the multi-provider LLM abstraction to analyse
 * a trade setup, challenge its assumptions, and assign a confidence score.
 *
 * This is NOT a deterministic template — it calls the LLM with a prompt that
 * explicitly asks the model to:
 *   1. Summarise the setup and its context
 *   2. Identify 2–3 reasons it COULD FAIL (adversarial challenge)
 *   3. Weigh bull vs bear cases
 *   4. Assign a calibrated confidence score (0–100)
 *
 * The output is validated against a Zod schema so the caller always receives
 * a well-structured { reasoning, confidenceScore } object.
 *
 * For testing, an optional `llmFn` parameter can be passed to substitute
 * a mock for the real LLM call.
 */

import { z } from "zod";
import { extractStructured as realExtractStructured } from "../llm/structured.js";
import type { StrategyDetectionSummary } from "../narrative/generate-narrative.js";

// ─── Input types ─────────────────────────────────────────────────────────────

export interface RiskParams {
  /** Maximum acceptable risk per trade as fraction of account (e.g. 0.01 = 1%). */
  maxRiskPerTrade: number;
  /** Minimum risk-reward ratio the trader requires. */
  minRR: number;
  /** Trader's risk appetite. */
  riskTolerance: "conservative" | "moderate" | "aggressive";
  /** Current broker mode. */
  executionMode: "REVIEW" | "LIVE";
}

// ─── Output schema ───────────────────────────────────────────────────────────

export const ReasoningOutputSchema = z.object({
  /** Plain-English reasoning paragraph covering summary, risks, and balance. */
  reasoning: z.string().min(20),
  /** Calibrated confidence score 0–100. The prompt asks the LLM to be critical. */
  confidenceScore: z.number().min(0).max(100),
});

export type ReasoningOutput = z.infer<typeof ReasoningOutputSchema>;

// ─── Prompt builder ─────────────────────────────────────────────────────────-

function buildSystemPrompt(): string {
  return `You are a senior institutional trading analyst. Your role is to evaluate trade setups with rigorous, adversarial skepticism — not to confirm them.

For every setup you MUST:
1. Summarise the setup direction and structural context in one sentence.
2. Identify 2–3 specific reasons this setup COULD FAIL. Be concrete — reference real price levels, structural conditions, or missing confluence factors.
3. Briefly weigh the bull case against the bear case.
4. Assign a calibrated confidence score from 0–100 where:
   - 0–30: Weak / insufficient confluence — do not trade
   - 31–50: Marginal — needs additional confirmation
   - 51–70: Moderate — viable setup with clear risk parameters
   - 71–85: Strong — multiple confluence factors align, clear invalidation level
   - 86–100: Exceptional — rare, near-full alignment across all timeframes

Rules:
- Be critical. If the narrative is neutral or contradictory, say so and score accordingly.
- Never inflate a confidence score. A score of 30–50 is honest for a marginal setup.
- If the narrative or strategies are empty, reflect that honestly in both reasoning and score.`;
}

function buildUserPrompt(
  narrative: string,
  strategies: StrategyDetectionSummary[],
  riskParams: RiskParams,
): string {
  const strategyBlock = strategies.length > 0
    ? strategies
        .map(
          (s, i) =>
            `  ${i + 1}. ${s.strategyName} — confidence ${Math.round(s.score * 100)}%\n` +
            `     Evidence: ${s.evidence.slice(0, 3).join("; ")}`,
        )
        .join("\n")
    : "  (none matched)";

  return `## Market Narrative

${narrative}

## Detected Strategies

${strategyBlock}

## Risk Parameters

- Max risk per trade: ${(riskParams.maxRiskPerTrade * 100).toFixed(1)}%
- Minimum R:R: 1:${riskParams.minRR.toFixed(1)}
- Risk tolerance: ${riskParams.riskTolerance}
- Execution mode: ${riskParams.executionMode}

## Your Analysis

Provide a structured evaluation following the system instructions. Be critical.`;
}

// ─── Main entry point ───────────────────────────────────────────────────────-

/**
 * Run the reasoning agent against a trade setup.
 *
 * @param narrative    — Deterministic narrative string from generateNarrative().
 * @param strategies   — Matched strategy detection summaries.
 * @param riskParams   — Trader's risk configuration.
 * @param llmFn        — Optional override for the LLM call (used in tests).
 * @returns            — Validated { reasoning, confidenceScore }.
 */
export async function evaluateSetup(
  narrative: string,
  strategies: StrategyDetectionSummary[],
  riskParams: RiskParams,
  llmFn?: typeof realExtractStructured,
): Promise<ReasoningOutput> {
  const systemPrompt = buildSystemPrompt();
  const userContent = buildUserPrompt(narrative, strategies, riskParams);
  const extract = llmFn ?? realExtractStructured;

  const { data } = await extract(
    ReasoningOutputSchema,
    systemPrompt,
    userContent,
    { maxRetries: 2, maxTokens: 1024, temperature: 0.3 },
  );

  return data;
}
