/**
 * MssFormingView — market structure shift in progress.
 *
 * Renders when narrativeStage === "MSS_FORMING".
 * Shows structure breaks across timeframes, pivot points,
 * HTF/LTF alignment, and entry FVG status.
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

export function MssFormingView() {
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

  // ── MSS/CHoCH breaks across all TFs ──
  const mssBreaks = useMemo(() => {
    const result: Array<{ type: string; tf: string; direction?: string; price?: number }> = [];
    for (const [tf, report] of sorted) {
      for (const b of report.structure.breaks) {
        if (b.type === "MSS" || b.type === "CHoCH") {
          result.push({ type: b.type, tf, direction: (b as any).direction, price: (b as any).price });
        }
      }
    }
    return result;
  }, [sorted]);

  // ── All breaks for context ──
  const allBreaks = useMemo(() => {
    const result: Array<{ type: string; tf: string }> = [];
    for (const [tf, report] of sorted) {
      for (const b of report.structure.breaks) {
        result.push({ type: b.type, tf });
      }
    }
    return result.slice(0, 12);
  }, [sorted]);

  // ── Pivot points from anchor ──
  const pivots = useMemo(() => {
    if (!anchor) return [];
    return anchor.structure.pivots.slice(-8).map((p) => ({
      type: p.type,
      price: p.price,
      time: (p as any).time,
    }));
  }, [anchor]);

  // ── HTF/LTF alignment ──
  const alignment = useMemo(() => {
    if (!anchor || !entry) return null;
    const htfBias = getBias(anchor);
    const ltfBias = getBias(entry);
    const aligned = htfBias === ltfBias && htfBias !== "neutral";
    return {
      htfBias,
      ltfBias,
      aligned,
      htfTf: TF_LABEL_MAP[sorted[0]?.[0]] ?? sorted[0]?.[0],
      ltfTf: TF_LABEL_MAP[sorted[sorted.length - 1]?.[0]] ?? sorted[sorted.length - 1]?.[0],
    };
  }, [anchor, entry, sorted]);

  // ── Entry FVG check ──
  const entryFvg = useMemo(() => {
    if (!entry) return null;
    return entry.fvg.find((f) => f.fillFraction < 0.3 && !f.isInversion) ?? null;
  }, [entry]);

  const htfBias = anchor ? getBias(anchor) : "neutral";

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
        <StageProgress current={2} />
      </div>

      <div className="grid grid-cols-12 gap-4">

        {/* ── Main column ── */}
        <section className="col-span-12 lg:col-span-7 space-y-4">

          {/* MSS breaks spotlight */}
          <div className="rounded-sm border border-primary/20 bg-primary/[0.02] overflow-hidden">
            <div className="p-4 border-b border-border/20">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <h3 className="text-[9px] font-semibold uppercase tracking-widest text-primary">
                  Structure Shift Active
                </h3>
              </div>
            </div>
            <div className="p-4">
              {mssBreaks.length === 0 ? (
                <p className="text-[10px] text-muted-foreground">No MSS/CHoCH breaks detected yet.</p>
              ) : (
                <div className="space-y-2">
                  {mssBreaks.map((b, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-sm bg-muted/10 border border-border/20">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-bold text-primary border border-primary/20 px-1.5 py-0.5 rounded-sm">
                          {b.type}
                        </span>
                        <span className="text-[8px] text-muted-foreground font-mono">
                          {TF_LABEL_MAP[b.tf] ?? b.tf}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {b.direction && (
                          <span className={`text-[8px] ${b.direction === "bullish" || b.direction === "bearish_c" ? "text-emerald-500" : "text-destructive"}`}>
                            {b.direction === "bullish" || b.direction === "bearish_c" ? "▲" : "▼"}
                          </span>
                        )}
                        {b.price != null && (
                          <span className="text-[10px] font-mono font-bold text-foreground">
                            {fmtPrice(b.price, marketType)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Pivot points */}
          {pivots.length > 0 && (
            <div className="rounded-sm border border-border/30 bg-card/40 p-4">
              <h3 className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                Recent Pivots
              </h3>
              <div className="grid grid-cols-2 gap-1.5">
                {pivots.map((p, i) => (
                  <div key={i} className="flex items-center justify-between px-2 py-1.5 rounded-sm bg-muted/10 border border-border/20">
                    <span className={`text-[8px] font-bold ${
                      p.type === "HH" || p.type === "HL" ? "text-emerald-500" :
                      p.type === "LL" || p.type === "LH" ? "text-destructive" :
                      "text-muted-foreground"
                    }`}>
                      {p.type}
                    </span>
                    <span className="text-[9px] font-mono text-foreground">
                      {fmtPrice(p.price, marketType)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* All breaks timeline */}
          {allBreaks.length > 0 && (
            <div className="rounded-sm border border-border/30 bg-card/40 p-4">
              <h3 className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                Break Sequence
              </h3>
              <div className="flex flex-wrap gap-1">
                {allBreaks.map((b, i) => (
                  <span key={i} className={`text-[8px] px-1.5 py-0.5 rounded-sm font-mono ${
                    b.type === "MSS" || b.type === "CHoCH"
                      ? "bg-primary/10 text-primary border border-primary/20"
                      : "bg-muted/20 text-muted-foreground border border-border/20"
                  }`}>
                    {b.type}@{TF_LABEL_MAP[b.tf] ?? b.tf}
                  </span>
                ))}
              </div>
            </div>
          )}

        </section>

        {/* ── Right column ── */}
        <section className="col-span-12 lg:col-span-5 space-y-4">

          {/* HTF/LTF alignment */}
          {alignment && (
            <div className={`rounded-sm border p-4 ${
              alignment.aligned
                ? "bg-emerald-500/5 border-emerald-500/20"
                : "bg-amber-400/5 border-amber-400/20"
            }`}>
              <h3 className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                TF Alignment
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] text-muted-foreground">{alignment.htfTf} (HTF)</span>
                  <span className={`text-[10px] font-bold ${
                    alignment.htfBias === "bullish" ? "text-emerald-500" : "text-destructive"
                  }`}>
                    {alignment.htfBias.toUpperCase()}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[9px] text-muted-foreground">{alignment.ltfTf} (Entry)</span>
                  <span className={`text-[10px] font-bold ${
                    alignment.ltfBias === "bullish" ? "text-emerald-500" : "text-destructive"
                  }`}>
                    {alignment.ltfBias.toUpperCase()}
                  </span>
                </div>
                <div className="pt-2 border-t border-border/20">
                  <span className={`text-[10px] font-bold ${
                    alignment.aligned ? "text-emerald-500" : "text-amber-400"
                  }`}>
                    {alignment.aligned ? "✓ ALIGNED" : "⚠ DIVERGENT"}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Entry FVG status */}
          <div className={`rounded-sm border p-4 ${
            entryFvg
              ? "bg-emerald-500/5 border-emerald-500/20"
              : "bg-muted/20 border-border/20"
          }`}>
            <h3 className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
              Entry FVG
            </h3>
            {entryFvg ? (
              <div>
                <span className="text-[10px] font-bold text-emerald-500">DETECTED</span>
                <div className="mt-1.5 text-[10px] font-mono text-foreground">
                  {fmtPrice(Math.min(entryFvg.top, entryFvg.bottom), marketType)} – {fmtPrice(Math.max(entryFvg.top, entryFvg.bottom), marketType)}
                </div>
                <div className="mt-1 text-[8px] text-muted-foreground">
                  {entryFvg.type.toUpperCase()} · Fill: {(entryFvg.fillFraction * 100).toFixed(0)}%
                </div>
              </div>
            ) : (
              <div>
                <span className="text-[10px] font-bold text-amber-400">MISSING</span>
                <p className="mt-1 text-[9px] text-muted-foreground">
                  Waiting for entry-level imbalance to form.
                </p>
              </div>
            )}
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

          {/* Bias context */}
          <div className={`rounded-sm border p-4 ${
            htfBias === "bullish"
              ? "border-emerald-500/20 bg-emerald-500/5"
              : htfBias === "bearish"
                ? "border-destructive/20 bg-destructive/5"
                : "border-border/20 bg-muted/20"
          }`}>
            <div className="text-[9px] uppercase tracking-widest text-muted-foreground mb-1">HTF Bias</div>
            <div className={`text-sm font-bold ${
              htfBias === "bullish" ? "text-emerald-500" : htfBias === "bearish" ? "text-destructive" : "text-muted-foreground"
            }`}>
              {htfBias.toUpperCase()}
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

export default MssFormingView;
