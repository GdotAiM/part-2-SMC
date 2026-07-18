/**
 * Integration test for ReasoningAgent — mocked LLM response.
 *
 * Verifies that evaluateSetup:
 *   1. Returns a valid ReasoningOutput matching the Zod schema
 *   2. Passes the mock extractStructured result through correctly
 *   3. Handles an empty strategies array gracefully
 *
 * The LLM is never called — we inject a mock `extractStructured` function
 * that returns a predetermined response.
 *
 * Run with: npx tsx artifacts/api-server/src/lib/agents/reasoning-agent.test.ts
 */

import { evaluateSetup } from "./reasoning-agent.js";
import type { StrategyDetectionSummary } from "../narrative/generate-narrative.js";
import type { ReasoningOutput } from "./reasoning-agent.js";

// ─── Test harness ────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string): void {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${label}`);
    failed++;
  }
}

// ─── Mock LLM ────────────────────────────────────────────────────────────────

/**
 * Mock for extractStructured — returns a canned ReasoningOutput without
 * calling any LLM provider.  The returned object simulates what a real
 * LLM would produce after analysing a bullish setup.
 */
const MOCK_RESPONSE: ReasoningOutput = {
  reasoning:
    "The setup shows a bullish bias on the 4h timeframe with 82% confidence, " +
    "supported by consecutive daily bullish bias and price in the discount zone. " +
    "However, the 1h timeframe shows bearish divergence — this could indicate a " +
    "retracement or a false breakout. The nearest BSL at 65500 is only 1.1% away, " +
    "so the draw is tight. If price fails to hold above the 64500 order block, " +
    "this becomes a bearish trap. The absence of SMT divergence reduces conviction. " +
    "Overall, the HTF context is valid but the LTF divergence warrants caution.",
  confidenceScore: 62,
};

const MOCK_FAIL_RESPONSE: ReasoningOutput = {
  reasoning:
    "No clear directional bias detected. Both structure and daily bias are neutral, " +
    "price is at equilibrium, and there are no actionable liquidity pools. No strategies " +
    "matched the current market conditions. Waiting for a sweep of either the 49000 support " +
    "or the 51000 resistance to establish direction. Trading in this environment would " +
    "be speculative with low probability of success.",
  confidenceScore: 15,
};

/**
 * Factory for the mock extractStructured function.
 */
function mockExtract(response: ReasoningOutput) {
  return async function extractStructuredMock<T>(
    _schema: any,
    _systemPrompt: string,
    _userContent: string,
    _opts?: any,
  ): Promise<{ data: T; usage: any; raw: string }> {
    return {
      data: response as unknown as T,
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150, costUsd: 0, model: "mock" },
      raw: JSON.stringify(response),
    };
  };
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

const BULLISH_NARRATIVE = [
  "Market structure is bullish with 82% confidence; trending bullish; in expansion phase; daily bias is bullish (72% strength, 4-days consecutive) aligning with structure.",
  "London Expansion — Bullish; price is in discount zone of the dealing range.",
  "Nearest buy-side liquidity (BSL) at 65,500 (score 0.85, 2 touches); upside target primary.",
  "Primary draw targets: BSL at 65500 (score 2.40); Dealing range 62000–66000 on 1d; equilibrium at 64000; Current price 64,800 is above equilibrium.",
  "Strategy overlay — HTF POI + BOS + FVG at 82% confidence on 4h.",
].join("\n\n");

const BULLISH_STRATEGIES: StrategyDetectionSummary[] = [
  { strategyId: "smc-confluence-1", strategyName: "HTF POI + BOS + FVG", score: 0.82, evidence: ["✓ Structure bias bullish", "✓ FVG identified", "✓ MSS confirmed"] },
  { strategyId: "classical-06", strategyName: "Model 6 — Universal Buy Model", score: 0.67, evidence: ["✓ Buy-side expansion"] },
];

const NEUTRAL_NARRATIVE = [
  "No clear directional bias — structure is ranging and daily bias is neutral.",
  "London Consolidation; price is at equilibrium.",
  "No actionable liquidity pools identified.",
  "No key levels available.",
].join("\n\n");

const DEFAULT_RISK = {
  maxRiskPerTrade: 0.01,
  minRR: 2,
  riskTolerance: "moderate" as const,
  executionMode: "REVIEW" as const,
};

// ═══════════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════════

async function run() {
  console.log("Reasoning Agent test (mocked LLM)\n");

  // ── 1. Bullish setup with strategies ──────────────────────────────────────
  console.log("1. Bullish setup with matched strategies");

  const result1 = await evaluateSetup(
    BULLISH_NARRATIVE,
    BULLISH_STRATEGIES,
    DEFAULT_RISK,
    mockExtract(MOCK_RESPONSE),
  );

  assert(result1.confidenceScore === 62, `confidenceScore is 62 (got: ${result1.confidenceScore})`);
  assert(result1.reasoning.includes("bullish"), "reasoning mentions bullish");
  assert(result1.reasoning.includes("64500") || result1.reasoning.includes("bearish"), "reasoning discusses risks (bearish/levels)");
  assert(result1.reasoning.length > 80, `reasoning is substantial (${result1.reasoning.length} chars)`);
  assert(typeof result1.confidenceScore === "number" && result1.confidenceScore >= 0 && result1.confidenceScore <= 100, "confidenceScore is in [0, 100]");

  // ── 2. Empty strategies list ─────────────────────────────────────────────
  console.log("\n2. Empty strategies list");
  const result2 = await evaluateSetup(
    BULLISH_NARRATIVE,
    [],
    DEFAULT_RISK,
    mockExtract(MOCK_RESPONSE),
  );

  // Even with empty strategies, the mock returns the canned response
  // (the LLM just sees "  (none matched)" in the prompt)
  assert(result2.confidenceScore === 62, "still returns mock score with empty strategies");
  assert(result2.reasoning.length > 0, "reasoning is non-empty");

  // ── 3. Neutral narrative, fail-case mock ─────────────────────────────────
  console.log("\n3. Neutral narrative with low confidence mock");
  const result3 = await evaluateSetup(
    NEUTRAL_NARRATIVE,
    [],
    { ...DEFAULT_RISK, riskTolerance: "conservative" },
    mockExtract(MOCK_FAIL_RESPONSE),
  );

  assert(result3.confidenceScore === 15, `confidenceScore is 15 (got: ${result3.confidenceScore})`);
  assert(result3.reasoning.includes("neutral") || result3.reasoning.includes("No clear"), "reasoning reflects neutral conditions");
  assert(result3.confidenceScore < 30, "low confidence score remains low");

  // ── Schema validation: mock returns object that MUST pass the Zod schema ──
  console.log("\n4. Schema shape validation");
  const shapeKeys: (keyof ReasoningOutput)[] = ["reasoning", "confidenceScore"];
  for (const key of shapeKeys) {
    assert(key in result1, `result has key "${key}"`);
  }
  assert(typeof result1.reasoning === "string", "reasoning is a string");
  assert(typeof result1.confidenceScore === "number" && !Number.isNaN(result1.confidenceScore), "confidenceScore is a valid number");

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log(`\n${"─".repeat(50)}`);
  console.log(`${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}

run().catch((err) => {
  console.error("Test harness crashed:", err);
  process.exit(1);
});
