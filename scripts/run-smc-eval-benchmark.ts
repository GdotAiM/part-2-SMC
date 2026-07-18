/**
 * SMC-EVAL Benchmark Runner
 *
 * Evaluates all 100 scenarios through the scoring engine and reports
 * aggregate results by category dimension.
 *
 * Run: pnpm exec tsx scripts/run-smc-eval-benchmark.ts
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCENARIOS_DIR = join(__dirname, "..", "data", "smc-eval", "scenarios");

// ─── Lazy import of scoring engine from api-zod ──────────────────────────────

let scorer: any;
try {
  scorer = await import("../lib/api-zod/src/strategies/smc-eval-scoring.ts");
} catch {
  // Fallback path
  try {
    scorer = await import("@workspace/api-zod/strategies");
  } catch {
    console.error("Cannot import scoring engine. Make sure lib/api-zod is built.");
    process.exit(1);
  }
}
const { computeSmcEvalScore, classifyModelMatch } = scorer;

// ─── Collect scenarios ──────────────────────────────────────────────────────

const scenarioIds = readdirSync(SCENARIOS_DIR)
  .filter(f => f.endsWith(".json"))
  .map(f => f.replace(/\.json$/, ""))
  .sort();

// ─── Category range detection ─────────────────────────────────────────────

function getCategory(id: string): string {
  const n = parseInt(id.replace("SMC-EVAL-", ""));
  if (n <= 20) return "clear";
  if (n <= 40) return "false-positive";
  if (n <= 60) return "model-conflict";
  if (n <= 80) return "adversarial";
  return "ambiguous";
}

function getCategoryLabel(c: string): string {
  const labels: Record<string, string> = {
    "clear": "Clear Model",
    "false-positive": "False Positive",
    "model-conflict": "Model Conflict",
    "adversarial": "Adversarial",
    "ambiguous": "Ambiguous",
  };
  return labels[c] ?? c;
}

// ─── All model IDs for hallucination check ──────────────────────────────────

const ALL_MODEL_IDS = [
  "smc-confluence-1", "smc-confluence-2", "smc-confluence-3", "smc-confluence-4", "smc-confluence-5",
  "classical-05", "classical-06", "classical-07", "classical-08", "classical-09", "classical-10", "classical-11",
  "temporal-silver-bullet-london", "temporal-silver-bullet-nyam", "temporal-silver-bullet-nypm",
  "temporal-judas-swing", "temporal-power-of-three",
  "reversal-turtle-soup", "reversal-unicorn", "reversal-scob", "framework-sharp-turn", "framework-2fvg",
  "mmxm-mmsm", "mmxm-mmbm",
];

// ─── Results accumulator ────────────────────────────────────────────────────

interface ScenarioResult {
  id: string;
  category: string;
  score: number;
  classification: string;
  modelClassification: string;
  failureFlags: string[];
  structuralAccuracy: number;
  modelAlignment: number;
  confluenceReasoning: number;
  tradePrecision: number;
  hallucinationAvoidance: number;
}

const results: ScenarioResult[] = [];
const failures: string[] = [];

// ═══════════════════════════════════════════════════════════════════════════════
// Evaluate each scenario
// ═══════════════════════════════════════════════════════════════════════════════

console.log(`\nSMC-EVAL Benchmark — Evaluating ${scenarioIds.length} scenarios\n`);

for (const sid of scenarioIds) {
  try {
    const path = join(SCENARIOS_DIR, `${sid}.json`);
    const raw = readFileSync(path, "utf8");
    const scenario = JSON.parse(raw);
    const gt = scenario.groundTruth;
    const cat = getCategory(sid);

    // Simulate a "perfect" AI that identifies the primary model correctly
    const aiModelIds = [gt.models.primary.id, ...gt.models.alternatives.map((m: any) => m.id)];

    // Build detected events from ground truth
    const detectedEvents = gt.structure.events;

    // Score the "AI" against ground truth
    const scores = computeSmcEvalScore({
      groundTruth: gt,
      detectedEvents,
      aiModels: aiModelIds.map((id: string) => ({
        id, name: id, ontology: "EXECUTION_MODEL", confidence: 0.85,
      })),
      reasoningText: `The market structure is ${gt.structure.direction}. ${gt.structure.events.map((e: any) => `${e.type} ${e.direction} on ${e.timeframe}`).join(". ")}. ${gt.concepts?.join(", ") ?? ""} are present. This aligns with ${gt.models.primary.name}.`,
      aiEntry: "FVG retest at identified level",
      aiStop: "below sweep low",
      aiTarget: "next liquidity pool",
      aiRR: 2.0,
      aiInvalidation: "close beyond sweep extreme",
      allModelIds: ALL_MODEL_IDS,
    });

    const { classification: modelClass, failureFlags, alternativeAwareness } = classifyModelMatch(aiModelIds, gt);
    if (alternativeAwareness) {
      // Logged but not shown per-scenario; aggregated below
    }

    results.push({
      id: sid,
      category: cat,
      score: scores.total,
      classification: scores.classification,
      modelClassification: modelClass,
      failureFlags,
      structuralAccuracy: scores.structuralAccuracy.total,
      modelAlignment: scores.modelAlignment.total,
      confluenceReasoning: scores.confluenceReasoning.total,
      tradePrecision: scores.tradePrecision.total,
      hallucinationAvoidance: scores.hallucinationAvoidance.total,
    });
  } catch (err: any) {
    failures.push(`${sid}: ${err.message}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Report
// ═══════════════════════════════════════════════════════════════════════════════

console.log("=".repeat(80));
console.log("SMC-EVAL BENCHMARK RESULTS");
console.log("=".repeat(80));
console.log(`\nTotal evaluated: ${results.length}/${scenarioIds.length}`);
if (failures.length > 0) {
  console.log(`Failures: ${failures.length}`);
  failures.forEach(f => console.log(`  ✗ ${f}`));
}

const categories = [...new Set(results.map(r => r.category))];

for (const cat of categories) {
  const catResults = results.filter(r => r.category === cat);
  const avgScore = catResults.reduce((s, r) => s + r.score, 0) / catResults.length;
  const avgSA = catResults.reduce((s, r) => s + r.structuralAccuracy, 0) / catResults.length;
  const avgMA = catResults.reduce((s, r) => s + r.modelAlignment, 0) / catResults.length;
  const avgCR = catResults.reduce((s, r) => s + r.confluenceReasoning, 0) / catResults.length;
  const avgTP = catResults.reduce((s, r) => s + r.tradePrecision, 0) / catResults.length;
  const avgHA = catResults.reduce((s, r) => s + r.hallucinationAvoidance, 0) / catResults.length;

  const classifications = catResults.reduce((acc, r) => {
    acc[r.classification] = (acc[r.classification] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log(`\n── ${getCategoryLabel(cat)} (${catResults.length} scenarios) ──`);
  console.log(`  Avg Total:    ${avgScore.toFixed(1)}/100`);
  console.log(`  Structural:   ${avgSA.toFixed(1)}/30`);
  console.log(`  Model Align:  ${avgMA.toFixed(1)}/25`);
  console.log(`  Reasoning:    ${avgCR.toFixed(1)}/20`);
  console.log(`  Precision:    ${avgTP.toFixed(1)}/15`);
  console.log(`  Hallucinate:  ${avgHA.toFixed(1)}/10`);
  console.log(`  Classifications: ${Object.entries(classifications).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join(", ")}`);

  // Check for any failure flags
  const flags = catResults.flatMap(r => r.failureFlags);
  if (flags.length > 0) {
    const flagCounts = flags.reduce((acc, f) => { acc[f] = (acc[f] ?? 0) + 1; return acc; }, {} as Record<string, number>);
    console.log(`  Failure Flags: ${Object.entries(flagCounts).map(([k, v]) => `${k}=${v}`).join(", ")}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Overall totals
// ═══════════════════════════════════════════════════════════════════════════════

console.log("\n" + "=".repeat(80));
console.log("OVERALL");
console.log("=".repeat(80));

const overall = results.reduce((s, r) => s + r.score, 0) / results.length;
const overallSA = results.reduce((s, r) => s + r.structuralAccuracy, 0) / results.length;
const overallMA = results.reduce((s, r) => s + r.modelAlignment, 0) / results.length;
const overallCR = results.reduce((s, r) => s + r.confluenceReasoning, 0) / results.length;
const overallTP = results.reduce((s, r) => s + r.tradePrecision, 0) / results.length;
const overallHA = results.reduce((s, r) => s + r.hallucinationAvoidance, 0) / results.length;

console.log(`  Total:        ${overall.toFixed(1)}/100`);
console.log(`  Structural:   ${overallSA.toFixed(1)}/30`);
console.log(`  Model Align:  ${overallMA.toFixed(1)}/25`);
console.log(`  Reasoning:    ${overallCR.toFixed(1)}/20`);
console.log(`  Precision:    ${overallTP.toFixed(1)}/15`);
console.log(`  Hallucinate:  ${overallHA.toFixed(1)}/10`);

const classDist = results.reduce((acc, r) => {
  acc[r.classification] = (acc[r.classification] ?? 0) + 1;
  return acc;
}, {} as Record<string, number>);

console.log(`\n  Class Dist:   ${Object.entries(classDist).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join(", ")}`);

const modelClassDist = results.reduce((acc, r) => {
  acc[r.modelClassification] = (acc[r.modelClassification] ?? 0) + 1;
  return acc;
}, {} as Record<string, number>);

console.log(`  Model Class:  ${Object.entries(modelClassDist).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join(", ")}`);

const allFlags = results.flatMap(r => r.failureFlags);
if (allFlags.length > 0) {
  const flagDist = allFlags.reduce((acc, f) => { acc[f] = (acc[f] ?? 0) + 1; return acc; }, {} as Record<string, number>);
  console.log(`  Failure Flags: ${Object.entries(flagDist).map(([k, v]) => `${k}=${v}`).join(", ")}`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Worst performers
// ═══════════════════════════════════════════════════════════════════════════════

const worst = [...results].sort((a, b) => a.score - b.score).slice(0, 5);
console.log(`\n  Worst 5: ${worst.map(r => `${r.id} (${r.score}, ${r.classification})`).join(", ")}`);

const best = [...results].sort((a, b) => b.score - a.score).slice(0, 5);
console.log(`  Best 5: ${best.map(r => `${r.id} (${r.score}, ${r.classification})`).join(", ")}`);

console.log(`\nDone. ${results.length} scenarios evaluated.`);
if (failures.length > 0) process.exitCode = 1;
