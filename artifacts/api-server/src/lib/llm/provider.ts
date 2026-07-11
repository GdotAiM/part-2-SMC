/**
 * Unified LLM Provider — enhanced with cost tracking, token accounting,
 * and structured output support.
 *
 * Supports multi-provider routing via LLM_PROVIDER env var:
 *   fireworks (default) | openai | custom | amd | ollama
 *
 * Cost tracking uses known model pricing; for unknown models it logs
 * estimated cost based on a fallback rate.
 */

import { logger } from "../logger.js";
import { langfuse } from "../observability/langfuse.js";

// ─── Types ────────────────────────────────────────────────────────────────

export interface LlmConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  provider: "fireworks" | "amd" | "openai" | "custom" | "ollama";
}

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
  tool_calls?: unknown;
}

export interface LlmStreamEvent {
  type: "delta" | "done" | "error";
  content?: string;
  error?: string;
}

export interface LlmUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number;
  model: string;
}

// ─── Cost tracking ────────────────────────────────────────────────────────
// Prices per 1M tokens (input / output) in USD — sourced from provider APIs.
// Extend this map as new models are added.

const MODEL_COST_MAP: Record<string, { input: number; output: number }> = {
  // Fireworks AI — DeepSeek V4 Pro
  "accounts/fireworks/models/deepseek-v4-pro": { input: 1.20, output: 4.80 },
  // OpenAI
  "gpt-4o": { input: 2.50, output: 10.00 },
  "gpt-4o-mini": { input: 0.15, output: 0.60 },
  "gpt-4": { input: 30.00, output: 60.00 },
  "gpt-3.5-turbo": { input: 0.50, output: 1.50 },
  // Anthropic (via Fireworks or direct)
  "claude-3-haiku-20240307": { input: 0.25, output: 1.25 },
  "claude-3-sonnet-20240229": { input: 3.00, output: 15.00 },
  "claude-opus-4-8": { input: 15.00, output: 75.00 },
  // Open-source / local models (free — cost is electricity)
  "google/gemma-4-26B-A4B-it": { input: 0, output: 0 },
  "llama-3.1-8b": { input: 0, output: 0 },
  "llama-3.1-70b": { input: 0, output: 0 },
  "mistral-7b": { input: 0, output: 0 },
  "codestral-2501": { input: 0, output: 0 },
};

/** Fallback cost for unknown models (~Llama 3 70B pricing) */
const UNKNOWN_MODEL_COST = { input: 0.90, output: 0.90 };

/**
 * Estimate cost from token counts and model name.
 */
export function estimateCost(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const pricing = MODEL_COST_MAP[model] ?? UNKNOWN_MODEL_COST;
  const inputCost = (promptTokens / 1_000_000) * pricing.input;
  const outputCost = (completionTokens / 1_000_000) * pricing.output;
  return Math.round((inputCost + outputCost) * 1_000_000) / 1_000_000;
}

// ─── Provider defaults ────────────────────────────────────────────────────

const FIREWORKS_BASE = "https://api.fireworks.ai/inference/v1";
const FIREWORKS_MODEL = "accounts/fireworks/models/deepseek-v4-pro";
const AMD_DEFAULT_BASE = "http://localhost:8000/v1";
const AMD_DEFAULT_MODEL = "google/gemma-4-26B-A4B-it";

// ─── Resolve config from env ──────────────────────────────────────────────

export function resolveLlmConfig(): LlmConfig {
  const provider = (process.env.LLM_PROVIDER || "fireworks") as LlmConfig["provider"];

  switch (provider) {
    case "amd":
      return {
        provider: "amd",
        baseUrl: process.env.LLM_BASE_URL || AMD_DEFAULT_BASE,
        apiKey: process.env.LLM_API_KEY || "not-needed",
        model: process.env.LLM_MODEL || AMD_DEFAULT_MODEL,
      };
    case "openai":
      return {
        provider: "openai",
        baseUrl: process.env.LLM_BASE_URL || "https://api.openai.com/v1",
        apiKey: process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || "",
        model: process.env.LLM_MODEL || "gpt-4o",
      };
    case "custom":
      return {
        provider: "custom",
        baseUrl: process.env.LLM_BASE_URL || FIREWORKS_BASE,
        apiKey: process.env.LLM_API_KEY || process.env.FIREWORKS_API_KEY || "",
        model: process.env.LLM_MODEL || FIREWORKS_MODEL,
      };
    case "ollama":
      return {
        provider: "ollama",
        baseUrl: process.env.LLM_BASE_URL || "http://host.docker.internal:11434/v1",
        apiKey: process.env.LLM_API_KEY || "not-needed",
        model: process.env.LLM_MODEL || "llama-3.1-8b",
      };
    case "fireworks":
    default:
      return {
        provider: "fireworks",
        baseUrl: process.env.LLM_BASE_URL || FIREWORKS_BASE,
        apiKey: process.env.LLM_API_KEY || process.env.FIREWORKS_API_KEY || "",
        model: process.env.LLM_MODEL || FIREWORKS_MODEL,
      };
  }
}

// ── Log LLM call ─────────────────────────────────────────────────────────

export function logLlmCall(params: {
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  durationMs: number;
  endpoint?: string;
  error?: string;
}): void {
  const cost = estimateCost(params.model, params.promptTokens, params.completionTokens);
  logger.info(
    {
      llm_call: true,
      provider: params.provider,
      model: params.model,
      prompt_tokens: params.promptTokens,
      completion_tokens: params.completionTokens,
      total_tokens: params.promptTokens + params.completionTokens,
      cost_usd: cost,
      duration_ms: params.durationMs,
      endpoint: params.endpoint ?? "chat",
      error: params.error,
    },
    `LLM call: ${params.model} (${params.promptTokens}→${params.completionTokens}t, $${cost}, ${params.durationMs}ms)`,
  );
}

// ── Streaming chat completion ────────────────────────────────────────────

export async function* streamChatCompletion(
  messages: ChatMessage[],
  options?: {
    maxTokens?: number;
    temperature?: number;
    config?: LlmConfig;
  },
): AsyncGenerator<LlmStreamEvent & { usage?: LlmUsage }> {
  const config = options?.config || resolveLlmConfig();
  const startTime = Date.now();
  let promptTokens = 0;
  let completionTokens = 0;

  if (!config.apiKey && config.provider !== "amd" && config.provider !== "ollama") {
    yield { type: "error", error: `Missing API key for provider "${config.provider}". Set LLM_API_KEY or FIREWORKS_API_KEY.` };
    return;
  }

  const body: Record<string, unknown> = {
    model: config.model,
    messages,
    max_tokens: options?.maxTokens ?? 1024,
    temperature: options?.temperature ?? 0.3,
    stream: true,
  };

  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(config.apiKey && config.apiKey !== "not-needed"
          ? { Authorization: `Bearer ${config.apiKey}` }
          : {}),
      },
      body: JSON.stringify(body),
    });
  } catch (err: any) {
    logLlmCall({ provider: config.provider, model: config.model, promptTokens: 0, completionTokens: 0, durationMs: Date.now() - startTime, error: err.message });
    yield { type: "error", error: `LLM request failed: ${err.message}` };
    return;
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    logLlmCall({ provider: config.provider, model: config.model, promptTokens: 0, completionTokens: 0, durationMs: Date.now() - startTime, error: `HTTP ${response.status}: ${errorText.slice(0, 200)}` });
    yield { type: "error", error: `LLM HTTP ${response.status}: ${errorText.slice(0, 200)}` };
    return;
  }

  if (!response.body) {
    logLlmCall({ provider: config.provider, model: config.model, promptTokens: 0, completionTokens: 0, durationMs: Date.now() - startTime, error: "No response body" });
    yield { type: "error", error: "No response body from LLM" };
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  // Estimate prompt tokens from message length
  promptTokens = Math.ceil(JSON.stringify(messages).length / 4);

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data: ")) continue;
        const data = trimmed.slice(6);
        if (data === "[DONE]") {
          const durationMs = Date.now() - startTime;
          const usage: LlmUsage = {
            promptTokens,
            completionTokens,
            totalTokens: promptTokens + completionTokens,
            costUsd: estimateCost(config.model, promptTokens, completionTokens),
            model: config.model,
          };
          logLlmCall({ provider: config.provider, model: config.model, promptTokens, completionTokens, durationMs });
          yield { type: "done", usage };
          return;
        }
        try {
          const json = JSON.parse(data);
          const delta = json.choices?.[0]?.delta?.content;
          if (delta) {
            completionTokens += Math.ceil(delta.length / 4);
            yield { type: "delta", content: delta };
          }
          if (json.choices?.[0]?.finish_reason === "stop") {
            const durationMs = Date.now() - startTime;
            const usage: LlmUsage = {
              promptTokens,
              completionTokens,
              totalTokens: promptTokens + completionTokens,
              costUsd: estimateCost(config.model, promptTokens, completionTokens),
              model: config.model,
            };
            logLlmCall({ provider: config.provider, model: config.model, promptTokens, completionTokens, durationMs });
            yield { type: "done", usage };
            return;
          }
        } catch {
          // skip malformed chunks
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  const durationMs = Date.now() - startTime;
  const usage: LlmUsage = {
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    costUsd: estimateCost(config.model, promptTokens, completionTokens),
    model: config.model,
  };
  logLlmCall({ provider: config.provider, model: config.model, promptTokens, completionTokens, durationMs });
  yield { type: "done", usage };
}

// ── Non-streaming chat completion ────────────────────────────────────────

export async function chatCompletion(
  messages: ChatMessage[],
  options?: {
    maxTokens?: number;
    temperature?: number;
    config?: LlmConfig;
  },
): Promise<{ content: string; usage: LlmUsage }> {
  const config = options?.config || resolveLlmConfig();
  const startTime = Date.now();

  // Create Langfuse trace + generation for observability
  const traceId = langfuse.createTrace({
    name: `llm:${config.model}`,
    tags: [config.provider, "chat"],
    metadata: { model: config.model, provider: config.provider },
  });
  const genId = langfuse.createGeneration({
    traceId,
    name: `chat:${config.model}`,
    model: config.model,
    provider: config.provider,
    input: messages,
    startTime: new Date(startTime),
  });

  const body: Record<string, unknown> = {
    model: config.model,
    messages,
    max_tokens: options?.maxTokens ?? 1024,
    temperature: options?.temperature ?? 0.3,
    stream: false,
  };

  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(config.apiKey && config.apiKey !== "not-needed"
        ? { Authorization: `Bearer ${config.apiKey}` }
        : {}),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    logLlmCall({ provider: config.provider, model: config.model, promptTokens: 0, completionTokens: 0, durationMs: Date.now() - startTime, error: `HTTP ${response.status}` });
    langfuse.endGeneration(genId, traceId, { promptTokens: 0, completionTokens: 0, totalTokens: 0, costUsd: 0, model: config.model }, { error: errorText.slice(0, 200) });
    throw new Error(`LLM HTTP ${response.status}: ${errorText.slice(0, 200)}`);
  }

  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };

  const content = json.choices?.[0]?.message?.content ?? "";
  const promptTokens = json.usage?.prompt_tokens ?? Math.ceil(JSON.stringify(messages).length / 4);
  const completionTokens = json.usage?.completion_tokens ?? Math.ceil(content.length / 4);
  const durationMs = Date.now() - startTime;
  const usage: LlmUsage = {
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    costUsd: estimateCost(config.model, promptTokens, completionTokens),
    model: config.model,
  };

  logLlmCall({ provider: config.provider, model: config.model, promptTokens, completionTokens, durationMs });
  langfuse.endGeneration(genId, traceId, usage, content);

  return { content, usage };
}
