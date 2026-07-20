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
import { TvStatus } from "@/components/TvStatus";
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
