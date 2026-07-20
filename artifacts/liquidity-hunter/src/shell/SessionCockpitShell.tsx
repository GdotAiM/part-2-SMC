/**
 * SessionCockpitShell — the new primary interface.
 *
 * Three-column layout:
 *   Left:   LiveTimeline (260px)
 *   Center: Stage-dependent view (flex)
 *   Right:  DecisionFunnel (320px, slide-over)
 *
 * Overlays:
 *   - EvidencePanel (right slide-over)
 *   - CapabilityExplorer (⌘K modal)
 *   - ChartView (full-screen overlay)
 */

import { useEffect } from "react";
import { useMarketStore } from "@/state/market-store";
import { useProfileStore } from "@/state/profile-store";
import { useSessionCockpitData } from "@/hooks/useSessionCockpitData";
import { TopBar } from "./TopBar";
import { LiveTimeline } from "./LiveTimeline";
import { DecisionFunnel } from "@/panels/DecisionFunnel";
import { EvidencePanel } from "@/panels/EvidencePanel";
import { NoTradeView } from "@/stages/NoTradeView";
import { ScanningView } from "@/stages/ScanningView";
import { LiquiditySweptView } from "@/stages/LiquiditySweptView";
import { DisplacementView } from "@/stages/DisplacementView";
import { MssFormingView } from "@/stages/MssFormingView";
import { FvgFormedView } from "@/stages/FvgFormedView";
import { EntryView } from "@/stages/EntryView";
import { InTradeView } from "@/stages/InTradeView";
import { ReviewView } from "@/stages/ReviewView";
import { ChartView } from "@/components/ChartView";
import { AgentChat } from "@/components/AgentChat";
import { TvStatus } from "@/components/TvStatus";
import type { SmcReport } from "@workspace/api-client-react";
import { getUiCoveragePercent } from "@/state/capabilities";

function StateRouter() {
  const stage = useMarketStore((s) => s.stageInfo.stage);

  switch (stage) {
    case "WATCHING":
    case "NO_TRADE":
      return <NoTradeView />;

    case "SCANNING":
      return <ScanningView />;

    case "LIQUIDITY_SWEPT":
      return <LiquiditySweptView />;

    case "DISPLACEMENT":
      return <DisplacementView />;

    case "MSS_FORMING":
      return <MssFormingView />;

    case "FVG_FORMED":
      return <FvgFormedView />;

    case "ENTRY_READY":
      return <EntryView />;

    case "IN_TRADE":
      return <InTradeView />;

    case "REVIEW":
      return <ReviewView />;
  }
}

export function SessionCockpitShell() {
  const capabilityExplorerOpen = useMarketStore((s) => s.capabilityExplorerOpen);
  const toggleCapabilityExplorer = useMarketStore((s) => s.toggleCapabilityExplorer);
  const agentChatOpen = useMarketStore((s) => s.agentChatOpen);
  const toggleAgentChat = useMarketStore((s) => s.toggleAgentChat);
  const chartOpen = useMarketStore((s) => s.chartOpen);
  const toggleChart = useMarketStore((s) => s.toggleChart);
  const symbol = useMarketStore((s) => s.symbol);
  const reports = useMarketStore((s) => s.reports);
  const profile = useProfileStore((s) => s.profile);

  // ── Wire live market data into the store ──
  useSessionCockpitData();

  // ⌘K opens capability explorer
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        toggleCapabilityExplorer();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [toggleCapabilityExplorer]);

  // Build reports array for ChartView
  const confluenceReports = Object.entries(reports)
    .filter(([, r]) => r !== null)
    .map(([tf, report]) => ({ tf, report: report! }));

  return (
    <div className="min-h-screen bg-background text-foreground font-mono flex flex-col">
      {/* Top bar — always visible */}
      <TopBar />

      {/* Main content area — three columns */}
      <div className="flex flex-1 min-h-0">
        {/* Left: Timeline */}
        <LiveTimeline />

        {/* Center: Stage-dependent content */}
        <StateRouter />

        {/* Right: Decision Funnel */}
        <DecisionFunnel />
      </div>

      {/* Overlays */}
      <EvidencePanel />

      {/* Agent Chat Panel */}
      {agentChatOpen && (
        <div className="fixed right-0 top-0 bottom-0 w-[420px] z-40 border-l border-border/30 bg-card shadow-2xl flex flex-col">
          <div className="flex items-center justify-between px-4 py-2 border-b border-border/20 bg-muted/20">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">AI Agent Chat</span>
            <button onClick={toggleAgentChat} className="text-muted-foreground hover:text-foreground text-xs">✕</button>
          </div>
          <AgentChat report={(() => {
            const sorted = Object.entries(reports).filter(([,r]) => r !== null).sort(([a],[b]) =>
              ({ "1w":7,"1d":6,"4h":5,"1h":4,"15m":3,"5m":2,"1m":1 }[b]??0) - ({ "1w":7,"1d":6,"4h":5,"1h":4,"15m":3,"5m":2,"1m":1 }[a]??0)
            ) as [string, SmcReport][];
            const tf = useMarketStore.getState().selectedTf;
            const report = tf ? reports[tf] : sorted[0]?.[1];
            if (!report) {
              // Return a minimal placeholder report to satisfy the type
              return {
                symbol, market: "crypto" as const, timeframe: "1h", currentPrice: 0, generatedAt: Date.now(),
                candles: [], structure: { bias: "neutral" as const, trend: "neutral" as const, confidence: 0, pivots: [], breaks: [], phase: undefined, narrative: "", evidence: [] },
                liquidity: { pools: [] }, orderBlocks: [], fvg: [], pdArray: { currentBias: "equilibrium" as const, zones: [], dealingRange: { high: 0, low: 0, timeframe: "" }, equilibrium: 0 },
                dailyBias: { bias: "neutral" as const, strength: 0, consecutiveDays: 0 }, draw: [],
              } as unknown as SmcReport;
            }
            return report;
          })()} />
        </div>
      )}

      {/* Capability Explorer Modal */}
      {capabilityExplorerOpen && (
        <CapabilityExplorerModal onClose={() => useMarketStore.getState().toggleCapabilityExplorer()} />
      )}

      {/* Chart Overlay */}
      {chartOpen && confluenceReports.length > 0 && (
        <ChartView
          reports={confluenceReports}
          market={profile.watchlist.includes(symbol) ? "crypto" : "crypto"}
          initialTf="1h"
          onClose={toggleChart}
        />
      )}
    </div>
  );
}

/**
 * Minimal Capability Explorer modal — ⌘K replacement.
 * Full version will be built in a later phase.
 */
function CapabilityExplorerModal({ onClose }: { onClose: () => void }) {
  const symbol = useMarketStore((s) => s.symbol);
  const toggleDecisionFunnel = useMarketStore((s) => s.toggleDecisionFunnel);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[14vh] bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-[min(620px,calc(100vw-32px))] rounded-sm border border-border/30 bg-background shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-border/50">
          <div className="flex items-center gap-3">
            <span className="text-sm">🔍</span>
            <span className="text-sm font-semibold">Capability Explorer</span>
            <kbd className="ml-auto text-[10px] text-muted-foreground font-mono px-1.5 py-0.5 rounded border border-border bg-muted">
              ESC
            </kbd>
          </div>
        </div>

        {/* Body */}
        <div className="p-4 max-h-[400px] overflow-y-auto">
          <p className="text-[10px] text-muted-foreground mb-4">
            Browse all system capabilities by ICT workflow stage. Select a stage to see relevant actions.
          </p>

          <div className="space-y-2">
            {(["NARRATIVE", "LIQUIDITY", "TIME", "STRUCTURE", "DISPLACEMENT", "ENTRY", "RISK", "REVIEW"] as const).map((category) => (
              <div key={category} className="rounded-sm border border-border/20 bg-muted/10 p-3">
                <div className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">{category}</div>
                <div className="grid grid-cols-2 gap-1.5">
                  {[`Scan ${category.toLowerCase()}`, `Analyse ${category.toLowerCase()}`, `Act on ${category.toLowerCase()}`].map((action) => (
                    <button
                      key={action}
                      onClick={() => { toggleDecisionFunnel(); onClose(); }}
                      className="text-left px-2 py-1.5 rounded-sm bg-muted/20 border border-border/20 text-[9px] text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
                    >
                      {action}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

              <div className="mt-4 text-[8px] text-muted-foreground text-center">
                UI Coverage: {getUiCoveragePercent()}% · {symbol} · {new Date().toLocaleDateString()}
              </div>
        </div>
      </div>
    </div>
  );
}

export default SessionCockpitShell;
