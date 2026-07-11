/**
 * Structured Output Utility — Instructor pattern for guaranteed structured
 * outputs from LLMs using Zod schemas.
 *
 * Pattern: prompt → LLM call → parse → retry on failure
 * This eliminates JSON parsing errors from the agent pipeline.
 */

import { z } from "zod";
import { chatCompletion, resolveLlmConfig, estimateCost, logLlmCall } from "./provider.js";
import type { ChatMessage, LlmUsage, LlmConfig } from "./provider.js";
import { logger } from "../logger.js";

// ── Retry Config ─────────────────────────────────────────────────────────

interface StructuredOpts {
  maxRetries?: number;
  maxTokens?: number;
  temperature?: number;
  config?: LlmConfig;
}

const DEFAULT_OPTS: Required<StructuredOpts> = {
  maxRetries: 2,
  maxTokens: 1024,
  temperature: 0.1,
  config: resolveLlmConfig(),
};

// ── Core function ───────────────────────────────────────────────────────

/**
 * Call the LLM and parse the response as structured data matching the
 * provided Zod schema. Retries on parse failure.
 *
 * @param schema — Zod schema defining the expected output shape
 * @param systemPrompt — System-level instruction
 * @param userContent — User message content
 * @param opts — Optional settings
 * @returns Parsed and validated object matching the schema
 */
export async function extractStructured<T>(
  schema: z.ZodType<T>,
  systemPrompt: string,
  userContent: string,
  opts?: StructuredOpts,
): Promise<{ data: T; usage: LlmUsage; raw: string }> {
  const { maxRetries, maxTokens, temperature, config } = { ...DEFAULT_OPTS, ...opts };

  // Build a prompt that instructs the model to output valid JSON matching the schema
  const schemaDescription = describeSchema(schema);
  const structuredPrompt = `${systemPrompt}

You MUST respond with ONLY valid JSON that matches this exact schema:
${schemaDescription}

Your response will be parsed programmatically. Do NOT include markdown fences, explanations, or any text outside the JSON object. The JSON must be parseable by JSON.parse().`;

  let lastError = "";
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const messages: ChatMessage[] = [
        { role: "system", content: structuredPrompt },
        { role: "user", content: userContent },
      ];

      const startTime = Date.now();
      const { content, usage } = await chatCompletion(messages, {
        maxTokens,
        temperature,
        config,
      });
      const durationMs = Date.now() - startTime;

      // Clean the response — strip markdown fences if present
      let cleaned = content.trim();
      cleaned = cleaned.replace(/^```(?:json)?\s*/i, "");
      cleaned = cleaned.replace(/\s*```$/i, "");

      // Try to extract JSON from the response
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        lastError = "No JSON object found in response";
        logger.warn({ attempt, content: cleaned.slice(0, 100) }, `Structured output: ${lastError}`);
        continue;
      }

      const parsed = JSON.parse(jsonMatch[0]);
      const data = schema.parse(parsed);

      return { data, usage, raw: cleaned };
    } catch (err: any) {
      lastError = err instanceof z.ZodError
        ? `Schema validation: ${err.errors.map((e: any) => `${e.path.join(".")}: ${e.message}`).join("; ")}`
        : err.message || "Unknown error";
      logger.warn({ attempt, error: lastError }, `Structured output attempt ${attempt + 1}/${maxRetries + 1} failed`);
    }
  }

  throw new Error(`Structured output failed after ${maxRetries + 1} attempts: ${lastError}`);
}

/**
 * Extract an array of items from the LLM response.
 */
export async function extractArray<T>(
  schema: z.ZodType<T>,
  systemPrompt: string,
  userContent: string,
  opts?: StructuredOpts,
): Promise<{ data: T[]; usage: LlmUsage; raw: string }> {
  const arraySchema = z.array(schema);
  const result = await extractStructured(arraySchema, systemPrompt, userContent, opts);
  return { data: result.data as unknown as T[], usage: result.usage, raw: result.raw };
}

// ── Helpers ──────────────────────────────────────────────────────────────

/**
 * Generate a human-readable description of a Zod schema for the LLM prompt.
 */
function describeSchema(schema: z.ZodTypeAny): string {
  if (schema instanceof z.ZodArray) {
    const itemDesc = describeSchema(schema._def.type);
    return `Array of: ${itemDesc}`;
  }
  if (schema instanceof z.ZodObject) {
    const shape = schema._def.shape();
    const fields = Object.entries(shape).map(([key, val]) => {
      const field = val as z.ZodTypeAny;
      const typeName = describeFieldType(field);
      const nullable = field.isNullable() || field.isOptional();
      return `  "${key}": ${typeName}${nullable ? " (optional)" : ""}`;
    });
    return `{\n${fields.join(",\n")}\n}`;
  }
  if (schema instanceof z.ZodUnion || schema instanceof z.ZodDiscriminatedUnion) {
    return "string (one of enum values)";
  }
  if (schema instanceof z.ZodEnum) {
    return `enum: ${schema._def.values.join(" | ")}`;
  }
  return typeof schema._def?.typeName === "string" ? schema._def.typeName.replace("Zod", "").toLowerCase() : "string";
}

function describeFieldType(field: z.ZodTypeAny): string {
  if (field instanceof z.ZodString) return "string";
  if (field instanceof z.ZodNumber) return "number";
  if (field instanceof z.ZodBoolean) return "boolean";
  if (field instanceof z.ZodArray) return `array<${describeFieldType(field._def.type)}>`;
  if (field instanceof z.ZodObject) return "object";
  if (field instanceof z.ZodEnum) return field._def.values.join(" | ");
  if (field.isNullable()) return `${describeFieldType((field as any)._def?.innerType ?? field)} | null`;
  return "string";
}
