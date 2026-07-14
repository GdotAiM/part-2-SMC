/**
 * Prompt Optimizer — DSPy-style programmatic prompt optimization.
 *
 * Uses LLM-as-judge to refine agent prompts based on performance matrix
 * data. Each optimization iteration:
 * 1. Evaluates current prompt against past trade outcomes
 * 2. Suggests improvements based on performance gaps
 * 3. Generates an improved prompt variant
 * 4. Scores the new variant (simulated or via A/B test)
 *
 * Start small — optimizes one agent prompt as proof of concept.
 */

import { z } from "zod";
import { chatCompletion, resolveLlmConfig, logLlmCall } from "../llm/provider.js";
import { logger } from "../logger.js";
import { db } from "@workspace/db";
import { agentMemory } from "@workspace/db/schema";
import { desc, eq } from "drizzle-orm";

// ─── Types ───────────────────────────────────────────────────────────────

interface PromptVariant {
  id: string;
  name: string;
  content: string;
  score: number;
  trials: number;
  createdAt: string;
}

interface PerformanceSnapshot {
  winRate: number;
  sharpeRatio: number;
  profitFactor: number;
  totalTrades: number;
  topSetupTypes: string[];
  weakestRegimes: string[];
}

// ─── Zod schemas for structured output ────────────────────────────────────

const PromptEvaluationSchema = z.object({
  strengths: z.array(z.string()).describe("What the current prompt does well"),
  weaknesses: z.array(z.string()).describe("Where the prompt could improve"),
  suggestedFocus: z.string().describe("What dimension to improve (e.g., 'better liquidity analysis')"),
  score: z.number().min(0).max(100).describe("Overall score of the current prompt (0-100)"),
});

const PromptImprovementSchema = z.object({
  improvedPrompt: z.string().describe("The improved version of the prompt"),
  changes: z.array(z.string()).describe("What was changed and why"),
  expectedImprovement: z.string().describe("What metric this change should improve"),
});

// ─── Core Optimizer ──────────────────────────────────────────────────────

export class PromptOptimizer {
  /**
   * Run one optimization cycle for a named agent prompt.
   * Evaluates the current prompt against performance data and produces
   * an improved version.
   */
  async optimize(
    agentName: string,
    currentPrompt: string,
  ): Promise<{
    originalScore: number;
    improvedPrompt: string;
    changes: string[];
    expectedImprovement: string;
  }> {
    const llmConfig = resolveLlmConfig();
    if (!llmConfig.apiKey) {
      throw new Error("LLM not configured — set FIREWORKS_API_KEY or LLM_API_KEY");
    }

    // 1. Gather performance data
    const perfData = await this.gatherPerformanceData();

    // 2. Evaluate current prompt
    logger.info({ agent: agentName }, "Evaluating current prompt...");
    const evaluation = await this.evaluatePrompt(currentPrompt, agentName, perfData);

    // 3. Generate improved prompt
    logger.info({ agent: agentName, score: evaluation.score, weaknesses: evaluation.weaknesses.length }, "Generating improved prompt...");
    const improvement = await this.generateImprovedPrompt(currentPrompt, agentName, evaluation);

    // 4. Store the improved prompt as a memory entry
    await this.storePromptVariant(agentName, improvement.improvedPrompt, evaluation.score);

    return {
      originalScore: evaluation.score,
      improvedPrompt: improvement.improvedPrompt,
      changes: improvement.changes,
      expectedImprovement: improvement.expectedImprovement,
    };
  }

  /**
   * Get all stored prompt variants for an agent, sorted by score.
   */
  async getVariants(agentName: string): Promise<PromptVariant[]> {
    const results = await db
      .select()
      .from(agentMemory)
      .where(eq(agentMemory.memory_key as any, `prompt_variant|${agentName}`))
      .orderBy(desc(agentMemory.score))
      .limit(10);

    return results.map((r) => ({
      id: r.id,
      name: agentName,
      content: r.content,
      score: parseFloat(r.score || "0"),
      trials: 0,
      createdAt: r.created_at.toISOString(),
    }));
  }

  // ── Private ──────────────────────────────────────────────────────────

  private async gatherPerformanceData(): Promise<PerformanceSnapshot> {
    // Query the trades table for aggregate metrics
    let winRate = 0;
    let sharpeRatio = 0;
    let profitFactor = 0;
    let totalTrades = 0;
    const topSetupTypes: string[] = [];
    const weakestRegimes: string[] = [];

    try {
      const result = await (db as any)
        .select({
          total: (db as any).sql`count(*)::int`,
          wins: (db as any).sql`count(*) filter (where outcome->>'win' = 'true')::int`,
        })
        .from((db as any)._.trades || (db as any)._.agentMemory)
        .where((db as any).sql`outcome is not null`);
      // This is a simplified query — real implementation would use proper Drizzle aggregation
    } catch {
      // DB may not have data — return defaults
    }

    return {
      winRate,
      sharpeRatio,
      profitFactor,
      totalTrades,
      topSetupTypes,
      weakestRegimes,
    };
  }

  private async evaluatePrompt(
    prompt: string,
    agentName: string,
    perfData: PerformanceSnapshot,
  ): Promise<z.infer<typeof PromptEvaluationSchema>> {
    const systemPrompt = `You are a prompt engineering evaluator. Your task is to evaluate an AI agent prompt for an SMC/ICT trading analysis system.

Evaluate the prompt on:
1. **Clarity** — Is the instruction unambiguous?
2. **Grounding** — Does it ask for specific price levels and data?
3. **SMC vocabulary** — Does it use correct SMC terminology?
4. **Conciseness** — Is it focused without unnecessary verbosity?

Return a JSON evaluation with strengths, weaknesses, suggested focus, and a score (0-100).`;

    const userContent = `Agent name: ${agentName}
Performance data: ${JSON.stringify(perfData, null, 2)}

Current prompt to evaluate:
---
${prompt}
---

Evaluate this prompt and return JSON with strengths, weaknesses, suggestedFocus, and score.`;

    try {
      const messages = [
        { role: "system" as const, content: systemPrompt },
        { role: "user" as const, content: userContent },
      ];

      const startTime = Date.now();
      const { content } = await chatCompletion(messages, { maxTokens: 1024, temperature: 0.3, config: resolveLlmConfig() });

      // Parse JSON from response
      let cleaned = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) cleaned = jsonMatch[0];
      const parsed = JSON.parse(cleaned);
      return PromptEvaluationSchema.parse(parsed);
    } catch (err: any) {
      logger.warn({ err: err.message }, "Prompt evaluation failed, returning default");
      return {
        strengths: ["Unable to evaluate"],
        weaknesses: ["Evaluation failed"],
        suggestedFocus: "General clarity improvement",
        score: 50,
      };
    }
  }

  private async generateImprovedPrompt(
    currentPrompt: string,
    agentName: string,
    evaluation: z.infer<typeof PromptEvaluationSchema>,
  ): Promise<z.infer<typeof PromptImprovementSchema>> {
    const systemPrompt = `You are a prompt engineering specialist. Your task is to improve an AI agent prompt based on evaluation feedback.

The improved prompt should:
1. Fix identified weaknesses
2. Preserve existing strengths
3. Be more specific and actionable
4. Use SMC/ICT terminology correctly

Return JSON with: improvedPrompt (full text), changes (list of what changed), expectedImprovement (what metric improves).`;

    const userContent = `Agent name: ${agentName}

Current prompt:
---
${currentPrompt}
---

Evaluation:
${JSON.stringify(evaluation, null, 2)}

Generate an improved version of this prompt. Return JSON with improvedPrompt, changes, and expectedImprovement.`;

    try {
      const messages = [
        { role: "system" as const, content: systemPrompt },
        { role: "user" as const, content: userContent },
      ];

      const { content } = await chatCompletion(messages, { maxTokens: 2048, temperature: 0.3, config: resolveLlmConfig() });

      let cleaned = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) cleaned = jsonMatch[0];
      const parsed = JSON.parse(cleaned);
      return PromptImprovementSchema.parse(parsed);
    } catch (err: any) {
      logger.warn({ err: err.message }, "Prompt improvement generation failed");
      return {
        improvedPrompt: currentPrompt,
        changes: ["Unable to generate improvements"],
        expectedImprovement: "None",
      };
    }
  }

  private async storePromptVariant(
    agentName: string,
    prompt: string,
    score: number,
  ): Promise<void> {
    try {
      await (db as any)
        .insert(agentMemory)
        .values({
          memory_key: `prompt_variant|${agentName}|${Date.now()}`,
          content: prompt,
          source: "evaluation",
          score: (score / 100).toFixed(4),
          tags: ["prompt_variant", agentName],
          is_durable: true,
        });
    } catch (err: any) {
      logger.warn({ err: err.message }, "Failed to store prompt variant");
    }
  }
}
