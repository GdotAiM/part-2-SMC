/**
 * Market Store — the central state hub for the Session Cockpit.
 *
 * This is NOT a replacement for React Query. Server state (reports, symbols)
 * stays in TanStack Query. This store manages:
 *
 * - Narrative stage (derived from report data)
 * - Live stream events (for the timeline)
 * - UI state (which panels are open)
 * - Market context (active symbol, timeframes)
 * - System health (composite from multiple endpoints)
 */

import { create } from "zustand";
import type { SmcReport } from "@workspace/api-client-react";
import type { LiveTfData, StreamEvent } from "@/lib/realtime";
import type { StrategyDetectionResult } from "@/lib/api";
import {
  deriveNarrativeStage,
  detectSession,
  deriveMarketPhase,
  type NarrativeStage,
  type SessionInfo,
  type MarketPhase,
} from "./narrative";
import type { TraderProfile } from "./profile-store";
import { useProfileStore } from "./profile-store";

// ── Types ────────────────────────────────────────────────────────────────────

export interface SystemHealth {
  apiServer: { status: "healthy" | "degraded"; uptime: number };
  mcpServer: { status: "healthy" | "degraded" | "unknown"; toolCount: number };
  tradingView: { connected: boolean };
  database: { status: "healthy" | "degraded" | "unknown" };
  broker: { name: string; mode: "REVIEW" | "LIVE"; ready: boolean };
  llm: { provider: string; status: "healthy" | "degraded" };
}

export interface StageInfo {
  stage: NarrativeStage;
  reasoning: string;
  matchedModelId: string | null;
  phase: MarketPhase;
  session: SessionInfo;
  qualityScore: number | null;
}

export interface TimelineEntry {
  id: string;
  timestamp: number;
  type: "session_open" | "liquidity_sweep" | "structure_break" | "fvg_formed" | "displacement" |
        "mss_confirmed" | "entry_ready" | "signal_generated" | "trade_opened" | "trade_closed" |
        "alert" | "system";
  title: string;
  description: string;
  symbol: string;
  timeframe?: string;
  price?: number;
  actionable: boolean;
  actionLabel?: string;
  actionFn?: () => void;
}

export interface MarketState {
  // ── Market context ──
  symbol: string;
  marketType: "crypto" | "forex";
  timeframes: string[];

  // ── Reports (per-TF from React Query, mirrored for derivation) ──
  reports: Record<string, SmcReport | null>;

  // ── Live data stream ──
  liveData: Record<string, LiveTfData>;
  streamConnected: boolean;

  // ── Timeline events ──
  timeline: TimelineEntry[];

  // ── Strategy detection ──
  strategyPrimary: StrategyDetectionResult | null;
  strategyAlternatives: StrategyDetectionResult[];
  strategyNarrative: string | null;
  strategyReasoning: { reasoning: string; confidenceScore: number } | null;

  // ── System health ──
  system: SystemHealth;

  // ── Trade state ──
  inTrade: boolean;
  currentEntryPrice: number | null;
  currentStopLoss: number | null;
  currentTargets: number[];

  // ── UI state ──
  decisionFunnelOpen: boolean;
  evidencePanelOpen: boolean;
  evidenceTargetId: string | null;
  capabilityExplorerOpen: boolean;
  agentChatOpen: boolean;
  chartOpen: boolean;
  timelineFilter: string | null;
  selectedTf: string | null;    // null = show all, otherwise filter to this TF

  // ── Derived (computed when store updates) ──
  stageInfo: StageInfo;
}

// ── Actions ──────────────────────────────────────────────────────────────────

export interface MarketActions {
  setSymbol: (symbol: string, marketType: "crypto" | "forex") => void;
  setTimeframes: (tfs: string[]) => void;
  setReports: (reports: Record<string, SmcReport | null>) => void;
  setLiveData: (data: Record<string, LiveTfData>) => void;
  setStreamConnected: (connected: boolean) => void;
  pushTimelineEvent: (event: Omit<TimelineEntry, "id" | "timestamp">) => void;
  setStrategies: (
    primary: StrategyDetectionResult | null,
    alternatives: StrategyDetectionResult[],
    narrative?: string,
    reasoning?: { reasoning: string; confidenceScore: number },
  ) => void;
  setSystemHealth: (health: Partial<SystemHealth>) => void;
  setInTrade: (inTrade: boolean) => void;
  setTradeLevels: (entry: number | null, stop: number | null, targets: number[]) => void;
  toggleDecisionFunnel: () => void;
  openEvidence: (targetId: string) => void;
  closeEvidence: () => void;
  toggleCapabilityExplorer: () => void;
  toggleAgentChat: () => void;
  toggleChart: () => void;
  setTimelineFilter: (filter: string | null) => void;
  setSelectedTf: (tf: string | null) => void;
  recomputeStage: (profile: TraderProfile) => void;
}

// ── Helper: compute quality score ────────────────────────────────────────────

function computeQualityScore(reports: Record<string, SmcReport | null>, stage: NarrativeStage): number | null {
  if (stage === "WATCHING" || stage === "NO_TRADE") return null;

  const anchorTf = Object.keys(reports).sort(
    (a, b) => ({ "1w": 7, "1d": 6, "4h": 5, "1h": 4, "15m": 3, "5m": 2, "1m": 1 }[b] ?? 0) -
                ({ "1w": 7, "1d": 6, "4h": 5, "1h": 4, "15m": 3, "5m": 2, "1m": 1 }[a] ?? 0),
  )[0];

  const report = anchorTf ? reports[anchorTf] : null;
  if (!report) return null;

  return Math.round(((report.structure.confidence + report.dailyBias.strength) / 2) * 100);
}

// ── Helper: compute stage info ────────────────────────────────────────────────

function computeStageInfo(
  reports: Record<string, SmcReport | null>,
  liveData: Record<string, LiveTfData>,
  inTrade: boolean,
  profile: TraderProfile,
): StageInfo {
  const { stage, reasoning, matchedModelId } = deriveNarrativeStage({
    reports,
    liveData,
    hasPosition: inTrade,
    activeModels: profile.models.filter((m) => m.enabled).map((m) => m.id),
  });

  const anchorTf = Object.keys(reports).sort(
    (a, b) => ({ "1w": 7, "1d": 6, "4h": 5, "1h": 4, "15m": 3, "5m": 2, "1m": 1 }[b] ?? 0) -
                ({ "1w": 7, "1d": 6, "4h": 5, "1h": 4, "15m": 3, "5m": 2, "1m": 1 }[a] ?? 0),
  )[0];

  const anchorReport = anchorTf ? reports[anchorTf] : null;

  return {
    stage,
    reasoning,
    matchedModelId,
    phase: deriveMarketPhase(anchorReport),
    session: detectSession(),
    qualityScore: computeQualityScore(reports, stage),
  };
}

// ── Initial state ────────────────────────────────────────────────────────────

function initialStageInfo(): StageInfo {
  const s = detectSession();
  return {
    stage: "WATCHING",
    reasoning: "Select a market to begin analysis.",
    matchedModelId: null,
    phase: null,
    session: s,
    qualityScore: null,
  };
}

const initialState: MarketState = {
  symbol: "BTCUSDT",
  marketType: "crypto",
  timeframes: ["1m", "5m", "15m", "1h", "4h", "1d", "1w"],
  reports: {},
  liveData: {},
  streamConnected: false,
  timeline: [],
  strategyPrimary: null,
  strategyAlternatives: [],
  strategyNarrative: null,
  strategyReasoning: null,
  system: {
    apiServer: { status: "healthy", uptime: 0 },
    mcpServer: { status: "unknown", toolCount: 0 },
    tradingView: { connected: false },
    database: { status: "unknown" },
    broker: { name: "Mock Broker", mode: "REVIEW", ready: false },
    llm: { provider: "custom", status: "healthy" },
  },
  inTrade: false,
  currentEntryPrice: null,
  currentStopLoss: null,
  currentTargets: [],
  decisionFunnelOpen: false,
  evidencePanelOpen: false,
  evidenceTargetId: null,
  capabilityExplorerOpen: false,
  agentChatOpen: false,
  chartOpen: false,
  timelineFilter: null,
  selectedTf: null,
  stageInfo: initialStageInfo(),
};

// ── Store ────────────────────────────────────────────────────────────────────

let eventCounter = 0;

export const useMarketStore = create<MarketState & MarketActions>()((set, get) => ({
  ...initialState,

  setSymbol: (symbol, marketType) =>
    set({ symbol, marketType, reports: {}, timeline: [], strategyPrimary: null }),

  setTimeframes: (timeframes) => set({ timeframes }),

  setReports: (reports) => {
    set({ reports });
    // Recompute stage on report change — use the REAL profile from profile store
    const state = get();
    const profile = useProfileStore.getState().profile;
    const stageInfo = computeStageInfo(reports, state.liveData, state.inTrade, profile);
    set({ stageInfo });
  },

  setLiveData: (liveData) => set({ liveData }),

  setStreamConnected: (connected) => {
    if (connected && !get().streamConnected) {
      const entry: TimelineEntry = {
        id: `evt-${++eventCounter}`,
        timestamp: Date.now(),
        type: "session_open",
        title: "Stream connected",
        description: `Real-time data active for ${get().symbol}`,
        symbol: get().symbol,
        actionable: false,
      };
      set((s) => ({ streamConnected: connected, timeline: [entry, ...s.timeline].slice(0, 100) }));
    } else {
      set({ streamConnected: connected });
    }
  },

  pushTimelineEvent: (event) => {
    const entry: TimelineEntry = {
      id: `evt-${++eventCounter}`,
      timestamp: Date.now(),
      ...event,
    };
    set((s) => ({ timeline: [entry, ...s.timeline].slice(0, 100) }));
  },

  setStrategies: (primary, alternatives, narrative, reasoning) =>
    set({ strategyPrimary: primary, strategyAlternatives: alternatives, strategyNarrative: narrative ?? null, strategyReasoning: reasoning ?? null }),

  setSystemHealth: (health) =>
    set((s) => ({ system: { ...s.system, ...health } })),

  setInTrade: (inTrade) => {
    set({ inTrade });
    const state = get();
    const stageInfo = computeStageInfo(state.reports, state.liveData, inTrade, {
      models: [],
      sessions: [],
      risk: { minRR: 2, maxDailyTrades: 3, positionSizePercent: 0.5, maxDrawdownPercent: 5 },
      preferredTimeframes: state.timeframes,
      watchlist: [],
      theme: "dark",
      showBriefing: true,
      stageAutoAdvance: true,
    });
    set({ stageInfo });
  },

  setTradeLevels: (entry, stop, targets) =>
    set({ currentEntryPrice: entry, currentStopLoss: stop, currentTargets: targets }),

  toggleDecisionFunnel: () =>
    set((s) => ({ decisionFunnelOpen: !s.decisionFunnelOpen })),

  openEvidence: (targetId) =>
    set({ evidencePanelOpen: true, evidenceTargetId: targetId }),

  closeEvidence: () =>
    set({ evidencePanelOpen: false, evidenceTargetId: null }),

  toggleCapabilityExplorer: () =>
    set((s) => ({ capabilityExplorerOpen: !s.capabilityExplorerOpen })),

  toggleAgentChat: () =>
    set((s) => ({ agentChatOpen: !s.agentChatOpen })),

  toggleChart: () =>
    set((s) => ({ chartOpen: !s.chartOpen })),

  setTimelineFilter: (filter) =>
    set({ timelineFilter: filter }),

  setSelectedTf: (tf) => set({ selectedTf: tf }),

  recomputeStage: (profile) => {
    const state = get();
    const stageInfo = computeStageInfo(state.reports, state.liveData, state.inTrade, profile);
    set({ stageInfo });
  },
}));
