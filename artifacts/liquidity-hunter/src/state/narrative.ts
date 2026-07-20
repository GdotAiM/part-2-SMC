/**
 * Narrative Stage — the core state machine for progressive disclosure.
 *
 * The stage is derived entirely from SMC report data + stream state.
 * No API calls. No side effects. Pure function.
 */

import type { SmcReport } from "@workspace/api-client-react";
import type { LiveTfData } from "@/lib/realtime";

// ── The 10 narrative stages ──────────────────────────────────────────────────

export type NarrativeStage =
  | "WATCHING"        // No symbol selected, or idle
  | "SCANNING"        // Session active, no liquidity event yet
  | "LIQUIDITY_SWEPT" // A pool was swept — attention needed
  | "DISPLACEMENT"    // Displacement detected — structure confirming
  | "MSS_FORMING"     // Market structure shift in progress
  | "FVG_FORMED"      // Entry-level imbalance formed
  | "ENTRY_READY"     // Model prerequisites met — actionable
  | "IN_TRADE"        // Position open
  | "REVIEW"          // Post-trade analysis
  | "NO_TRADE";       // System rule: don't trade

export const STAGE_LABELS: Record<NarrativeStage, string> = {
  WATCHING: "Watching",
  SCANNING: "Scanning",
  LIQUIDITY_SWEPT: "Liquidity Swept",
  DISPLACEMENT: "Displacement",
  MSS_FORMING: "Structure Shift",
  FVG_FORMED: "FVG Formed",
  ENTRY_READY: "Entry Ready",
  IN_TRADE: "In Trade",
  REVIEW: "Review",
  NO_TRADE: "No Trade",
};

export const STAGE_DESCRIPTIONS: Record<NarrativeStage, string> = {
  WATCHING: "Select a market to begin analysis.",
  SCANNING: "Session active. Waiting for a liquidity event.",
  LIQUIDITY_SWEPT: "Liquidity taken. Evaluating structural response.",
  DISPLACEMENT: "Displacement detected. Structure shift in progress.",
  MSS_FORMING: "Market structure shift developing.",
  FVG_FORMED: "Entry-level imbalance identified.",
  ENTRY_READY: "Setup conditions met. Action required.",
  IN_TRADE: "Position is open. Monitoring risk.",
  REVIEW: "Trade closed. Reconstructing the evidence chain.",
  NO_TRADE: "Conditions not met for your active models.",
};

export const STAGE_ORDER: NarrativeStage[] = [
  "WATCHING",
  "SCANNING",
  "LIQUIDITY_SWEPT",
  "DISPLACEMENT",
  "MSS_FORMING",
  "FVG_FORMED",
  "ENTRY_READY",
  "IN_TRADE",
  "REVIEW",
  "NO_TRADE",
];

// ── Market structure phase ───────────────────────────────────────────────────

export type MarketPhase =
  | "ACCUMULATION"
  | "MANIPULATION"
  | "DISTRIBUTION"
  | "CONTINUATION"
  | null;

export const PHASE_LABELS: Record<string, string> = {
  accumulation: "Accumulation",
  manipulation: "Manipulation",
  distribution: "Distribution",
  continuation: "Continuation",
};

// ── Session detection ────────────────────────────────────────────────────────

export type SessionName = "ASIAN" | "LONDON" | "NY_AM" | "NY_PM" | "LATE";

export const SESSION_LABELS: Record<SessionName, string> = {
  ASIAN: "Asian Session",
  LONDON: "London Open",
  NY_AM: "NY AM",
  NY_PM: "NY PM",
  LATE: "Late / Transition",
};

export interface SessionInfo {
  name: SessionName;
  label: string;
  utcStart: number;
  utcEnd: number;
  timeRemaining: number; // ms
  isActive: boolean;
}

export function detectSession(): SessionInfo {
  const now = new Date();
  const utcHour = now.getUTCHours();
  const utcMin = now.getUTCMinutes();
  const totalMin = utcHour * 60 + utcMin;

  const sessions: Array<{ name: SessionName; start: number; end: number }> = [
    { name: "ASIAN", start: 0, end: 7 * 60 - 1 },
    { name: "LONDON", start: 7 * 60, end: 12 * 60 - 1 },
    { name: "NY_AM", start: 12 * 60, end: 15 * 60 - 1 },
    { name: "NY_PM", start: 15 * 60, end: 20 * 60 - 1 },
    { name: "LATE", start: 20 * 60, end: 24 * 60 - 1 },
  ];

  const current = sessions.find((s) => totalMin >= s.start && totalMin < s.end) ?? sessions[4];

  const remainingMs = (current.end - totalMin) * 60 * 1000;
  const nowMs = now.getTime();
  const startMs = nowMs - (totalMin - current.start) * 60 * 1000;
  const endMs = nowMs + (current.end - totalMin) * 60 * 1000;

  return {
    name: current.name,
    label: SESSION_LABELS[current.name],
    utcStart: startMs,
    utcEnd: endMs,
    timeRemaining: remainingMs,
    isActive: true,
  };
}

// ── Derive market phase from structure data ──────────────────────────────────

export function deriveMarketPhase(report: SmcReport | null): MarketPhase {
  if (!report) return null;
  const phase = report.structure.phase?.toLowerCase();
  if (!phase || phase === "neutral") return null;
  if (phase.includes("accumulation")) return "ACCUMULATION";
  if (phase.includes("manipulation")) return "MANIPULATION";
  if (phase.includes("distribution")) return "DISTRIBUTION";
  if (phase.includes("continuation") || phase.includes("expansion")) return "CONTINUATION";
  return null;
}

// ── Derive narrative stage ───────────────────────────────────────────────────

export interface NarrativeInput {
  reports: Record<string, SmcReport | null>;
  liveData: Record<string, LiveTfData>;
  hasPosition: boolean;
  activeModels: string[]; // IDs of models the user has enabled
}

/**
 * Derive the current narrative stage from market data.
 *
 * The logic follows: Session → Liquidity → Structure → Model → Trade → Review
 *
 * Returns both the stage and the reasoning for it.
 */
export function deriveNarrativeStage(input: NarrativeInput): {
  stage: NarrativeStage;
  reasoning: string;
  matchedModelId: string | null;
} {
  const { reports, liveData, hasPosition, activeModels } = input;

  // No data yet
  if (Object.keys(reports).length === 0 && Object.keys(liveData).length === 0) {
    return { stage: "WATCHING", reasoning: "Select a market to begin analysis.", matchedModelId: null };
  }

  // In a trade — always IN_TRADE
  if (hasPosition) {
    return { stage: "IN_TRADE", reasoning: "Position is open. Monitoring price action.", matchedModelId: null };
  }

  // Gather data from all available TFs
  const sortedTfs = Object.keys(reports)
    .filter((tf) => !!reports[tf])
    .sort((a, b) => (TF_WEIGHT[b] ?? 0) - (TF_WEIGHT[a] ?? 0));

  const anchorTf = sortedTfs[0]; // highest TF with data
  const entryTf = sortedTfs[sortedTfs.length - 1]; // lowest TF with data
  const anchorReport = anchorTf ? reports[anchorTf] : null;
  const entryReport = entryTf ? reports[entryTf] : null;

  // No report available yet
  if (!anchorReport) {
    return { stage: "SCANNING", reasoning: "Session active. Waiting for data.", matchedModelId: null };
  }

  // ── Cross-TF checks ─────────────────────────────────────────────────────
  // Check across ALL reports (not just anchor TF) for sweeps, displacement,
  // and structure breaks. This makes the derivation robust when different
  // events happen on different timeframes (e.g. sweep on 15m, CHoCH on 4h).
  const allReports = Object.values(reports).filter((r): r is SmcReport => r !== null);

  const hasSweep = allReports.some((r) =>
    r.liquidity.pools.some((p) => p.wasSwept),
  );

  // Displacement = unfilled FVGs with low fill fraction
  const hasDisplacement = allReports.some((r) =>
    r.fvg.some((f) => f.fillFraction < 0.3),
  );

  // MSS = structure breaks of type MSS or CHoCH
  const hasMss = allReports.some((r) =>
    r.structure.breaks.some((b) => b.type === "MSS" || b.type === "CHoCH"),
  );

  // Entry-level imbalance on the ENTRY timeframe specifically
  const hasUnmitigatedFvg = entryReport
    ? entryReport.fvg.some((f) => f.fillFraction < 0.3 && !f.isInversion)
    : false;

  // Check for NO TRADE conditions
  const phase = deriveMarketPhase(anchorReport);
  const session = detectSession();
  const sessionOk = session.name === "NY_AM" || session.name === "LONDON" || session.name === "NY_PM";

  // Progressive stage resolution
  if (hasSweep && hasDisplacement && hasMss && hasUnmitigatedFvg) {
    return {
      stage: "ENTRY_READY",
      reasoning: "All model prerequisites met. Entry zone active.",
      matchedModelId: anchorReport.draw[0]?.label ?? null,
    };
  }

  if (hasSweep && hasDisplacement && hasMss) {
    return {
      stage: "FVG_FORMED",
      reasoning: "Displacement and MSS confirmed. Waiting for entry-level imbalance.",
      matchedModelId: null,
    };
  }

  if (hasSweep && hasDisplacement) {
    return {
      stage: "MSS_FORMING",
      reasoning: "Displacement detected. Waiting for market structure shift confirmation.",
      matchedModelId: null,
    };
  }

  if (hasSweep) {
    return {
      stage: "DISPLACEMENT",
      reasoning: "Liquidity swept. Evaluating structural displacement.",
      matchedModelId: null,
    };
  }

  if (!sessionOk) {
    return {
      stage: "NO_TRADE",
      reasoning: `${session.label} — not a high-probability session window for your active models.`,
      matchedModelId: null,
    };
  }

  // Default scanning state
  const narrative = anchorReport.structure.narrative ||
    `${anchorReport.dailyBias.bias.toUpperCase()} bias on ${anchorReport.timeframe}. Key level identified.`;

  return {
    stage: "SCANNING",
    reasoning: narrative,
    matchedModelId: null,
  };
}

// ── Timeframe weight map ─────────────────────────────────────────────────────

const TF_WEIGHT: Record<string, number> = {
  "1m": 1, "5m": 2, "15m": 3, "1h": 4, "4h": 5, "1d": 6, "1w": 7,
};

// ── Session flow mapping ─────────────────────────────────────────────────────

export function getPhaseSequence(phase: MarketPhase): MarketPhase[] {
  const full: MarketPhase[] = ["ACCUMULATION", "MANIPULATION", "DISTRIBUTION"];
  if (!phase) return full;
  const idx = full.indexOf(phase);
  if (idx === -1) return full;
  return full;
}
