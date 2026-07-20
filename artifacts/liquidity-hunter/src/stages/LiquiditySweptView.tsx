/**
 * LiquiditySweptView — a pool was swept, attention needed.
 *
 * Renders when narrativeStage === "LIQUIDITY_SWEPT".
 * Shows swept pools, sweep classification (manipulation vs genuine break),
 * nearest unswept pool, and displacement readiness.
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
                  ? "bg-amber-400 border-amber-400 animate-pulse"
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

export function LiquiditySweptView() {
  const reports = useMarketStore((s) => s.reports);
  const symbol = useMarketStore((s) => s.symbol);
  const marketType = useMarketStore((s) => s.marketType) as Market;
  const liveData = useMarketStore((s) => s.liveData);
  const toggleDecisionFunnel = useMarketStore((s) => s.toggleDecisionFunnel);
  const toggleChart = useMarketStore((s) => s.toggleChart);
  const openEvidence = useMarketStore((s) => s.openEvidence);
  const { stage, reasoning, qualityScore, session, availableCapabilities } = useNarrativeStage();

  // ── Sort reports by TF weight ──
  const sorted = useMemo(() => {
    return Object.entries(reports)
      .filter(([, r]) => r !== null)
      .sort(([a], [b]) =>
        ({ "1w":7,"1d":6,"4h":5,"1h":4,"15m":3,"5m":2,"1m":1 }[b] ?? 0) -
        ({ "1w":7,"1d":6,"4h":5,"1h":4,"15m":3,"5m":2,"1m":1 }[a] ?? 0),
      ) as [string, SmcReport][];
  }, [reports]);

  const anchor = sorted[0]?.[1];

  // ── Swept pools across all TFs ──
  const sweptPools = useMemo(() => {
    const pools: Array<{
      type: string;
      price: number;
      sweptAt: number | undefined;
      tf: string;
      session: string | undefined;
      wasSwept: boolean;
    }> = [];
    for (const [tf, report] of sorted) {
      for (const p of report.liquidity.pools) {
        if (p.wasSwept) {
          pools.push({
            type: p.type,
            price: p.price,
            sweptAt: (p as any).sweptAt,
            tf,
            session: (p as any).session,
            wasSwept: true,
          });
        }
      }
    }
    return pools.slice(0, 8);
  }, [sorted]);

  // ── Sweep classification ──
  const classification = useMemo(() => {
    if (!anchor) return null;
    const hasChoch = anchor.structure.breaks.some(
      (b) => b.type === "CHoCH" || b.type === "MSS",
    );
    const hasBos = anchor.structure.breaks.some((b) => b.type === "BOS");
    if (hasChoch) return { type: "manipulation" as const, desc: "MANIPULATION — CHoCH/MSS detected" };
    if (hasBos) return { type: "genuine" as const, desc: "GENUINE BREAK — BOS confirmed" };
    return { type: "unknown" as const, desc: "Unclassified — wait for structure confirmation" };
  }, [anchor]);

  // ── Nearest unswept pool ──
  const nearestUnswept = useMemo(() => {
    if (!anchor) return null;
    const unswept = anchor.liquidity.pools
      .filter((p) => !p.wasSwept)
      .sort((a, b) => (b.probabilityOfSweep ?? 0) - (a.probabilityOfSweep ?? 0));
    return unswept[0] ?? null;
  }, [anchor]);

  // ── Displacement check ──
  const hasDisplacement = useMemo(() => {
    return sorted.some(([, r]) => r.fvg.some((f) => f.fillFraction < 0.3));
  }, [sorted]);

  // ── Current live price ──
  const currentPrice = useMemo(() => {
    const entryTf = sorted[sorted.length - 1]?.[0];
    if (entryTf && liveData[entryTf]?.currentPrice) return liveData[entryTf].currentPrice;
    return anchor?.currentPrice ?? null;
  }, [liveData, sorted, anchor]);

  if (sweptPools.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center space-y-3 max-w-md">
          <span className="text-2xl">🔍</span>
          <p className="text-xs text-muted-foreground font-mono">
            Liquidity sweep detected but pool data unavailable.
          </p>
          <button
            onClick={() => openEvidence("liquidity")}
            className="px-3 py-1.5 rounded-sm bg-muted/20 border border-border/30 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            Inspect Liquidity Data
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-5 lg:p-7 max-w-[1200px]">
      {/* ── Header ── */}
      <div className="mb-5">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-sm bg-amber-400/10 border border-amber-400/20">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider">
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
        <StageProgress current={0} />
      </div>

      <div className="grid grid-cols-12 gap-4">

        {/* ── Swept Pools ── */}
        <section className="col-span-12 lg:col-span-7 rounded-sm border border-border/30 bg-card/40 overflow-hidden">
          <div className="p-4 border-b border-border/20">
            <h3 className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
              Swept Pools ({sweptPools.length})
            </h3>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {sweptPools.map((pool, i) => (
                <div
                  key={i}
                  className={`rounded-sm border p-3 ${
                    pool.type === "BSL"
                      ? "bg-emerald-500/[0.04] border-emerald-500/15"
                      : "bg-destructive/[0.04] border-destructive/15"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        pool.type === "BSL" ? "bg-emerald-500" : "bg-destructive"
                      }`} />
                      <span className="text-[9px] font-semibold text-foreground">{pool.type}</span>
                    </div>
                    <span className="text-[8px] text-muted-foreground font-mono">
                      {TF_LABEL_MAP[pool.tf] ?? pool.tf}
                    </span>
                  </div>
                  <div className="text-sm font-bold font-mono text-foreground">
                    {fmtPrice(pool.price, marketType)}
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[8px] text-muted-foreground">
                      {pool.session ?? "any session"}
                    </span>
                    {pool.sweptAt && (
                      <span className="text-[8px] text-amber-400 font-mono">
                        {Math.floor((Date.now() - pool.sweptAt * 1000) / 60000)}m ago
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Right column ── */}
        <section className="col-span-12 lg:col-span-5 space-y-4">

          {/* Sweep classification */}
          <div className="rounded-sm border border-border/30 bg-card/40 p-4">
            <h3 className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
              Sweep Classification
            </h3>
            <div className={`rounded-sm border p-3 ${
              classification?.type === "manipulation"
                ? "bg-amber-400/5 border-amber-400/20"
                : classification?.type === "genuine"
                  ? "bg-emerald-500/5 border-emerald-500/20"
                  : "bg-muted/20 border-border/20"
            }`}>
              <span className={`text-[10px] font-bold ${
                classification?.type === "manipulation" ? "text-amber-400" :
                classification?.type === "genuine" ? "text-emerald-500" :
                "text-muted-foreground"
              }`}>
                {classification?.desc ?? "Analysing…"}
              </span>
              {anchor?.structure.breaks && anchor.structure.breaks.length > 0 && (
                <div className="mt-2 space-y-1">
                  {anchor.structure.breaks.slice(0, 3).map((b, i) => (
                    <div key={i} className="text-[8px] text-muted-foreground font-mono">
                      {b.type} @ {b.price?.toFixed(2) ?? "—"} · {b.direction ?? ""}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Nearest unswept pool */}
          {nearestUnswept && (
            <div className="rounded-sm border border-border/30 bg-card/40 p-4">
              <h3 className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                Next Liquidity Target
              </h3>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${
                    nearestUnswept.type === "BSL" ? "bg-emerald-500" : "bg-destructive"
                  }`} />
                  <span className="text-[10px] font-semibold text-foreground">
                    {nearestUnswept.type}
                  </span>
                </div>
                <span className="text-sm font-bold font-mono text-foreground">
                  {fmtPrice(nearestUnswept.price, marketType)}
                </span>
              </div>
              {currentPrice && (
                <div className="mt-2 flex items-center justify-between text-[8px] text-muted-foreground">
                  <span>
                    Distance: {fmtPrice(Math.abs(nearestUnswept.price - currentPrice), marketType)}
                  </span>
                  <span>
                    {(nearestUnswept.probabilityOfSweep ?? 0) > 0
                      ? `${Math.round((nearestUnswept.probabilityOfSweep ?? 0) * 100)}% probability`
                      : ""}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Displacement status */}
          <div className={`rounded-sm border p-4 ${
            hasDisplacement
              ? "bg-emerald-500/5 border-emerald-500/20"
              : "bg-muted/20 border-border/20"
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
                Displacement
              </span>
              <span className={`text-[10px] font-bold ${
                hasDisplacement ? "text-emerald-500" : "text-amber-400"
              }`}>
                {hasDisplacement ? "DETECTED" : "PENDING"}
              </span>
            </div>
          </div>

          {/* Session context */}
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
        <button
          onClick={toggleChart}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-muted/20 border border-border/30 text-[10px] text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
        >
          📊 Open Chart
        </button>
        <button
          onClick={toggleDecisionFunnel}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-muted/20 border border-border/30 text-[10px] text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
        >
          🔍 Decision Funnel
        </button>
        <button
          onClick={() => openEvidence("liquidity")}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-muted/20 border border-border/30 text-[10px] text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
        >
          📋 Liquidity Evidence
        </button>
      </div>
    </div>
  );
}

export default LiquiditySweptView;
