/**
 * DecisionFunnel — vertical multi-TF cascade as a decision funnel.
 *
 * Shows HTF Narrative → Liquidity Delivery → Structure Confirmation →
 * Entry Model → Signal. Each stage is collapsible with inline action buttons.
 *
 * Right slide-over panel. Accessible from any stage.
 */

import { useState } from "react";
import { useMarketStore } from "@/state/market-store";
import { TF_LABEL_MAP } from "@/lib/smc-display";
import { useNarrativeStage } from "@/hooks/useNarrativeStage";
import { SessionFlowIndicator } from "./SessionFlowIndicator";

function FunnelStage({
  number,
  title,
  status,
  children,
  actions,
  defaultOpen,
}: {
  number: number;
  title: string;
  status: "pass" | "pending" | "fail" | "info";
  children: React.ReactNode;
  actions?: Array<{ label: string; onClick: () => void }>;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);

  const statusColors = {
    pass: "border-emerald-500/30 bg-emerald-500/5",
    pending: "border-amber-500/30 bg-amber-500/5",
    fail: "border-destructive/30 bg-destructive/5",
    info: "border-border/30 bg-muted/10",
  };

  const statusDots = {
    pass: "bg-emerald-500",
    pending: "bg-amber-400",
    fail: "bg-destructive",
    info: "bg-muted-foreground",
  };

  return (
    <div className={`rounded-sm border ${statusColors[status]} overflow-hidden`}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-white/3 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className={`w-1.5 h-1.5 rounded-full ${statusDots[status]} shrink-0`} />
          <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">{number}.</span>
          <span className="text-[11px] font-semibold text-foreground">{title}</span>
        </div>
        <span className="text-[9px] text-muted-foreground">{open ? "▾" : "▸"}</span>
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2">
          <div className="text-[10px] text-muted-foreground leading-relaxed">
            {children}
          </div>
          {actions && actions.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {actions.map((a) => (
                <button
                  key={a.label}
                  onClick={a.onClick}
                  className="px-2 py-0.5 rounded-sm text-[8px] font-semibold bg-primary/10 border border-primary/20 text-primary hover:bg-primary/15 transition-colors"
                >
                  {a.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function DecisionFunnel() {
  const reports = useMarketStore((s) => s.reports);
  const symbol = useMarketStore((s) => s.symbol);
  const primary = useMarketStore((s) => s.strategyPrimary);
  const alternatives = useMarketStore((s) => s.strategyAlternatives);
  const openEvidence = useMarketStore((s) => s.openEvidence);
  const toggleChart = useMarketStore((s) => s.toggleChart);
  const { stage, qualityScore } = useNarrativeStage();

  if (stage === "WATCHING") {
    return (
      <div className="w-[320px] hidden lg:flex flex-col border-l border-border/30 bg-card/20 p-4">
        <p className="text-[10px] text-muted-foreground italic font-mono text-center mt-8">
          Select a symbol to see the decision funnel.
        </p>
      </div>
    );
  }

  const sortedTfs = Object.entries(reports)
    .filter(([, r]) => r !== null)
    .sort(([a], [b]) => ({ "1w": 7, "1d": 6, "4h": 5, "1h": 4, "15m": 3, "5m": 2, "1m": 1 }[b] ?? 0) -
                        ({ "1w": 7, "1d": 6, "4h": 5, "1h": 4, "15m": 3, "5m": 2, "1m": 1 }[a] ?? 0)) as [string, NonNullable<typeof reports[string]>][];

  const anchorReport = sortedTfs[0]?.[1];
  const entryReport = sortedTfs[sortedTfs.length - 1]?.[1];

  // Derive stage statuses
  const htfStatus = anchorReport?.structure.confidence && anchorReport.structure.confidence > 0.5 ? "pass" : "pending";
  const hasLiquidity = anchorReport?.liquidity.pools.some((p) => p.wasSwept) ? "pass" : "pending";
  const hasDisplacement = anchorReport?.fvg.some((f) => f.fillFraction === 0) ? "pass" : "pending";
  const hasMss = anchorReport?.structure.breaks.some((b) => b.type === "MSS" || b.type === "CHoCH") ? "pass" : "pending";
  const hasEntryFvg = entryReport?.fvg.some((f) => f.fillFraction === 0 && !f.isInversion) ? "pass" : "pending";
  const modelStatus = primary ? "pass" : "pending";

  return (
    <div className="w-[320px] hidden lg:flex flex-col border-l border-border/30 bg-card/20 shrink-0">
      {/* Header */}
      <div className="px-4 pt-3 pb-2 border-b border-border/20">
        <div className="flex items-center justify-between">
          <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Decision Funnel
          </h3>
          <span className="text-[9px] text-primary font-mono">{symbol}</span>
        </div>
        {qualityScore !== null && (
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  qualityScore >= 70 ? "bg-emerald-500" : qualityScore >= 40 ? "bg-primary" : "bg-amber-400"
                }`}
                style={{ width: `${qualityScore}%` }}
              />
            </div>
            <span className="text-[9px] font-mono text-muted-foreground">{qualityScore}/100</span>
          </div>
        )}
        <div className="mt-2">
          <SessionFlowIndicator />
        </div>
      </div>

      {/* Funnel stages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {/* Stage 1: HTF Narrative */}
        <FunnelStage
          number={1}
          title="HTF Narrative"
          status={htfStatus}
          defaultOpen={true}
          actions={[
            { label: "View Structure", onClick: () => openEvidence("structure") },
            { label: "Chart", onClick: toggleChart },
          ]}
        >
          {anchorReport ? (
            <>
              <span className="font-semibold uppercase">{anchorReport.dailyBias.bias}</span> bias on {anchorReport.timeframe}
              {" · "}Confidence {Math.round(anchorReport.structure.confidence * 100)}%
              <br />
              Phase: <span className="font-semibold">{anchorReport.structure.phase}</span>
              {sortedTfs.slice(0, 3).map(([tf, r]) => (
                <div key={tf} className="flex items-center gap-2 mt-1.5 text-[9px]">
                  <span className="font-mono text-muted-foreground w-5">{TF_LABEL_MAP[tf] ?? tf}</span>
                  <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full ${r.structure.bias === "bullish" ? "bg-emerald-500" : r.structure.bias === "bearish" ? "bg-destructive" : "bg-muted-foreground"}`}
                      style={{ width: `${Math.round(r.structure.confidence * 100)}%` }}
                    />
                  </div>
                  <span className={`text-[8px] font-semibold uppercase ${
                    r.structure.bias === "bullish" ? "text-emerald-500" : r.structure.bias === "bearish" ? "text-destructive" : "text-muted-foreground"
                  }`}>{r.structure.bias}</span>
                </div>
              ))}
            </>
          ) : (
            "No higher timeframe data available."
          )}
        </FunnelStage>

        {/* Stage 2: Liquidity Delivery */}
        <FunnelStage
          number={2}
          title="Liquidity Delivery"
          status={hasLiquidity}
          actions={[
            { label: "Verify Pools", onClick: () => openEvidence("liquidity") },
            { label: "Draw on TV", onClick: () => openEvidence("draw-levels") },
          ]}
        >
          {anchorReport ? (
            <>
              {anchorReport.liquidity.pools.filter((p) => p.wasSwept).length > 0 ? (
                <>
                  <span className="text-emerald-500 font-semibold">{anchorReport.liquidity.pools.filter((p) => p.wasSwept).length} pool(s) swept</span>
                  {" · "}{anchorReport.liquidity.pools.filter((p) => !p.wasSwept).length} untapped
                </>
              ) : (
                "No liquidity events detected yet."
              )}
              <div className="mt-1.5 space-y-1">
                {anchorReport.liquidity.pools.slice(0, 3).map((p, i) => (
                  <div key={i} className="flex justify-between text-[9px] text-muted-foreground">
                    <span>{p.type === "BSL" ? "Buy-side" : "Sell-side"} {p.wasSwept ? "✓" : "○"}</span>
                    <span className="font-mono">${Math.round(p.price).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </>
          ) : "—"}
        </FunnelStage>

        {/* Stage 3: Structure Confirmation */}
        <FunnelStage
          number={3}
          title="Structure Confirmation"
          status={hasDisplacement && hasMss ? "pass" : hasDisplacement ? "pending" : "info"}
          actions={[
            { label: "Detect SMT", onClick: () => openEvidence("smt") },
            { label: "Check Session", onClick: () => openEvidence("session") },
          ]}
        >
          {anchorReport ? (
            <>
              <div className="flex items-center gap-2">
                <span className="text-[9px]">{hasDisplacement ? "✓ Displacement detected" : "○ No displacement"}</span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[9px]">{hasMss ? "✓ MSS/CHoCH confirmed" : "○ No MSS yet"}</span>
              </div>
              {anchorReport.structure.breaks.length > 0 && (
                <div className="mt-1.5 text-[9px] text-muted-foreground">
                  Last break: {anchorReport.structure.breaks[anchorReport.structure.breaks.length - 1].type} @ {anchorReport.structure.breaks[anchorReport.structure.breaks.length - 1].direction}
                </div>
              )}
            </>
          ) : "—"}
        </FunnelStage>

        {/* Stage 4: Entry Model */}
        <FunnelStage
          number={4}
          title="Entry Model"
          status={modelStatus}
          actions={[
            { label: "Model Spec", onClick: () => openEvidence("model-spec") },
            ...(alternatives.length > 0 ? [{ label: `Alternatives (${alternatives.length})`, onClick: () => openEvidence("alternatives") }] : []),
          ]}
        >
          {primary ? (
            <>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold text-primary">{primary.strategyName}</span>
                <span className="text-[8px] px-1 py-0.5 rounded-sm bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                  {Math.round((primary.score ?? 0) * 100)}%
                </span>
              </div>
              {hasEntryFvg && entryReport ? (
                <div className="mt-1.5 text-[9px] text-emerald-500">
                  ✓ Entry FVG identified on {entryReport.timeframe}
                </div>
              ) : (
                <div className="mt-1.5 text-[9px] text-amber-400">
                  ○ Waiting for entry imbalance
                </div>
              )}
              {alternatives.length > 0 && (
                <div className="mt-2 text-[8px] text-muted-foreground">
                  {alternatives.length} alternative model(s) available
                </div>
              )}
            </>
          ) : (
            "No strategy model matched current conditions."
          )}
        </FunnelStage>

        {/* Stage 5: Signal */}
        <FunnelStage
          number={5}
          title="Signal"
          status={primary && hasEntryFvg ? "pass" : primary ? "pending" : "info"}
          actions={[
            { label: "Generate Signal", onClick: () => openEvidence("generate-signal") },
            { label: "Execute", onClick: () => openEvidence("execute") },
          ]}
        >
          {primary && hasEntryFvg ? (
            <div className="text-[10px]">
              <span className="text-emerald-500 font-semibold">SETUP QUALITY</span>
              {qualityScore !== null && (
                <span className="ml-2 font-mono">{qualityScore}/100</span>
              )}
            </div>
          ) : (
            <span className="text-[10px] text-muted-foreground">
              {primary ? "Waiting for entry trigger." : "No model matched. Waiting for conditions."}
            </span>
          )}
        </FunnelStage>
      </div>
    </div>
  );
}
