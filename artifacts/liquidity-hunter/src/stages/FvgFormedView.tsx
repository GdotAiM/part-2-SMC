/**
 * FvgFormedView — entry-level imbalance identified, nearly ENTRY_READY.
 *
 * Renders when narrativeStage === "FVG_FORMED".
 * Shows the unmitigated entry FVG, imbalance zone dimensions,
 * prerequisite checklist, and "Almost Ready" indicator.
 */

import { useMemo, useState } from "react";
import { useMarketStore } from "@/state/market-store";
import { useNarrativeStage } from "@/hooks/useNarrativeStage";
import { SessionFlowIndicator } from "@/panels/SessionFlowIndicator";
import { fmtPrice, getBias, TF_LABEL_MAP } from "@/lib/smc-display";
import { STAGE_LABELS } from "@/state/narrative";
import { getCapabilitiesForStage } from "@/state/capabilities";
import type { SmcReport } from "@workspace/api-client-react";
import type { Market } from "@/lib/smc-display";

// ── Progress indicator ────────────────────────────────────────────────────────

const PROGRESS_STEPS = [
  { key: "sweep", label: "Sweep" },
  { key: "displacement", label: "Displacement" },
  { key: "mss", label: "MSS" },
  { key: "fvg", label: "FVG" },
] as const;

function StageProgress({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-1">
      {PROGRESS_STEPS.map((step, i) => (
        <div key={step.key} className="flex items-center gap-1">
          <div
            className={`w-2 h-2 rounded-full border ${
              i < current
                ? "bg-emerald-500 border-emerald-500"
                : i === current
                  ? "bg-emerald-500 border-emerald-500 animate-pulse"
                  : "bg-muted border-border"
            }`}
          />
          <span className={`text-[7px] uppercase tracking-wider ${
            i <= current ? "text-foreground" : "text-muted-foreground"
          }`}>
            {step.label}
          </span>
          {i < PROGRESS_STEPS.length - 1 && (
            <div className={`w-3 h-px ${i < current - 1 ? "bg-emerald-500/50" : "bg-border"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function FvgFormedView() {
  const reports = useMarketStore((s) => s.reports);
  const symbol = useMarketStore((s) => s.symbol);
  const marketType = useMarketStore((s) => s.marketType) as Market;
  const toggleDecisionFunnel = useMarketStore((s) => s.toggleDecisionFunnel);
  const toggleChart = useMarketStore((s) => s.toggleChart);
  const openEvidence = useMarketStore((s) => s.openEvidence);
  const { stage, reasoning, qualityScore, session, availableCapabilities } = useNarrativeStage();

  const [showModelCheck, setShowModelCheck] = useState(false);

  // ── Sort reports ──
  const sorted = useMemo(() => {
    return Object.entries(reports)
      .filter(([, r]) => r !== null)
      .sort(([a], [b]) =>
        ({ "1w":7,"1d":6,"4h":5,"1h":4,"15m":3,"5m":2,"1m":1 }[b] ?? 0) -
        ({ "1w":7,"1d":6,"4h":5,"1h":4,"15m":3,"5m":2,"1m":1 }[a] ?? 0),
      ) as [string, SmcReport][];
  }, [reports]);

  const anchor = sorted[0]?.[1];
  const entry = sorted[sorted.length - 1]?.[1];

  // ── Entry FVGs ──
  const entryFvgs = useMemo(() => {
    if (!entry) return [];
    return entry.fvg.filter((f) => f.fillFraction < 0.3 && !f.isInversion);
  }, [entry]);

  // ── Prerequisite checklist ──
  const checklist = useMemo(() => {
    const items: Array<{ label: string; pass: boolean; detail: string }> = [];

    // Sweep
    const hasSweep = sorted.some(([, r]) => r.liquidity.pools.some((p) => p.wasSwept));
    items.push({ label: "Liquidity Sweep", pass: true, detail: `${sorted.reduce((c, [,r]) => c + r.liquidity.pools.filter(p => p.wasSwept).length, 0)} pool(s)` });

    // Displacement
    const hasDisplacement = sorted.some(([, r]) => r.fvg.some((f) => f.fillFraction < 0.3));
    items.push({ label: "Displacement", pass: true, detail: "Unfilled FVGs confirmed" });

    // MSS
    const hasMss = sorted.some(([, r]) => r.structure.breaks.some((b) => b.type === "MSS" || b.type === "CHoCH"));
    items.push({ label: "MSS / CHoCH", pass: true, detail: "Structure shift confirmed" });

    // FVG
    items.push({ label: "Entry FVG", pass: entryFvgs.length > 0, detail: `${entryFvgs.length} unmitigated FVG(s)` });

    // Session
    const sessionOk = session.name === "NY_AM" || session.name === "LONDON" || session.name === "NY_PM";
    items.push({ label: "Session Alignment", pass: sessionOk, detail: session.label });

    // Models — pending until strategy detection runs
    const matchedModel = anchor?.draw[0]?.label;
    items.push({ label: "Model Match", pass: !!matchedModel, detail: matchedModel ?? "Run strategy detection" });

    return items;
  }, [sorted, entryFvgs, session]);

  const passed = checklist.filter((c) => c.pass).length;
  const total = checklist.length;

  // ── Bias ──
  const bias = useMemo(() => (anchor ? getBias(anchor) : "neutral"), [anchor]);

  return (
    <div className="flex-1 overflow-y-auto p-5 lg:p-7 max-w-[1200px]">
      {/* ── Header ── */}
      <div className="mb-5">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-sm bg-emerald-500/10 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-semibold text-emerald-500 uppercase tracking-wider">
              {STAGE_LABELS[stage]}
            </span>
          </div>
          <SessionFlowIndicator />
          {qualityScore !== null && (
            <span className={`text-[10px] px-2 py-0.5 rounded-sm font-bold border ${
              qualityScore >= 70 ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" :
              qualityScore >= 40 ? "bg-primary/10 text-primary border-primary/20" :
              "bg-amber-400/10 text-amber-400 border-amber-400/20"
            }`}>
              Score {qualityScore}/100
            </span>
          )}
        </div>
        <h1 className="text-xl lg:text-2xl font-black tracking-tight">{symbol}</h1>
        <p className="mt-1 text-xs text-muted-foreground">{reasoning}</p>
      </div>

      {/* ── Progress bar ── */}
      <div className="mb-5 p-3 rounded-sm border border-border/20 bg-muted/10">
        <StageProgress current={3} />
      </div>

      <div className="grid grid-cols-12 gap-4">

        {/* ── Main column ── */}
        <section className="col-span-12 lg:col-span-7 space-y-4">

          {/* Entry FVG spotlight */}
          <div className="rounded-sm border border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.04] to-transparent overflow-hidden">
            <div className="p-4 border-b border-border/20">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <h3 className="text-[9px] font-semibold uppercase tracking-widest text-emerald-500">
                  Entry Imbalance Zone
                </h3>
              </div>
            </div>
            <div className="p-4">
              {entryFvgs.length === 0 ? (
                <p className="text-[10px] text-muted-foreground">No unmitigated FVGs on entry timeframe.</p>
              ) : (
                <div className="space-y-3">
                  {entryFvgs.slice(0, 4).map((f, i) => (
                    <div key={i} className="rounded-sm border border-border/20 bg-muted/10 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-[9px] font-bold ${
                          f.type === "bullish" ? "text-emerald-500" : "text-destructive"
                        }`}>
                          {f.type === "bullish" ? "▲ BULLISH FVG" : "▼ BEARISH FVG"}
                        </span>
                        <span className="text-[8px] text-muted-foreground font-mono">
                          {TF_LABEL_MAP[entry?.timeframe ?? ""] ?? entry?.timeframe}
                        </span>
                      </div>

                      {/* Imbalance zone bar */}
                      <div className="relative h-10 rounded-sm bg-muted overflow-hidden mb-2">
                        {(() => {
                          const gapTop = Math.max(f.top, f.bottom);
                          const gapBot = Math.min(f.top, f.bottom);
                          const range = gapTop - gapBot;
                          const padding = range * 0.5;
                          const viewTop = gapTop + padding;
                          const viewBot = gapBot - padding;
                          const viewRange = viewTop - viewBot;
                          const topPct = ((viewTop - gapTop) / viewRange) * 100;
                          const heightPct = ((gapTop - gapBot) / viewRange) * 100;
                          return (
                            <div className="absolute inset-0">
                              <div
                                className={`absolute left-0 right-0 rounded-sm border ${
                                  f.type === "bullish"
                                    ? "bg-emerald-500/10 border-emerald-500/30"
                                    : "bg-destructive/10 border-destructive/30"
                                }`}
                                style={{ top: `${topPct}%`, height: `${heightPct}%` }}
                              />
                            </div>
                          );
                        })()}
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="text-[10px] font-mono font-bold text-foreground">
                          {fmtPrice(Math.min(f.top, f.bottom), marketType)} – {fmtPrice(Math.max(f.top, f.bottom), marketType)}
                        </div>
                        <div className="text-[8px] text-muted-foreground">
                          Gap: {fmtPrice(Math.abs(f.top - f.bottom), marketType)}
                        </div>
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-amber-400"
                            style={{ width: `${Math.min(f.fillFraction * 100 * 3, 100)}%` }}
                          />
                        </div>
                        <span className="text-[7px] text-muted-foreground font-mono">
                          {(f.fillFraction * 100).toFixed(0)}% filled
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* "Almost Ready" indicator */}
          <div className={`rounded-sm border p-5 text-center ${
            passed === total
              ? "bg-emerald-500/5 border-emerald-500/20"
              : passed >= total - 1
                ? "bg-amber-400/5 border-amber-400/20"
                : "bg-muted/20 border-border/20"
          }`}>
            <div className="flex items-center justify-center gap-2 mb-2">
              <span className={`w-3 h-3 rounded-full ${
                passed === total ? "bg-emerald-500 animate-pulse" : "bg-amber-400 animate-pulse"
              }`} />
              <span className={`text-sm font-bold ${
                passed === total ? "text-emerald-500" : "text-amber-400"
              }`}>
                {passed === total
                  ? "ENTRY ZONE ACTIVE"
                  : `${total - passed} CHECK${total - passed > 1 ? "S" : ""} REMAINING`}
              </span>
            </div>
            <p className="text-[9px] text-muted-foreground">
              {passed === total
                ? "All prerequisites are met. You can proceed to entry."
                : "Almost there — run strategy detection to confirm model match."}
            </p>
          </div>

        </section>

        {/* ── Right column ── */}
        <section className="col-span-12 lg:col-span-5 space-y-4">

          {/* Prerequisite checklist */}
          <div className="rounded-sm border border-border/30 bg-card/40 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
                Setup Prerequisites
              </h3>
              <span className={`text-[9px] font-bold ${
                passed === total ? "text-emerald-500" :
                passed >= total * 0.7 ? "text-primary" : "text-amber-400"
              }`}>
                {passed}/{total}
              </span>
            </div>
            <div className="space-y-1.5">
              {checklist.map((item, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between py-1.5 px-2 rounded-sm border ${
                    item.pass
                      ? "border-emerald-500/15 bg-emerald-500/[0.03]"
                      : "border-border/20 bg-muted/10"
                  }`}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className={`text-[8px] ${
                      item.pass ? "text-emerald-500" : "text-muted-foreground/50"
                    }`}>
                      {item.pass ? "✓" : "○"}
                    </span>
                    <span className={`text-[9px] ${item.pass ? "text-foreground" : "text-muted-foreground"}`}>
                      {item.label}
                    </span>
                  </div>
                  <span className={`text-[7px] font-mono shrink-0 ml-2 ${
                    item.pass ? "text-emerald-500/70" : "text-muted-foreground/50"
                  }`}>
                    {item.detail.length > 30 ? item.detail.slice(0, 28) + "…" : item.detail}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Bias */}
          <div className={`rounded-sm border p-4 ${
            bias === "bullish"
              ? "border-emerald-500/20 bg-emerald-500/5"
              : bias === "bearish"
                ? "border-destructive/20 bg-destructive/5"
                : "border-border/20 bg-muted/20"
          }`}>
            <div className="text-[9px] uppercase tracking-widest text-muted-foreground mb-1">HTF Bias</div>
            <div className={`text-sm font-bold ${
              bias === "bullish" ? "text-emerald-500" : bias === "bearish" ? "text-destructive" : "text-muted-foreground"
            }`}>
              {bias.toUpperCase()}
            </div>
          </div>

          {/* Session */}
          <div className="rounded-sm border border-border/30 bg-card/40 p-4">
            <h3 className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
              Session
            </h3>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="text-[10px] text-foreground font-semibold">{session.label}</span>
              <span className="text-[9px] text-muted-foreground font-mono">
                {Math.floor(session.timeRemaining / 60000)}m remaining
              </span>
            </div>
          </div>

          {/* Model check button */}
          <button
            onClick={() => { setShowModelCheck(true); toggleDecisionFunnel(); }}
            className="w-full p-3 rounded-sm bg-primary/10 border border-primary/20 text-[10px] text-primary font-semibold hover:bg-primary/15 transition-colors"
          >
            🔍 Detect Strategy Models →
          </button>

        </section>
      </div>

      {/* ── Capabilities ── */}
      {availableCapabilities.length > 0 && (
        <div className="mt-6 rounded-sm border border-border/30 bg-card/40 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
              Available Capabilities
            </h3>
            <span className="text-[8px] text-muted-foreground font-mono">
              {availableCapabilities.length} available
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {availableCapabilities.slice(0, 12).map((cap) => (
              <button
                key={cap.id}
                onClick={toggleDecisionFunnel}
                className="flex items-center gap-1 px-2 py-1 rounded-sm bg-muted/20 border border-border/20 text-[9px] text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
              >
                <span>{cap.icon}</span>
                <span>{cap.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Actions ── */}
      <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={toggleChart} className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-muted/20 border border-border/30 text-[10px] text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors">
          📊 Open Chart
        </button>
        <button onClick={toggleDecisionFunnel} className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-muted/20 border border-border/30 text-[10px] text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors">
          🔍 Decision Funnel
        </button>
        <button onClick={() => openEvidence("fvg-detail")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-muted/20 border border-border/30 text-[10px] text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors">
          📋 FVG Evidence
        </button>
      </div>
    </div>
  );
}

export default FvgFormedView;
