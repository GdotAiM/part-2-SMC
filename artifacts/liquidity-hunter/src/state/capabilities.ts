/**
 * Capability Registry — all 53 system capabilities organized by
 * ICT trader workflow stage (Narrative → Liquidity → Time → Structure
 * → Displacement → Entry → Risk → Review) and action type (Scan → Analyse → Act).
 *
 * This is a static file — no API call needed. It enables the CapabilityExplorer
 * to show everything the system can do, filtered by current narrative stage.
 */

import type { NarrativeStage } from "./narrative";

export type CapAction = "SCAN" | "ANALYSE" | "ACT";
export type CapCategory =
  | "NARRATIVE"
  | "LIQUIDITY"
  | "TIME"
  | "STRUCTURE"
  | "DISPLACEMENT"
  | "ENTRY"
  | "RISK"
  | "REVIEW";

export interface CapabilityDef {
  id: string;
  name: string;
  description: string;
  category: CapCategory;
  action: CapAction;
  stages: NarrativeStage[];
  endpoint?: string;
  requiresTv?: boolean;
  requiresDb?: boolean;
  icon: string;
  uiCoverage: boolean;        // exposed in the cockpit UI?
}

const ALL_STAGES: NarrativeStage[] = [
  "WATCHING", "SCANNING", "LIQUIDITY_SWEPT", "DISPLACEMENT",
  "MSS_FORMING", "FVG_FORMED", "ENTRY_READY", "IN_TRADE", "REVIEW",
];

const SCAN_STAGES: NarrativeStage[] = ["WATCHING", "SCANNING"];
const SETUP_STAGES: NarrativeStage[] = ["LIQUIDITY_SWEPT", "DISPLACEMENT", "MSS_FORMING", "FVG_FORMED"];
const ACTIVE_STAGES: NarrativeStage[] = ["ENTRY_READY", "IN_TRADE"];
const POST_STAGES: NarrativeStage[] = ["REVIEW"];

// Coverage key: true = exposed in cockpit stage views, decision funnel, or topbar
// false = backend endpoint exists but no UI path in the session cockpit yet

export const CAPABILITIES: CapabilityDef[] = [
  // ── NARRATIVE ──────────────────────────────────────────────────────────────
  { id: "watch-market", name: "Watch Market", description: "Select a symbol and observe price action in real-time.", category: "NARRATIVE", action: "SCAN", stages: SCAN_STAGES, icon: "👁", uiCoverage: true },
  { id: "session-context", name: "Session Context", description: "View current trading session and market phase.", category: "NARRATIVE", action: "SCAN", stages: SCAN_STAGES, icon: "🕐", uiCoverage: true },
  { id: "htf-bias", name: "HTF Bias Detection", description: "Determine directional bias from higher timeframe.", category: "NARRATIVE", action: "ANALYSE", stages: ALL_STAGES, endpoint: "/api/analysis/crypto", icon: "📐", uiCoverage: true },
  { id: "daily-bias", name: "Daily Bias", description: "Consecutive daily bias direction and strength.", category: "NARRATIVE", action: "ANALYSE", stages: ALL_STAGES, icon: "📅", uiCoverage: true },
  { id: "market-phase", name: "Market Phase", description: "Identify accumulation, manipulation, or distribution phase.", category: "NARRATIVE", action: "ANALYSE", stages: SCAN_STAGES, icon: "🔄", uiCoverage: true },
  { id: "ai-briefing", name: "AI Market Briefing", description: "Generate an AI narrative of current market conditions.", category: "NARRATIVE", action: "ACT", stages: ALL_STAGES, endpoint: "/api/agents/ask", icon: "🤖", uiCoverage: true },
  { id: "multi-tf-cascade", name: "7-TF Cascade", description: "Run full 7-timeframe structural analysis.", category: "NARRATIVE", action: "ACT", stages: ALL_STAGES, endpoint: "/api/strategies/detect", icon: "📊", uiCoverage: true },

  // ── LIQUIDITY ──────────────────────────────────────────────────────────────
  { id: "scan-pools", name: "Scan Liquidity Pools", description: "Identify all BSL, SSL, EQH, EQL liquidity pools.", category: "LIQUIDITY", action: "SCAN", stages: SCAN_STAGES, icon: "🎯", uiCoverage: true },
  { id: "nearest-pool", name: "Nearest Pool", description: "Show the closest untapped liquidity pool with sweep probability.", category: "LIQUIDITY", action: "SCAN", stages: ALL_STAGES, icon: "📍", uiCoverage: true },
  { id: "pool-sweep", name: "Pool Sweep Detection", description: "Detect when a liquidity pool was swept and at what price.", category: "LIQUIDITY", action: "ANALYSE", stages: SETUP_STAGES, icon: "⚡", uiCoverage: true },
  { id: "sweep-probability", name: "Sweep Probability", description: "Calculate the probability of each pool being swept.", category: "LIQUIDITY", action: "ANALYSE", stages: SCAN_STAGES, icon: "📈", uiCoverage: true },
  { id: "draw-levels-tv", name: "Draw Levels on TV", description: "Draw BSL, SSL, and key levels on TradingView chart.", category: "LIQUIDITY", action: "ACT", stages: SETUP_STAGES, endpoint: "/api/agent-loop/tv-draw", requiresTv: true, icon: "✏️", uiCoverage: true },
  { id: "compare-luxalgo", name: "Compare with LuxAlgo", description: "Read LuxAlgo indicator levels and compare with SMC engine.", category: "LIQUIDITY", action: "ACT", stages: SETUP_STAGES, endpoint: "/api/read-tv-indicator-levels", requiresTv: true, icon: "⚖️", uiCoverage: false },
  { id: "similar-setups", name: "Find Similar Setups", description: "Vector search for similar past setups via Qdrant.", category: "LIQUIDITY", action: "ACT", stages: SETUP_STAGES, endpoint: "/api/agent-loop/similar-setups", requiresDb: true, icon: "🔍", uiCoverage: false },

  // ── TIME ───────────────────────────────────────────────────────────────────
  { id: "session-clock", name: "Session Clock", description: "Countdown timer for the current trading session.", category: "TIME", action: "SCAN", stages: ALL_STAGES, icon: "⏱", uiCoverage: true },
  { id: "killzone-alert", name: "Killzone Alert", description: "Alert when price enters a session killzone window.", category: "TIME", action: "ANALYSE", stages: SCAN_STAGES, icon: "🔔", uiCoverage: false },
  { id: "silver-bullet", name: "Silver Bullet Timer", description: "Track the next Silver Bullet window (NY AM, London, NY PM).", category: "TIME", action: "ANALYSE", stages: SCAN_STAGES, icon: "🔫", uiCoverage: false },
  { id: "economic-calendar", name: "Economic Calendar", description: "Refresh and view high-impact economic events.", category: "TIME", action: "SCAN", stages: ALL_STAGES, endpoint: "/api/external-intel/refresh", icon: "📅", uiCoverage: true },
  { id: "set-alert-tv", name: "Set Alert on TV", description: "Create a price alert on TradingView chart.", category: "TIME", action: "ACT", stages: SETUP_STAGES, requiresTv: true, icon: "🔔", uiCoverage: false },

  // ── STRUCTURE ──────────────────────────────────────────────────────────────
  { id: "scan-structure", name: "Market Structure Scan", description: "Map swing highs/lows, trends, and bias.", category: "STRUCTURE", action: "SCAN", stages: SCAN_STAGES, icon: "📉", uiCoverage: true },
  { id: "bos-detection", name: "Break of Structure", description: "Detect BOS and CHoCH break events.", category: "STRUCTURE", action: "ANALYSE", stages: SETUP_STAGES, icon: "💥", uiCoverage: true },
  { id: "pivot-analysis", name: "Pivot Analysis", description: "View confirmed swing points (HH, HL, LH, LL).", category: "STRUCTURE", action: "ANALYSE", stages: ALL_STAGES, icon: "📌", uiCoverage: true },
  { id: "order-blocks", name: "Order Block Detection", description: "Identify bullish/bearish order blocks with confidence scores.", category: "STRUCTURE", action: "ANALYSE", stages: SETUP_STAGES, icon: "🧱", uiCoverage: true },
  { id: "breaker-blocks", name: "Breaker Block Detection", description: "Identify Breaker formations (failed OBs).", category: "STRUCTURE", action: "ANALYSE", stages: SETUP_STAGES, icon: "🔨", uiCoverage: false },
  { id: "mark-bos-tv", name: "Mark BOS on Chart", description: "Draw BOS/CHoCH lines on TradingView.", category: "STRUCTURE", action: "ACT", stages: SETUP_STAGES, endpoint: "/api/agent-loop/tv-draw", requiresTv: true, icon: "📏", uiCoverage: false },

  // ── DISPLACEMENT ───────────────────────────────────────────────────────────
  { id: "fvg-scan", name: "FVG Scan", description: "Scan all Fair Value Gaps across timeframes.", category: "DISPLACEMENT", action: "SCAN", stages: SETUP_STAGES, icon: "🕳", uiCoverage: true },
  { id: "fvg-detail", name: "FVG Detail", description: "View fill fraction, inversion status, and gap size.", category: "DISPLACEMENT", action: "ANALYSE", stages: SETUP_STAGES, icon: "📐", uiCoverage: true },
  { id: "displacement-measure", name: "Displacement Measurement", description: "Measure displacement strength vs average range.", category: "DISPLACEMENT", action: "ANALYSE", stages: SETUP_STAGES, icon: "📏", uiCoverage: false },
  { id: "smt-divergence", name: "SMT Divergence", description: "Detect divergence between correlated symbols.", category: "DISPLACEMENT", action: "ANALYSE", stages: SETUP_STAGES, endpoint: "/api/analysis/crypto", icon: "🔄", uiCoverage: true },
  { id: "pd-array", name: "PD Array", description: "View premium/discount zones and equilibrium.", category: "DISPLACEMENT", action: "ANALYSE", stages: SETUP_STAGES, icon: "📊", uiCoverage: true },
  { id: "range-expansion", name: "Range Expansion", description: "Measure candle expansion vs average range.", category: "DISPLACEMENT", action: "ANALYSE", stages: SETUP_STAGES, icon: "📈", uiCoverage: false },

  // ── ENTRY ──────────────────────────────────────────────────────────────────
  { id: "detect-models", name: "Detect Strategy Models", description: "Run all 59 strategy models against current data.", category: "ENTRY", action: "SCAN", stages: SETUP_STAGES, endpoint: "/api/strategies/detect", icon: "🧠", uiCoverage: true },
  { id: "model-spec", name: "Model Specification", description: "View full prerequisites, invalidation, and temporal rules.", category: "ENTRY", action: "ANALYSE", stages: SETUP_STAGES, endpoint: "/api/strategies", icon: "📋", uiCoverage: true },
  { id: "alternative-models", name: "Alternative Models", description: "View runner-up strategy candidates.", category: "ENTRY", action: "ANALYSE", stages: SETUP_STAGES, icon: "🔄", uiCoverage: true },
  { id: "ote-zone", name: "OTE Zone Calculator", description: "Calculate Optimal Trade Entry zone (62-79% retracement).", category: "ENTRY", action: "ANALYSE", stages: SETUP_STAGES, icon: "🎯", uiCoverage: false },
  { id: "setup-checklist", name: "Setup Quality Checklist", description: "Check all prerequisites against your active model.", category: "ENTRY", action: "ANALYSE", stages: SETUP_STAGES, icon: "✅", uiCoverage: true },
  { id: "generate-signal", name: "Generate Signal", description: "Generate a structured trade signal from current analysis.", category: "ENTRY", action: "ACT", stages: ["ENTRY_READY"], endpoint: "/api/signals/generate", icon: "📡", uiCoverage: true },
  { id: "execute-trade", name: "Execute Trade", description: "Send signal to broker for execution (REVIEW or LIVE).", category: "ENTRY", action: "ACT", stages: ["ENTRY_READY"], endpoint: "/api/signals/execute", icon: "⚡", uiCoverage: true },
  { id: "send-to-tv", name: "Send Levels to TV", description: "Draw entry, SL, and TP levels on TradingView.", category: "ENTRY", action: "ACT", stages: ["ENTRY_READY"], endpoint: "/api/agent-loop/tv-draw", requiresTv: true, icon: "📤", uiCoverage: true },
  { id: "agent-pipeline", name: "Run Agent Pipeline", description: "Run 4-agent analysis pipeline for deeper confirmation.", category: "ENTRY", action: "ACT", stages: SETUP_STAGES, endpoint: "/api/agents/pipeline", icon: "🤖", uiCoverage: true },
  { id: "ask-agent", name: "Ask Pulse Agent", description: "Ask the AI agent questions about the current setup.", category: "ENTRY", action: "ACT", stages: ALL_STAGES, endpoint: "/api/agents/ask-mcp", icon: "💬", uiCoverage: true },

  // ── RISK ───────────────────────────────────────────────────────────────────
  { id: "risk-calculator", name: "Risk Calculator", description: "Calculate position size based on account risk % and SL distance.", category: "RISK", action: "ANALYSE", stages: ACTIVE_STAGES, icon: "🛡", uiCoverage: false },
  { id: "broker-status", name: "Broker Status", description: "View broker connection, mode, and account equity.", category: "RISK", action: "SCAN", stages: ALL_STAGES, endpoint: "/api/broker/status", icon: "🏦", uiCoverage: true },
  { id: "account-detail", name: "Account Detail", description: "View account balance, buying power, and open positions.", category: "RISK", action: "ANALYSE", stages: ACTIVE_STAGES, endpoint: "/api/account", icon: "💰", uiCoverage: false },
  { id: "daily-llmit", name: "Daily Trade Limit", description: "Track trades taken vs daily max limit.", category: "RISK", action: "SCAN", stages: ALL_STAGES, icon: "📊", uiCoverage: false },
  { id: "backtest", name: "Backtest Strategy", description: "Run sliding-window backtest on current symbol.", category: "RISK", action: "ACT", stages: POST_STAGES, endpoint: "/api/backtest/run", requiresDb: true, icon: "📈", uiCoverage: true },

  // ── REVIEW ─────────────────────────────────────────────────────────────────
  { id: "trade-ledger", name: "Trade Ledger", description: "View all signals with outcomes, R:R, and timestamps.", category: "REVIEW", action: "SCAN", stages: POST_STAGES, endpoint: "/api/ledger", icon: "📒", uiCoverage: true },
  { id: "performance-matrix", name: "Performance Matrix", description: "Multi-dimensional performance breakdown by setup/symbol/session.", category: "REVIEW", action: "ANALYSE", stages: POST_STAGES, endpoint: "/api/performance-matrix", icon: "🏆", uiCoverage: true },
  { id: "truth-engine", name: "Truth Engine", description: "Compare SMC engine vs TradingView detection accuracy.", category: "REVIEW", action: "ANALYSE", stages: POST_STAGES, endpoint: "/api/learning/dashboard", icon: "🔬", uiCoverage: true },
  { id: "post-trade-timeline", name: "Trade Timeline", description: "Full narrative reconstruction of how the trade unfolded.", category: "REVIEW", action: "ANALYSE", stages: ["REVIEW"], endpoint: "/api/agent-loop/runs/:id", icon: "📜", uiCoverage: true },
  { id: "model-alignment", name: "Model Alignment Score", description: "Score how well the trade matched the detected model.", category: "REVIEW", action: "ANALYSE", stages: ["REVIEW"], endpoint: "/api/smc-eval/score", icon: "🎯", uiCoverage: true },
  { id: "journal-entry", name: "Journal Entry", description: "Save observations to semantic memory for future learning.", category: "REVIEW", action: "ACT", stages: POST_STAGES, endpoint: "/api/agent-loop/memory", icon: "📝", uiCoverage: true },
  { id: "smc-eval-benchmark", name: "SMC-EVAL Benchmark", description: "Run the full SMC-EVAL benchmark (100 scenarios).", category: "REVIEW", action: "ACT", stages: ["WATCHING", "REVIEW"], endpoint: "/api/smc-eval/evaluate", icon: "🧪", uiCoverage: true },
  { id: "learn-view", name: "Learning Dashboard", description: "View reliability scores, derived metrics, and suggestions.", category: "REVIEW", action: "ANALYSE", stages: POST_STAGES, endpoint: "/api/learning/dashboard", icon: "📚", uiCoverage: true },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

export function getCapabilitiesForStage(stage: NarrativeStage): CapabilityDef[] {
  return CAPABILITIES.filter((c) => c.stages.includes(stage));
}

export function getCapabilitiesByCategory(
  stage: NarrativeStage,
  action?: CapAction,
): Record<CapCategory, CapabilityDef[]> {
  const grouped: Record<string, CapabilityDef[]> = {};
  for (const cap of CAPABILITIES) {
    if (!cap.stages.includes(stage)) continue;
    if (action && cap.action !== action) continue;
    if (!grouped[cap.category]) grouped[cap.category] = [];
    grouped[cap.category].push(cap);
  }
  return grouped as Record<CapCategory, CapabilityDef[]>;
}

export function searchCapabilities(query: string): CapabilityDef[] {
  const q = query.toLowerCase();
  return CAPABILITIES.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q) ||
      c.category.toLowerCase().includes(q),
  );
}

export function countCapabilities(): { total: number; forStage: (s: NarrativeStage) => number } {
  return {
    total: CAPABILITIES.length,
    forStage: (s: NarrativeStage) => getCapabilitiesForStage(s).length,
  };
}

export function getUiCoveragePercent(): number {
  const covered = CAPABILITIES.filter((c) => c.uiCoverage).length;
  return Math.round((covered / CAPABILITIES.length) * 100);
}
