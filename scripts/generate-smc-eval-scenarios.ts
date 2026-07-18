/**
 * SMC-EVAL Benchmark Scenario Generator
 *
 * Generates 100 diverse scenarios across 5 categories:
 *   20 Clear Model, 20 False Positive, 20 Model Conflict,
 *   20 Adversarial, 20 Ambiguous
 *
 * Run: pnpm exec tsx scripts/generate-smc-eval-scenarios.ts
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "data", "smc-eval", "scenarios");
mkdirSync(OUT, { recursive: true });

// ─── Helpers ──────────────────────────────────────────────────────────────────

function id(n: number): string {
  return `SMC-EVAL-${String(n).padStart(6, "0")}`;
}

const TFS = ["1m", "5m", "15m", "1h", "4h", "1d"];
const CURRENCIES = ["USD", "EUR", "GBP", "JPY", "AUD", "NZD", "CAD", "CHF"];
const CRYPTO = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT"];
const FOREX = ["EURUSD=X", "GBPUSD=X", "USDJPY=X", "AUDUSD=X", "USDCAD=X"];

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function pickN<T>(arr: T[], n: number): T[] { const s = [...arr].sort(() => Math.random() - 0.5); return s.slice(0, n); }
function rng(min: number, max: number): number { return Math.round((Math.random() * (max - min) + min) * 100) / 100; }

// Model pools
const EXECUTION_MODELS = [
  "smc-confluence-1", "smc-confluence-2", "smc-confluence-3", "smc-confluence-4", "smc-confluence-5",
  "classical-05", "classical-06", "classical-07", "classical-09", "classical-10", "classical-11",
  "reversal-turtle-soup", "reversal-unicorn", "reversal-scob", "framework-sharp-turn", "framework-2fvg",
];
const TEMPORAL_MODELS = ["temporal-silver-bullet-london", "temporal-silver-bullet-nyam", "temporal-silver-bullet-nypm", "temporal-judas-swing", "classical-08"];
const MARKET_CYCLE_MODELS = ["mmxm-mmsm", "mmxm-mmbm", "temporal-power-of-three"];
const ALL_MODEL_IDS = [...EXECUTION_MODELS, ...TEMPORAL_MODELS, ...MARKET_CYCLE_MODELS];

const MODEL_NAMES: Record<string, string> = {
  "smc-confluence-1": "HTF POI + BOS + FVG",
  "smc-confluence-2": "HTF POI + BOS + IDM + FVG",
  "smc-confluence-3": "HTF POI + BOS + FVG + OTE",
  "smc-confluence-4": "HTF POI + BOS + IDM + FVG + OTE",
  "smc-confluence-5": "Five Box Setup",
  "classical-05": "Model 5 — Advanced Session Setup",
  "classical-06": "Model 6 — Universal Buy Model",
  "classical-07": "Model 7 — Universal Sell Model",
  "classical-08": "Model 8 — Weekly Range Strategy",
  "classical-09": "Model 9 — One Shot One Kill",
  "classical-10": "Model 10 — Swing Stalking",
  "classical-11": "Model 11 — Daily Range Scalping",
  "temporal-silver-bullet-london": "Silver Bullet — London Open",
  "temporal-silver-bullet-nyam": "Silver Bullet — New York AM",
  "temporal-silver-bullet-nypm": "Silver Bullet — New York PM",
  "temporal-judas-swing": "Judas Swing",
  "temporal-power-of-three": "Power of Three (PO3)",
  "reversal-turtle-soup": "Turtle Soup",
  "reversal-unicorn": "Unicorn Model",
  "reversal-scob": "Single Candle OB (SCOB)",
  "framework-sharp-turn": "Sharp Turn (ST) Model",
  "framework-2fvg": "2 FVG Model",
  "mmxm-mmsm": "Market Maker Sell Model (MMSM)",
  "mmxm-mmbm": "Market Maker Buy Model (MMBM)",
};

function mkModel(id: string, conf: number) {
  return { id, name: MODEL_NAMES[id] ?? id, ontology: "EXECUTION_MODEL" as const, confidence: conf };
}

function mkScenario(
  n: number, cat: string, asset: string, session: string,
  direction: "BULLISH" | "BEARISH" | "RANGE",
  events: Array<{ type: string; timeframe: string; direction: string }>,
  concepts: string[],
  primaryId: string,
  altIds: string[],
  rejectIds: string[],
  tfAlignments: Array<{ higherTf: string; lowerTf: string; alignment: string }>,
  execution?: { direction: string; entry: string; stop: string; target: string; rr: number; invalidation: string },
  liquiditySwept?: string,
) {
  const lid = id(n);
  const ts = `2026-07-${String(18 + Math.floor(n / 10)).padStart(2, "0")}T${String(8 + (n % 10)).padStart(2, "0")}:00:00Z`;

  // Only set liquidity.swept if a LIQUIDITY_SWEEP event actually exists
  const hasSweepEvent = events.some(e => e.type === "LIQUIDITY_SWEEP");
  const resolvedSwept = liquiditySwept !== undefined
    ? liquiditySwept
    : hasSweepEvent
      ? (direction === "BULLISH" ? "sell_side" : direction === "BEARISH" ? "buy_side" : undefined)
      : undefined;

  return {
    scenarioId: lid,
    version: "1.0",
    market: asset.includes("=X") ? "forex" : "crypto",
    asset,
    timestamp: ts,
    session,
    timeframes: [...new Set(events.map(e => e.timeframe))],
    groundTruth: {
      scenarioId: lid,
      market: { asset, session, timestamp: ts },
      structure: { direction, events },
      liquidity: {
        swept: resolvedSwept,
        remaining: events.filter(e => e.type === "LIQUIDITY_SWEEP" || e.type === "BOS").map((_, i) => ({
          type: direction === "BULLISH" ? "BSL" : "SSL",
          price: direction === "BULLISH" ? 65000 + i * 400 : 61000 - i * 400,
        })),
      },
      concepts,
      models: {
        primary: mkModel(primaryId, rng(0.75, 0.95)),
        alternatives: altIds.map(id => mkModel(id, rng(0.5, 0.7))),
        rejected: rejectIds.map(id => mkModel(id, 0)),
      },
      timeframeAlignment: tfAlignments,
      execution: execution ? {
        direction: execution.direction,
        entryTrigger: execution.entry,
        stopLevel: execution.stop,
        targetLevel: execution.target,
        minimumRR: execution.rr,
        invalidation: execution.invalidation,
      } : undefined,
      evaluation: {
        evaluator: "DETERMINISTIC",
        version: "1.0",
        timestamp: ts,
        scenarioId: lid,
      },
    },
    modelCandidates: [primaryId, ...altIds],
    requiredConcepts: concepts,
    invalidConcepts: cat === "false-positive" ? [pick(["breaker", "smt", "induced"])] : [],
    evaluationRubric: {
      category: cat,
      expectedPrimaryModel: primaryId,
      minScore: cat === "clear" ? 75 : cat === "ambiguous" ? 40 : 60,
      criticalErrors: cat === "adversarial" ? ["MODEL_HALLUCINATION"] : [],
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 20 CLEAR MODEL SCENARIOS (n=1..20)
// Each scenario has one strongly represented execution model
// ═══════════════════════════════════════════════════════════════════════════════

const clearModels = [
  { m: "smc-confluence-1", d: "BULLISH", ev: [{ t: "LIQUIDITY_SWEEP", tf: "5m", d: "bearish" }, { t: "MSS", tf: "5m", d: "bullish" }, { t: "BOS", tf: "1h", d: "bullish" }, { t: "FVG", tf: "5m", d: "bullish" }], c: ["fvg", "bos", "mss", "liquidity"] },
  { m: "smc-confluence-2", d: "BULLISH", ev: [{ t: "LIQUIDITY_SWEEP", tf: "5m", d: "bearish" }, { t: "MSS", tf: "5m", d: "bullish" }, { t: "BOS", tf: "1h", d: "bullish" }, { t: "FVG", tf: "5m", d: "bullish" }], c: ["fvg", "bos", "mss", "inducement"] },
  { m: "smc-confluence-3", d: "BULLISH", ev: [{ t: "LIQUIDITY_SWEEP", tf: "5m", d: "bearish" }, { t: "MSS", tf: "5m", d: "bullish" }, { t: "FVG", tf: "5m", d: "bullish" }], c: ["fvg", "bos", "ote"] },
  { m: "smc-confluence-4", d: "BULLISH", ev: [{ t: "LIQUIDITY_SWEEP", tf: "5m", d: "bearish" }, { t: "MSS", tf: "5m", d: "bullish" }, { t: "FVG", tf: "5m", d: "bullish" }], c: ["fvg", "bos", "inducement", "ote"] },
  { m: "smc-confluence-5", d: "BULLISH", ev: [{ t: "BOS", tf: "5m", d: "bullish" }, { t: "MSS", tf: "5m", d: "bearish" }], c: ["bos", "mss", "consolidation"] },
  { m: "temporal-silver-bullet-london", d: "BULLISH", ev: [{ t: "LIQUIDITY_SWEEP", tf: "5m", d: "bearish" }, { t: "MSS", tf: "5m", d: "bullish" }, { t: "FVG", tf: "5m", d: "bullish" }], c: ["fvg", "bos", "mss", "session"] },
  { m: "temporal-silver-bullet-nyam", d: "BULLISH", ev: [{ t: "LIQUIDITY_SWEEP", tf: "5m", d: "bearish" }, { t: "MSS", tf: "5m", d: "bullish" }, { t: "FVG", tf: "5m", d: "bullish" }], c: ["fvg", "bos", "mss", "session"] },
  { m: "temporal-judas-swing", d: "BULLISH", ev: [{ t: "LIQUIDITY_SWEEP", tf: "5m", d: "bearish" }, { t: "MSS", tf: "5m", d: "bullish" }], c: ["bos", "mss", "liquidity", "session"] },
  { m: "temporal-power-of-three", d: "BULLISH", ev: [{ t: "BOS", tf: "15m", d: "bearish" }, { t: "BOS", tf: "15m", d: "bullish" }], c: ["bos", "mss", "consolidation"] },
  { m: "reversal-turtle-soup", d: "BULLISH", ev: [{ t: "LIQUIDITY_SWEEP", tf: "5m", d: "bullish" }, { t: "MSS", tf: "5m", d: "bullish" }], c: ["liquidity", "bos", "mss"] },
  { m: "reversal-unicorn", d: "BULLISH", ev: [{ t: "BOS", tf: "5m", d: "bullish" }, { t: "FVG", tf: "5m", d: "bullish" }], c: ["fvg", "bos", "breaker"] },
  { m: "reversal-scob", d: "BULLISH", ev: [{ t: "LIQUIDITY_SWEEP", tf: "5m", d: "bearish" }, { t: "MSS", tf: "5m", d: "bullish" }], c: ["bos", "liquidity", "ob"] },
  { m: "framework-2fvg", d: "BEARISH", ev: [{ t: "LIQUIDITY_SWEEP", tf: "4h", d: "bullish" }, { t: "MSS", tf: "4h", d: "bearish" }, { t: "FVG", tf: "4h", d: "bearish" }], c: ["fvg", "bos", "mss", "liquidity"] },
  { m: "classical-09", d: "BULLISH", ev: [{ t: "LIQUIDITY_SWEEP", tf: "1h", d: "bearish" }, { t: "MSS", tf: "1h", d: "bullish" }], c: ["liquidity", "bos", "mss"] },
  { m: "classical-06", d: "BULLISH", ev: [{ t: "LIQUIDITY_SWEEP", tf: "4h", d: "bearish" }, { t: "MSS", tf: "15m", d: "bullish" }], c: ["liquidity", "bos", "mss"] },
  { m: "classical-07", d: "BEARISH", ev: [{ t: "LIQUIDITY_SWEEP", tf: "4h", d: "bullish" }, { t: "MSS", tf: "15m", d: "bearish" }], c: ["liquidity", "bos", "mss"] },
  { m: "mmxm-mmsm", d: "BEARISH", ev: [{ t: "BOS", tf: "4h", d: "bearish" }, { t: "MSS", tf: "1h", d: "bearish" }], c: ["bos", "mss", "smt", "liquidity"] },
  { m: "mmxm-mmbm", d: "BULLISH", ev: [{ t: "BOS", tf: "4h", d: "bullish" }, { t: "MSS", tf: "1h", d: "bullish" }], c: ["bos", "mss", "smt", "liquidity"] },
  { m: "classical-05", d: "BULLISH", ev: [{ t: "MSS", tf: "15m", d: "bullish" }, { t: "BOS", tf: "15m", d: "bullish" }], c: ["bos", "mss", "session"] },
  { m: "framework-sharp-turn", d: "BEARISH", ev: [{ t: "LIQUIDITY_SWEEP", tf: "1h", d: "bullish" }, { t: "MSS", tf: "1h", d: "bearish" }], c: ["liquidity", "bos", "mss"] },
];

for (let i = 0; i < 20; i++) {
  const cm = clearModels[i];
  const assets = i < 10 ? CRYPTO : FOREX;
  const sessions = ["LONDON_OPEN", "NY_AM", "ASIAN", "NY_PM"];
  const altPool = EXECUTION_MODELS.filter(m => m !== cm.m);
  const altIds = pickN(altPool, 2);
  const allOthers = ALL_MODEL_IDS.filter(m => m !== cm.m && !altIds.includes(m));
  const sc = mkScenario(
    i + 1, "clear", pick(assets), pick(sessions),
    cm.d as "BULLISH" | "BEARISH",
    cm.ev.map(e => ({ type: e.t, timeframe: e.tf, direction: e.d })),
    cm.c,
    cm.m, altIds, pickN(allOthers, 2),
    [{ higherTf: "4h", lowerTf: "1h", alignment: cm.d }, { higherTf: "1h", lowerTf: "5m", alignment: cm.d }],
    { direction: cm.d === "BULLISH" ? "LONG" : "SHORT", entry: "FVG retest", stop: "below sweep low", target: "next liquidity pool", rr: 2, invalidation: "close beyond sweep" },
    cm.d === "BULLISH" ? "sell_side" : "buy_side",
  );
  writeFileSync(join(OUT, `${id(i + 1)}.json`), JSON.stringify(sc, null, 2));
}

// ═══════════════════════════════════════════════════════════════════════════════
// 20 FALSE POSITIVE SCENARIOS (n=21..40)
// Market resembles a model but fails a critical prerequisite
// ═══════════════════════════════════════════════════════════════════════════════

const falsePositivePatterns = [
  { lure: "smc-confluence-1", missing: ["fvg"], has: ["bos", "mss"], reason: "No FVG formed" },
  { lure: "smc-confluence-3", missing: ["ote"], has: ["fvg", "bos"], reason: "Price outside OTE zone" },
  { lure: "smc-confluence-2", missing: ["inducement"], has: ["fvg", "bos", "mss"], reason: "No inducement zone" },
  { lure: "temporal-silver-bullet-london", missing: ["session"], has: ["fvg", "mss"], reason: "Outside London session window" },
  { lure: "reversal-unicorn", missing: ["breaker"], has: ["fvg", "bos"], reason: "No breaker block — plain FVG only" },
  { lure: "reversal-turtle-soup", missing: ["liquidity"], has: ["bos", "mss"], reason: "No liquidity sweep preceding the break" },
  { lure: "temporal-judas-swing", missing: ["session"], has: ["bos", "mss"], reason: "Occurs mid-session, not at open" },
  { lure: "mmxm-mmsm", missing: ["smt"], has: ["bos", "mss", "liquidity"], reason: "No SMT divergence confirmation" },
  { lure: "mmxm-mmbm", missing: ["smt"], has: ["bos", "mss", "liquidity"], reason: "No SMT divergence confirmation" },
  { lure: "smc-confluence-5", missing: ["consolidation"], has: ["bos", "mss"], reason: "No prior consolidation zone" },
  { lure: "classical-09", missing: ["liquidity"], has: ["bos", "mss"], reason: "No liquidity sweep for OSOK" },
  { lure: "reversal-scob", missing: ["liquidity"], has: ["bos", "mss"], reason: "No single-candle sweep" },
  { lure: "temporal-silver-bullet-nyam", missing: ["session"], has: ["fvg", "mss"], reason: "Outside NY AM window" },
  { lure: "framework-2fvg", missing: ["fvg"], has: ["bos", "mss", "liquidity"], reason: "Only one FVG formed" },
  { lure: "classical-06", missing: ["liquidity"], has: ["bos", "mss"], reason: "Sell-side not swept — not a buy setup" },
  { lure: "smc-confluence-4", missing: ["inducement", "ote"], has: ["fvg", "bos", "mss"], reason: "Missing IDM + OTE confluence" },
  { lure: "classical-05", missing: ["session"], has: ["bos", "mss"], reason: "Weekend session — not a weekday setup" },
  { lure: "temporal-power-of-three", missing: ["bos"], has: ["mss"], reason: "No BOS — manipulation incomplete" },
  { lure: "classical-07", missing: ["liquidity"], has: ["bos", "mss"], reason: "No buy-side sweep — not a sell setup" },
  { lure: "framework-sharp-turn", missing: ["mss"], has: ["bos", "liquidity"], reason: "No structural reversal confirmed" },
];

for (let i = 0; i < 20; i++) {
  const fp = falsePositivePatterns[i];
  const dir = i % 2 === 0 ? "BULLISH" : "BEARISH";
  const events = fp.has.map(h => ({ type: h === "bos" ? "BOS" : h === "mss" ? "MSS" : h === "fvg" ? "FVG" : h === "liquidity" ? "LIQUIDITY_SWEEP" : "BOS", timeframe: "5m", direction: dir === "BULLISH" ? "bullish" : "bearish" }));
  const altPool = EXECUTION_MODELS.filter(m => m !== fp.lure);
  const sc = mkScenario(
    20 + i + 1, "false-positive", pick(i < 10 ? CRYPTO : FOREX), pick(["LONDON_OPEN", "NY_AM", "LATE"]),
    dir, events, fp.has,
    fp.lure, pickN(altPool, 1), pickN(ALL_MODEL_IDS.filter(m => m !== fp.lure), 2),
    [{ higherTf: "4h", lowerTf: "1h", alignment: dir }],
    undefined, undefined,
  );
  sc.evaluationRubric.missingConcepts = fp.missing;
  sc.evaluationRubric.falsePositiveReason = fp.reason;
  writeFileSync(join(OUT, `${id(20 + i + 1)}.json`), JSON.stringify(sc, null, 2));
}

// ═══════════════════════════════════════════════════════════════════════════════
// 20 MODEL CONFLICT SCENARIOS (n=41..60)
// Multiple models provide competing interpretations
// ═══════════════════════════════════════════════════════════════════════════════

const conflictPairs = [
  ["smc-confluence-1", "temporal-silver-bullet-london"],
  ["smc-confluence-2", "smc-confluence-4"],
  ["reversal-turtle-soup", "reversal-scob"],
  ["classical-06", "classical-07"],
  ["mmxm-mmsm", "smc-confluence-1"],
  ["temporal-judas-swing", "reversal-turtle-soup"],
  ["smc-confluence-3", "smc-confluence-1"],
  ["framework-2fvg", "smc-confluence-1"],
  ["classical-05", "classical-11"],
  ["smc-confluence-5", "temporal-power-of-three"],
  ["reversal-unicorn", "smc-confluence-1"],
  ["classical-09", "classical-10"],
  ["temporal-silver-bullet-nyam", "temporal-silver-bullet-nypm"],
  ["mmxm-mmbm", "classical-06"],
  ["framework-sharp-turn", "framework-2fvg"],
  ["smc-confluence-4", "smc-confluence-3"],
  ["classical-06", "classical-09"],
  ["reversal-turtle-soup", "reversal-unicorn"],
  ["smc-confluence-2", "smc-confluence-1"],
  ["temporal-power-of-three", "smc-confluence-5"],
];

for (let i = 0; i < 20; i++) {
  const [a, b] = conflictPairs[i];
  const dir = i < 10 ? "BULLISH" : "BEARISH";
  const events = [
    { type: "LIQUIDITY_SWEEP" as const, timeframe: "5m" as const, direction: dir === "BULLISH" ? "bearish" as const : "bullish" as const },
    { type: "MSS" as const, timeframe: "5m" as const, direction: dir === "BULLISH" ? "bullish" as const : "bearish" as const },
    { type: "FVG" as const, timeframe: "5m" as const, direction: dir === "BULLISH" ? "bullish" as const : "bearish" as const },
  ];
  const altPool = EXECUTION_MODELS.filter(m => m !== a && m !== b);
  const sc = mkScenario(
    40 + i + 1, "model-conflict", pick(i < 10 ? CRYPTO : FOREX), pick(["LONDON_OPEN", "NY_AM", "ASIAN", "NY_PM"]),
    dir, events, ["fvg", "bos", "mss", "liquidity"],
    a, [b], pickN(altPool, 2),
    [{ higherTf: "4h", lowerTf: "1h", alignment: dir }],
    { direction: dir === "BULLISH" ? "LONG" : "SHORT", entry: "FVG retest", stop: "below sweep", target: "next pool", rr: 2, invalidation: "close beyond sweep" },
    dir === "BULLISH" ? "sell_side" : "buy_side",
  );
  sc.evaluationRubric.conflictBetween = [a, b];
  writeFileSync(join(OUT, `${id(40 + i + 1)}.json`), JSON.stringify(sc, null, 2));
}

// ═══════════════════════════════════════════════════════════════════════════════
// 20 ADVERSARIAL SCENARIOS (n=61..80)
// Designed to provoke common AI errors — trap claims, false narratives
// ═══════════════════════════════════════════════════════════════════════════════

const adversarialTraps = [
  { trap: "Breakout looks bullish but sweeps buy-side liquidity", correct: "bearish", lureModel: "smc-confluence-1", actualModel: "mmxm-mmsm" },
  { trap: "Bearish candle close suggests reversal — but no MSS confirmed", correct: "neutral", lureModel: "classical-07", actualModel: "temporal-power-of-three" },
  { trap: "Price above VWAP — retail thinks bullish, but price at premium extreme", correct: "bearish", lureModel: "classical-06", actualModel: "classical-07" },
  { trap: "FVG formed, but it's an inversion gap — filled almost immediately", correct: "neutral", lureModel: "smc-confluence-1", actualModel: "smc-confluence-5" },
  { trap: "Silver Bullet hour, but no liquidity sweep occurred", correct: "neutral", lureModel: "temporal-silver-bullet-london", actualModel: "temporal-power-of-three" },
  { trap: "Break of structure appears, but it's a terminal break after distribution", correct: "bearish", lureModel: "smc-confluence-1", actualModel: "mmxm-mmsm" },
  { trap: "Price swept equal lows — retail expects reversal, but continuation follows", correct: "bearish", lureModel: "reversal-turtle-soup", actualModel: "classical-07" },
  { trap: "Bullish candle with large body — displacement confirmed, but at range extreme", correct: "neutral", lureModel: "smc-confluence-3", actualModel: "smc-confluence-5" },
  { trap: "SMT divergence detected, but on wrong correlated pair", correct: "neutral", lureModel: "mmxm-mmbm", actualModel: "smc-confluence-1" },
  { trap: "Order block identifies support, but it's a breaker block — already failed", correct: "bearish", lureModel: "smc-confluence-2", actualModel: "reversal-unicorn" },
  { trap: "Judas Swing pattern at London open, but daily bias is bearish not bullish", correct: "bearish", lureModel: "temporal-judas-swing", actualModel: "mmxm-mmsm" },
  { trap: "Price is in discount zone — retail buys, but HTF trend is bearish", correct: "bearish", lureModel: "smc-confluence-3", actualModel: "classical-07" },
  { trap: "Consecutive bullish daily bias, but structure shows distribution phase", correct: "bearish", lureModel: "smc-confluence-1", actualModel: "mmxm-mmsm" },
  { trap: "Two FVGs formed in succession — but first was inverted", correct: "neutral", lureModel: "framework-2fvg", actualModel: "smc-confluence-1" },
  { trap: "OSOK conditions met, but R:R is only 1.2 not minimum 3.0", correct: "neutral", lureModel: "classical-09", actualModel: "classical-05" },
  { trap: "Sharp Turn setup triggers on 1h, but 4h context is ranging", correct: "neutral", lureModel: "framework-sharp-turn", actualModel: "temporal-power-of-three" },
  { trap: "PO3 accumulation phase looks like consolidation — but it's distribution", correct: "bearish", lureModel: "temporal-power-of-three", actualModel: "mmxm-mmsm" },
  { trap: "Bullish FVG + OB confluence, but ADR shows range exhaustion", correct: "neutral", lureModel: "smc-confluence-2", actualModel: "smc-confluence-5" },
  { trap: "Silver Bullet NY AM triggered, but during Fed announcement blackout", correct: "neutral", lureModel: "temporal-silver-bullet-nyam", actualModel: "temporal-power-of-three" },
  { trap: "Weekly range expansion expected, but Monday/Tuesday already hit weekly ATR", correct: "neutral", lureModel: "classical-08", actualModel: "reversal-scob" },
];

for (let i = 0; i < 20; i++) {
  const at = adversarialTraps[i];
  const dir = at.correct as "BULLISH" | "BEARISH" | "NEUTRAL";
  const assets = i < 10 ? CRYPTO : FOREX;
  const events = [
    { type: "BOS" as const, timeframe: "15m" as const, direction: "bullish" as const },
    { type: "MSS" as const, timeframe: "15m" as const, direction: at.correct === "bearish" ? "bearish" as const : "bullish" as const },
  ];
  const sc = mkScenario(
    60 + i + 1, "adversarial", pick(assets), pick(["LONDON_OPEN", "NY_AM", "LATE"]),
    dir, events, ["fvg", "bos", "mss", "liquidity"],
    at.actualModel, [at.lureModel], pickN(ALL_MODEL_IDS.filter(m => m !== at.actualModel && m !== at.lureModel), 2),
    [],
    undefined, undefined,
  );
  sc.evaluationRubric.trapClaim = at.trap;
  sc.evaluationRubric.actualModel = at.actualModel;
  sc.evaluationRubric.lureModel = at.lureModel;
  writeFileSync(join(OUT, `${id(60 + i + 1)}.json`), JSON.stringify(sc, null, 2));
}

// ═══════════════════════════════════════════════════════════════════════════════
// 20 AMBIGUOUS SCENARIOS (n=81..100)
// The correct answer should acknowledge uncertainty
// ═══════════════════════════════════════════════════════════════════════════════

const ambiguousPatterns = [
  { desc: "Indecisive auction — price oscillating at equilibrium", concepts: ["consolidation", "equilibrium"], odds: "neutral" },
  { desc: "Partial FVG formed but barely touched — not clearly filled nor rejected", concepts: ["fvg", "bos"], odds: "neutral" },
  { desc: "Multiple small OBs with equal strength — no clear institutional level", concepts: ["ob", "liquidity"], odds: "neutral" },
  { desc: "Session overlap London/NY — conflicting signals on each timeframe", concepts: ["session", "bos", "mss"], odds: "neutral" },
  { desc: "Strong displacement occurs but on low volume — significance unclear", concepts: ["displacement", "fvg"], odds: "neutral" },
  { desc: "Price broke structure five bars ago — retest never came, continuation unclear", concepts: ["bos", "mss"], odds: "neutral" },
  { desc: "Inducement formed but market indecisive — IDM zone not yet swept", concepts: ["inducement", "bos"], odds: "neutral" },
  { desc: "Dealing range intact but price at extreme — no clear equilibrium bias", concepts: ["premium", "discount", "equilibrium"], odds: "neutral" },
  { desc: "CHoCH on 1m but 4h trend unchanged — conflicting timeframe signals", concepts: ["bos", "mss"], odds: "neutral" },
  { desc: "News in 30 minutes — current structure may be noise or positioning", concepts: ["liquidity", "session"], odds: "neutral" },
  { desc: "BOS formed but candle body is small — displacement not convincing", concepts: ["bos", "displacement"], odds: "neutral" },
  { desc: "FVG exists but price already 60% filled — uncertain if full fill occurs", concepts: ["fvg"], odds: "neutral" },
  { desc: "OTEs on both sides within same dealing range — no directional edge", concepts: ["ote", "premium", "discount"], odds: "neutral" },
  { desc: "Series of equal highs and equal lows — no breakout direction established", concepts: ["consolidation", "liquidity", "bos"], odds: "neutral" },
  { desc: "Two correlated assets diverging but both making new highs — SMT ambiguous", concepts: ["smt", "bos", "mss"], odds: "neutral" },
  { desc: "Order block identified but proximal/distal zone unusually wide", concepts: ["ob", "fvg"], odds: "neutral" },
  { desc: "Weekly open near Friday's close — gap context makes direction uncertain", concepts: ["liquidity", "session", "bos"], odds: "neutral" },
  { desc: "MSS triggered but immediately retraced 80% — shift may have failed", concepts: ["bos", "mss", "liquidity"], odds: "neutral" },
  { desc: "Multiple inducement zones without clear hierarchy — which IDM is significant?", concepts: ["inducement", "fvg", "bos"], odds: "neutral" },
  { desc: "Dealing range contracting — breakout imminent but direction unknown", concepts: ["consolidation", "liquidity"], odds: "neutral" },
];

for (let i = 0; i < 20; i++) {
  const ap = ambiguousPatterns[i];
  const assets = i < 10 ? CRYPTO : FOREX;
  const events = [
    { type: "BOS" as const, timeframe: "15m" as const, direction: "bullish" as const },
    { type: "MSS" as const, timeframe: "15m" as const, direction: "bearish" as const },
  ];
  const ambiguousModels = pickN(EXECUTION_MODELS, 3);
  const allRejected = ALL_MODEL_IDS.filter(m => !ambiguousModels.includes(m));
  const sc = mkScenario(
    80 + i + 1, "ambiguous", pick(assets), pick(["ASIAN", "LONDON_OPEN", "NY_AM"]),
    "RANGE", events, ap.concepts,
    ambiguousModels[0], ambiguousModels.slice(1), pickN(allRejected, 3),
    [{ higherTf: "4h", lowerTf: "1h", alignment: "NEUTRAL" }, { higherTf: "1h", lowerTf: "15m", alignment: "NEUTRAL" }],
    undefined, undefined,
  );
  sc.evaluationRubric.ambiguousContext = ap.desc;
  sc.evaluationRubric.expectedResponse = "ACKNOWLEDGE_UNCERTAINTY";
  writeFileSync(join(OUT, `${id(80 + i + 1)}.json`), JSON.stringify(sc, null, 2));
}

console.log(`✅ Generated 100 scenarios to ${OUT}`);
console.log(`   Clear: 1-20, FalsePositive: 21-40, Conflict: 41-60, Adversarial: 61-80, Ambiguous: 81-100`);
