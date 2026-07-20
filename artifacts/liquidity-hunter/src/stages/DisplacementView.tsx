/**
 * DisplacementView — displacement detected, structure confirming.
 *
 * Renders when narrativeStage === "DISPLACEMENT".
 * Shows unfilled FVGs across timeframes, directional bias,
 * displacement strength, and structure break status.
 */

import { useMemo } from "react";
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
                  ? "bg-primary border-primary animate-pulse"
                  : "bg-muted border-border"
            }`}
          />
          <span className={`text-[7px] uppercase tracking-wider ${
            i <= current ? "text-foreground" : "text-muted-foreground"
          }`}>
            {step.label}
          </span>
          {i < PROGRESS_STEPS.length - 1 && (
            <div className={`w-3 h-px ${i < current ? "bg-emerald-500/50" : "bg-border"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function DisplacementView() {
  const reports = useMarketStore((s) => s.reports);
  const symbol = useMarketStore((s) => s.symbol);
  const marketType = useMarketStore((s) => s.marketType) as Market;
  const toggleDecisionFunnel = useMarketStore((s) => s.toggleDecisionFunnel);
  const toggleChart = useMarketStore((s) => s.toggleChart);
  const openEvidence = useMarketStore((s) => s.openEvidence);
  const { stage, reasoning, qualityScore, session, availableCapabilities } = useNarrativeStage();

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

  // ── Displacement FVGs across all TFs ──
  const displacementFvgs = useMemo(() => {
    const result: Array<{ tf: string; count: number; top: number; bottom: number; avgFill: number; bullish: boolean }> = [];
    for (const [tf, report] of sorted) {
      const fvgs = report.fvg.filter((f) => f.fillFraction < 0.3 && !f.isInversion);
      if (fvgs.length > 0) {
        const avgFill = fvgs.reduce((s, f) => s + f.fillFraction, 0) / fvgs.length;
        const maxGap = fvgs.reduce((best, f) => {
          const gap = Math.abs(f.top - f.bottom);
          return gap > Math.abs(best.top - best.bottom) ? f : best;
        }, fvgs[0]);
        result.push({
          tf,
          count: fvgs.length,
          top: maxGap.top,
          bottom: maxGap.bottom,
          avgFill,
          bullish: fvgs[0].type === "bullish",
        });
      }
    }
    return result.slice(0, 7);
  }, [sorted]);

  // ── Directional bias ──
  const bias = useMemo(() => (anchor ? getBias(anchor) : "neutral"), [anchor]);

  // ── Structure breaks ──
  const structureBreaks = useMemo(() => {
    const breaks: Array<{ type: string; price?: number; direction?: string; tf: string }> = [];
    for (const [tf, report] of sorted) {
      for (const b of report.structure.breaks) {
        breaks.push({ type: b.type, price: (b as any).price, direction: (b as any).direction, tf });
      }
    }
    return breaks.slice(0, 8);
  }, [sorted]);

  // ── Swept pools (context) ──
  const sweptCount = useMemo(() => {
    let count = 0;
    for (const [, report] of sorted) {
      count += report.liquidity.pools.filter((p) => p.wasSwept).length;
    }
    return count;
  }, [sorted]);

  // ── Displacement strength classification ──
  const strength = useMemo(() => {
    const totalFvgs = displacementFvgs.reduce((s, d) => s + d.count, 0);
    if (totalFvgs >= 5) return { level: "strong" as const, label: "Strong Displacement", color: "text-emerald-500", bg: "bg-emerald-500/5 border-emerald-500/20" };
    if (totalFvgs >= 2) return { level: "moderate" as const, label: "Moderate Displacement", color: "text-primary", bg: "bg-primary/5 border-primary/20" };
    return { level: "weak" as const, label: "Weak Displacement", color: "text-amber-400", bg: "bg-amber-400/5 border-amber-400/20" };
  }, [displacementFvgs]);

  return (
    <div className="flex-1 overflow-y-auto p-5 lg:p-7 max-w-[1200px]">
      {/* ── Header ── */}
      <div className="mb-5">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-sm bg-primary/10 border border-primary/20">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            <span className="text-[10px] font-semibold text-primary uppercase tracking-wider">
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
        <StageProgress current={1} />
      </div>

      <div className="grid grid-cols-12 gap-4">

        {/* ── Main column ── */}
        <section className="col-span-12 lg:col-span-7 space-y-4">

          {/* Displacement FVGs by timeframe */}
          <div className="rounded-sm border border-border/30 bg-card/40 overflow-hidden">
            <div className="p-4 border-b border-border/20">
              <h3 className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
                Displacement FVGs ({displacementFvgs.length} TF{displacementFvgs.length !== 1 ? "s" : ""})
              </h3>
            </div>
            <div className="p-4">
              {displacementFvgs.length === 0 ? (
                <p className="text-[10px] text-muted-foreground">No unfilled FVGs detected.</p>
              ) : (
                <div className="space-y-2">
                  {displacementFvgs.map((d, i) => (
                    <div key={i} className="rounded-sm border border-border/20 bg-muted/10 p-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[9px] font-semibold text-foreground font-mono">
                          {TF_LABEL_MAP[d.tf] ?? d.tf}
                        </span>
                        <span className="text-[8px] text-muted-foreground">
                          {d.count} FVG{d.count !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono text-foreground">
                          {fmtPrice(Math.min(d.top, d.bottom), marketType)} – {fmtPrice(Math.max(d.top, d.bottom), marketType)}
                        </span>
                        <span className={`text-[8px] font-semibold ${d.bullish ? "text-emerald-500" : "text-destructive"}`}>
                          {d.bullish ? "▲ BULLISH" : "▼ BEARISH"}
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded-full ${d.avgFill < 0.1 ? "bg-destructive" : "bg-amber-400"}`}
                            style={{ width: `${Math.min(d.avgFill * 100 * 3, 100)}%` }}
                          />
                        </div>
                        <span className="text-[7px] text-muted-foreground font-mono">
                          {(d.avgFill * 100).toFixed(0)}% filled
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Structure breaks panel */}
          {structureBreaks.length > 0 && (
            <div className="rounded-sm border border-border/30 bg-card/40 p-4">
              <h3 className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                Structure Breaks
              </h3>
              <div className="grid grid-cols-2 gap-1.5">
                {structureBreaks.map((b, i) => (
                  <div key={i} className="flex items-center gap-1.5 px-2 py-1 rounded-sm bg-muted/10 border border-border/20">
                    <span className={`text-[8px] font-bold ${
                      b.type === "MSS" || b.type === "CHoCH"
                        ? "text-primary"
                        : "text-muted-foreground"
                    }`}>
                      {b.type}
                    </span>
                    <span className="text-[7px] text-muted-foreground font-mono">
                      {TF_LABEL_MAP[b.tf] ?? b.tf}
                    </span>
                    {b.price != null && (
                      <span className="text-[7px] text-muted-foreground font-mono ml-auto">
                        {b.price.toFixed(2)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

        </section>

        {/* ── Right column ── */}
        <section className="col-span-12 lg:col-span-5 space-y-4">

          {/* Displacement strength */}
          <div className={`rounded-sm border p-4 ${strength.bg}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
                Displacement Strength
              </span>
            </div>
            <span className={`text-sm font-bold ${strength.color}`}>{strength.label}</span>
            <p className="mt-1 text-[9px] text-muted-foreground">
              {strength.level === "strong"
                ? "Multiple unfilled FVGs — high conviction displacement."
                : strength.level === "moderate"
                  ? "Some displacement confirmed. Monitor for additional FVG formation."
                  : "Marginal displacement. Wait for stronger confirmation."}
            </p>
          </div>

          {/* Directional bias */}
          <div className="rounded-sm border border-border/30 bg-card/40 p-4">
            <h3 className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
              Directional Bias
            </h3>
            <div className={`flex items-center gap-3 p-3 rounded-sm border ${
              bias === "bullish"
                ? "bg-emerald-500/5 border-emerald-500/20"
                : bias === "bearish"
                  ? "bg-destructive/5 border-destructive/20"
                  : "bg-muted/20 border-border/20"
            }`}>
              <span className={`text-2xl ${
                bias === "bullish" ? "text-emerald-500" : bias === "bearish" ? "text-destructive" : "text-muted-foreground"
              }`}>
                {bias === "bullish" ? "▲" : bias === "bearish" ? "▼" : "—"}
              </span>
              <div>
                <span className="text-xs font-bold text-foreground">{bias.toUpperCase()}</span>
                <p className="text-[8px] text-muted-foreground">
                  From {TF_LABEL_MAP[sorted[0]?.[0] ?? ""] ?? "HTF"} structure
                </p>
              </div>
            </div>
          </div>

          {/* MSS status */}
          <div className={`rounded-sm border p-4 ${
            structureBreaks.some((b) => b.type === "MSS" || b.type === "CHoCH")
              ? "bg-emerald-500/5 border-emerald-500/20"
              : "bg-muted/20 border-border/20"
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
                Market Structure Shift
              </span>
              <span className={`text-[10px] font-bold ${
                structureBreaks.some((b) => b.type === "MSS" || b.type === "CHoCH")
                  ? "text-emerald-500"
                  : "text-amber-400"
              }`}>
                {structureBreaks.some((b) => b.type === "MSS" || b.type === "CHoCH")
                  ? "CONFIRMED"
                  : "PENDING"}
              </span>
            </div>
          </div>

          {/* Context stats */}
          <div className="rounded-sm border border-border/30 bg-card/40 p-4">
            <h3 className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
              Context
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between text-[9px]">
                <span className="text-muted-foreground">Pools Swept</span>
                <span className="font-mono text-foreground">{sweptCount}</span>
              </div>
              <div className="flex justify-between text-[9px]">
                <span className="text-muted-foreground">Total FVGs</span>
                <span className="font-mono text-foreground">
                  {displacementFvgs.reduce((s, d) => s + d.count, 0)}
                </span>
              </div>
              <div className="flex justify-between text-[9px]">
                <span className="text-muted-foreground">Session</span>
                <span className="font-mono text-foreground">
                  {session.label} · {Math.floor(session.timeRemaining / 60000)}m left
                </span>
              </div>
            </div>
          </div>

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
        <button onClick={() => openEvidence("structure")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-muted/20 border border-border/30 text-[10px] text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors">
          📋 Structure Evidence
        </button>
      </div>
    </div>
  );
}

export default DisplacementView;
