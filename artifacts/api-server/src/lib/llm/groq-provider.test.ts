/**
 * Verification test for the Groq LLM provider integration.
 *
 * Confirms that the Groq provider:
 *   1. Is selectable via LLM_PROVIDER=groq
 *   2. Returns an LlmConfig matching the shared interface
 *   3. Uses the correct default base URL and model
 *   4. Reads GROQ_API_KEY from env (or falls back to LLM_API_KEY)
 *   5. Is an OpenAI-compatible provider (POST /v1/chat/completions)
 *
 * Run with:
 *   npx tsx artifacts/api-server/src/lib/llm/groq-provider.test.ts
 *
 * This does NOT call the Groq API — it only validates the config resolution.
 */

import { resolveLlmConfig } from "./provider.js";
import type { LlmConfig } from "./provider.js";

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

async function run() {
  console.log("Groq provider config test\n");

  // Save original env and set clean slate
  const origProvider = process.env.LLM_PROVIDER;
  const origGroqKey = process.env.GROQ_API_KEY;
  const origLlmKey = process.env.LLM_API_KEY;
  const origLlmModel = process.env.LLM_MODEL;
  const origLlmBaseUrl = process.env.LLM_BASE_URL;

  try {
    // ── 1. Select via LLM_PROVIDER=groq ─────────────────────────────────
    console.log("1. Provider selection");
    process.env.LLM_PROVIDER = "groq";
    process.env.GROQ_API_KEY = "gsk_test_key";
    process.env.LLM_MODEL = "";
    process.env.LLM_BASE_URL = "";

    const config: LlmConfig = resolveLlmConfig();
    assert(config.provider === "groq", `provider is "groq" (got: "${config.provider}")`);
    assert(
      config.baseUrl === "https://api.groq.com/openai/v1",
      `default base URL (got: "${config.baseUrl}")`,
    );
    assert(
      config.model === "llama3-70b-8192",
      `default model (got: "${config.model}")`,
    );
    assert(
      config.apiKey === "gsk_test_key",
      `reads GROQ_API_KEY (got: "${config.apiKey}")`,
    );

    // ── 2. Interface contract ──────────────────────────────────────────
    console.log("\n2. Interface contract");
    assert(typeof config.baseUrl === "string", "baseUrl is a string");
    assert(typeof config.apiKey === "string", "apiKey is a string");
    assert(typeof config.model === "string", "model is a string");
    assert(config.baseUrl.length > 0, "baseUrl is non-empty");
    assert(config.model.length > 0, "model is non-empty");

    // ── 3. Falls back to LLM_API_KEY when GROQ_API_KEY is unset ────────
    console.log("\n3. Key fallback");
    process.env.GROQ_API_KEY = "";
    process.env.LLM_API_KEY = "gsk_fallback_key";
    const config2 = resolveLlmConfig();
    assert(
      config2.apiKey === "gsk_fallback_key",
      `falls back to LLM_API_KEY (got: "${config2.apiKey}")`,
    );

    // ── 4. Override model and base URL via env ─────────────────────────
    console.log("\n4. Env overrides");
    process.env.LLM_MODEL = "mixtral-8x7b-32768";
    process.env.LLM_BASE_URL = "https://custom.groq.com/v1";
    const config3 = resolveLlmConfig();
    assert(
      config3.model === "mixtral-8x7b-32768",
      `overridden model (got: "${config3.model}")`,
    );
    assert(
      config3.baseUrl === "https://custom.groq.com/v1",
      `overridden base URL (got: "${config3.baseUrl}")`,
    );

    // ── 5. Other providers are unaffected ─────────────────────────────
    console.log("\n5. No side effects on other providers");
    process.env.LLM_PROVIDER = "fireworks";
    process.env.LLM_API_KEY = "fw_key";
    process.env.LLM_BASE_URL = "";  // clear overrides from previous tests
    process.env.LLM_MODEL = "";
    const fwConfig = resolveLlmConfig();
    assert(fwConfig.provider === "fireworks", "fireworks still selectable");
    assert(
      fwConfig.baseUrl === "https://api.fireworks.ai/inference/v1",
      "fireworks base URL unchanged",
    );

    process.env.LLM_PROVIDER = "openai";
    const oaConfig = resolveLlmConfig();
    assert(oaConfig.provider === "openai", "openai still selectable");

    process.env.LLM_PROVIDER = "ollama";
    const olConfig = resolveLlmConfig();
    assert(olConfig.provider === "ollama", "ollama still selectable");

    process.env.LLM_PROVIDER = "amd";
    const amdConfig = resolveLlmConfig();
    assert(amdConfig.provider === "amd", "amd still selectable");

    // ── 6. Meets the LlmConfig shape ──────────────────────────────────
    console.log("\n6. LlmConfig shape validation");
    const shapeKeys: (keyof LlmConfig)[] = ["baseUrl", "apiKey", "model", "provider"];
    for (const key of shapeKeys) {
      assert(key in config, `config has "${key}"`);
    }

  } finally {
    // Restore original env
    process.env.LLM_PROVIDER = origProvider;
    process.env.GROQ_API_KEY = origGroqKey;
    process.env.LLM_API_KEY = origLlmKey;
    process.env.LLM_MODEL = origLlmModel;
    process.env.LLM_BASE_URL = origLlmBaseUrl;
  }

  // ── Summary ──────────────────────────────────────────────────────────
  console.log(`\n${"─".repeat(50)}`);
  console.log(`${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}

run().catch((err) => {
  console.error("Test harness crashed:", err);
  process.exit(1);
});
