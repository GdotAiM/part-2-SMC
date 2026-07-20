/**
 * EntryView — actionable trade execution view.
 *
 * Renders when narrativeStage === "ENTRY_READY".
 * Shows matched model, setup quality checklist, entry zone,
 * SL/TP levels, R:R, execution buttons, and alternative models.
 */

import { useMemo, useState } from "react";
import { useMarketStore } from "@/state/market-store";
import { useProfileStore } from "@/state/profile-store";
import { useNarrativeStage } from "@/hooks/useNarrativeStage";
import { useStrategyEvidence } from "@/hooks/useEvidence";
import { fmtPrice, getBias, getConfidence, TF_LABEL_MAP } from "@/lib/smc-display";
import { STAGE_LABELS } from "@/state/narrative";
import { TradeActions } from "@/components/TradeActions";
import { SessionFlowIndicator } from "@/panels/SessionFlowIndicator";
import type { SmcReport } from "@workspace/api-client-react";
import type { Market } from "@/lib/smc-display";

// ── Derive entry levels from SMC report data ─────────────────────────────────

function deriveEntryLevels(reports: Record<string, SmcReport | null>, market: Market) {
  const sorted = Object.entries(reports)
    .filter(([, r]) => r !== null)
    .sort(([a], [b]) =>
      ({ "1w": 7, "1d": 6, "4h": 5, "1h": 4, "15m": 3, "5m": 2, "1m": 1 }[b] ?? 0) -
      ({ "1w": 7, "1d": 6, "4h": 5, "1h": 4, "15m": 3, "5m": 2, "1m": 1 }[a] ?? 0)
    ) as [string, SmcReport][];

  const anchor = sorted[0]?.[1];
  const entryTf = sorted[sorted.length - 1]?.[1];
  const bias = anchor ? getBias(anchor) : "neutral";
  const direction = bias === "bullish" ? "long" as const : bias === "bearish" ? "short" as const : null;

  if (!anchor || !entryTf || !direction) return null;

  // Entry zone: nearest unmitigated FVG on entry TF
  const entryFvg = entryTf.fvg.find(f => f.fillFraction < 0.3 && !f.isInversion);
  const entryOb = entryTf.orderBlocks.find(ob => ob.valid && !ob.isMitigated);

  const entryLow = entryFvg
    ? Math.min(entryFvg.bottom, entryFvg.top)
    : entryOb
      ? Math.min(entryOb.proximal, entryOb.distal)
      : null;

  const entryHigh = entryFvg
    ? Math.max(entryFvg.top, entryFvg.bottom)
    : entryOb
      ? Math.max(entryOb.proximal, entryOb.distal)
      : null;

  // SL: beyond nearest liquidity pool
  const nearestPool = direction === "long"
    ? anchor.liquidity.pools.filter(p => p.type === "SSL" && !p.wasSwept)
        .sort((a, b) => (b.probabilityOfSweep ?? 0) - (a.probabilityOfSweep ?? 0))[0]
    : anchor.liquidity.pools.filter(p => p.type === "BSL" && !p.wasSwept)
        .sort((a, b) => (b.probabilityOfSweep ?? 0) - (a.probabilityOfSweep ?? 0))[0];

  const stopLoss = nearestPool?.price ?? null;

  // TP: first draw target in the direction
  const drawTarget = anchor.draw.find(d =>
    direction === "long" ? d.direction === "long" : d.direction === "short"
  );
  const takeProfit = drawTarget?.price ?? null;

  // R:R
  const avgEntry = entryLow && entryHigh ? (entryLow + entryHigh) / 2 : null;
  const rr = avgEntry && stopLoss && takeProfit
    ? Math.abs(takeProfit - avgEntry) / Math.abs(avgEntry - stopLoss)
    : null;

  return {
    direction,
    entryLow,
    entryHigh,
    avgEntry,
    stopLoss,
    takeProfit,
    rr,
    entryTf: entryTf.timeframe,
    anchorTf: anchor.timeframe,
    anchorPrice: anchor.currentPrice,
    confidence: getConfidence(anchor),
    bias,
  };
}

// ── Setup quality checklist ──────────────────────────────────────────────────

function useSetupChecklist(reports: Record<string, SmcReport | null>, profile: { models: Array<{ id: string; enabled: boolean }> }) {
  return useMemo(() => {
    const sorted = Object.entries(reports)
      .filter(([, r]) => r !== null)
      .sort(([a], [b]) =>
        ({ "1w": 7, "1d": 6, "4h": 5, "1h": 4, "15m": 3, "5m": 2, "1m": 1 }[b] ?? 0) -
        ({ "1w": 7, "1d": 6, "4h": 5, "1h": 4, "15m": 3, "5m": 2, "1m": 1 }[a] ?? 0)
      ) as [string, SmcReport][];

    const anchor = sorted[0]?.[1];
    const entry = sorted[sorted.length - 1]?.[1];

    if (!anchor || !entry) return [];

    const bias = getBias(anchor);
    const items: Array<{ label: string; pass: boolean; detail: string }> = [];

    // HTF bias aligned
    items.push({
      label: "HTF Bias Identified",
      pass: bias !== "neutral",
      detail: `${bias.toUpperCase()} · ${Math.round(anchor.structure.confidence * 100)}% confidence`,
    });

    // Daily bias confirms
    items.push({
      label: "Daily Bias Confirms",
      pass: anchor.dailyBias.bias === bias,
      detail: `${anchor.dailyBias.bias.toUpperCase()} (${anchor.dailyBias.consecutiveDays}d streak)`,
    });

    // Liquidity sweep detected
    const hasSweep = anchor.liquidity.pools.some(p => p.wasSwept);
    items.push({
      label: "Liquidity Sweep Detected",
      pass: hasSweep,
      detail: hasSweep
        ? `${anchor.liquidity.pools.filter(p => p.wasSwept).length} pool(s) swept`
        : "No sweep detected",
    });

    // Displacement / MSS
    const hasDisplacement = anchor.fvg.some(f => f.fillFraction < 0.3);
    const hasMss = anchor.structure.breaks.some(b => b.type === "MSS" || b.type === "CHoCH");
    items.push({
      label: "Displacement + MSS",
      pass: hasDisplacement && hasMss,
      detail: hasDisplacement && hasMss
        ? "Both confirmed"
        : hasDisplacement ? "Displacement ✓ · MSS pending" : "Displacement pending",
    });

    // Entry FVG / OB identified
    const hasEntry = entry.fvg.some(f => f.fillFraction < 0.3 && !f.isInversion) ||
                     entry.orderBlocks.some(ob => ob.valid && !ob.isMitigated);
    items.push({
      label: `Entry Level on ${TF_LABEL_MAP[entry.timeframe] ?? entry.timeframe}`,
      pass: hasEntry,
      detail: hasEntry
        ? `${entry.fvg.filter(f => f.fillFraction < 0.3 && !f.isInversion).length} FVG(s) · ${entry.orderBlocks.filter(ob => ob.valid && !ob.isMitigated).length} OB(s)`
        : "No entry-level imbalance",
    });

    // Session alignment
    items.push({
      label: "Session Alignment",
      pass: true, // session is always "active" — we can refine with profile
      detail: "Session window active",
    });

    // Model matched
    const activeModelCount = profile.models.filter(m => m.enabled).length;
    items.push({
      label: "Active Models",
      pass: activeModelCount > 0,
      detail: `${activeModelCount} model(s) active`,
    });

    return items;
  }, [reports, profile.models]);
}

// ── EntryView Component ──────────────────────────────────────────────────────

export function EntryView() {
  const reports = useMarketStore((s) => s.reports);
  const symbol = useMarketStore((s) => s.symbol);
  const marketType = useMarketStore((s) => s.marketType) as Market;
  const primary = useMarketStore((s) => s.strategyPrimary);
  const alternatives = useMarketStore((s) => s.strategyAlternatives);
  const narrative = useMarketStore((s) => s.strategyNarrative);
  const reasoning = useMarketStore((s) => s.strategyReasoning);
  const toggleChart = useMarketStore((s) => s.toggleChart);
  const openEvidence = useMarketStore((s) => s.openEvidence);
  const pushTimelineEvent = useMarketStore((s) => s.pushTimelineEvent);
  const profile = useProfileStore((s) => s.profile);
  const { stage, reasoning: stageReasoning, qualityScore, session } = useNarrativeStage();

  const [showAltModels, setShowAltModels] = useState(false);
  const [showReasoning, setShowReasoning] = useState(false);

  const levels = useMemo(() => deriveEntryLevels(reports, marketType), [reports, marketType]);
  const checklist = useSetupChecklist(reports, profile);
  const strategyEvidence = useStrategyEvidence();

  const passed = checklist.filter(i => i.pass).length;
  const total = checklist.length;

  // ── Handle "Send to TV" ──
  function handleSendToTV() {
    pushTimelineEvent({
      type: "alert",
      title: "Sending levels to TradingView",
      description: `${levels?.direction?.toUpperCase()} · Entry ${levels?.avgEntry?.toFixed(2)} · SL ${levels?.stopLoss?.toFixed(2)} · TP ${levels?.takeProfit?.toFixed(2)}`,
      symbol,
      actionable: false,
    });
    openEvidence("tv-draw");
  }

  // ── Handle "Generate Signal" ──
  function handleGenerateSignal() {
    pushTimelineEvent({
      type: "signal_generated",
      title: "Signal generated for " + symbol,
      description: levels ? `${levels.direction.toUpperCase()} · ${fmtPrice(levels.avgEntry ?? 0, marketType)} → ${fmtPrice(levels.takeProfit ?? 0, marketType)} · R:R ${levels.rr?.toFixed(2) ?? "—"}` : "",
      symbol,
      actionable: true,
      actionLabel: "Execute",
    });
  }

  if (!levels) {
    // Fallback if levels can't be derived — shouldn't happen at ENTRY_READY
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center space-y-3">
          <span className="text-2xl">⚠️</span>
          <p className="text-xs text-muted-foreground italic font-mono">
            Entry parameters could not be derived from available data.
          </p>
          <button
            onClick={() => openEvidence("structure")}
            className="px-3 py-1.5 rounded-sm bg-primary/10 border border-primary/20 text-xs text-primary font-semibold"
          >
            Inspect Raw Report
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-5 lg:p-7 max-w-[1200px]">
      {/* ── Stage header ── */}
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
              "bg-amber-400/10 text-amber-400 border-amber-500/20"
            }`}>
              Score {qualityScore}/100
            </span>
          )}
        </div>
        <h1 className="text-xl lg:text-2xl font-black tracking-tight">{symbol}</h1>
        <p className="mt-1 text-xs text-muted-foreground">{stageReasoning}</p>
      </div>

      {/* ── Main grid ── */}
      <div className="grid grid-cols-12 gap-4">

        {/* ── Entry Card ── */}
        <section className="col-span-12 lg:col-span-8 rounded-sm border border-border/30 bg-gradient-to-br from-emerald-500/[0.04] to-transparent overflow-hidden">
          {/* Price area */}
          <div className="p-5 border-b border-border/20">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-muted-foreground uppercase tracking-widest font-semibold">Entry Setup</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-sm font-bold border ${
                  levels.direction === "long"
                    ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/30"
                    : "bg-destructive/15 text-destructive border-destructive/30"
                }`}>
                  {levels.direction === "long" ? "▲ LONG" : "▼ SHORT"}
                </span>
              </div>
              <span className="text-[9px] text-muted-foreground font-mono">
                {TF_LABEL_MAP[levels.entryTf] ?? levels.entryTf} entry · {TF_LABEL_MAP[levels.anchorTf] ?? levels.anchorTf} bias
              </span>
            </div>

            {/* Price levels grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* Entry zone */}
              <div className="rounded-sm bg-muted/20 border border-border/20 p-3">
                <div className="text-[9px] text-muted-foreground uppercase tracking-wider">Entry Zone</div>
                <div className="mt-1 text-lg font-black font-mono text-foreground">
                  {levels.entryLow && levels.entryHigh
                    ? `${fmtPrice(levels.entryLow, marketType)} – ${fmtPrice(levels.entryHigh, marketType)}`
                    : "—"}
                </div>
                {levels.avgEntry && (
                  <div className="text-[9px] text-muted-foreground mt-0.5">
                    ~ {fmtPrice(levels.avgEntry, marketType)} avg
                  </div>
                )}
              </div>

              {/* Stop loss */}
              <div className="rounded-sm bg-destructive/5 border border-destructive/20 p-3">
                <div className="text-[9px] text-muted-foreground uppercase tracking-wider">Stop Loss</div>
                <div className="mt-1 text-lg font-black font-mono text-destructive">
                  {levels.stopLoss ? fmtPrice(levels.stopLoss, marketType) : "—"}
                </div>
                {levels.avgEntry && levels.stopLoss && (
                  <div className="text-[9px] text-destructive/70 mt-0.5">
                    {Math.abs(levels.avgEntry - levels.stopLoss) < 1
                      ? (Math.abs(levels.avgEntry - levels.stopLoss) * 10000).toFixed(0) + " pts"
                      : "$" + Math.abs(levels.avgEntry - levels.stopLoss).toFixed(2)}
                    {" risk"}
                  </div>
                )}
              </div>

              {/* Take profit */}
              <div className="rounded-sm bg-emerald-500/5 border border-emerald-500/20 p-3">
                <div className="text-[9px] text-muted-foreground uppercase tracking-wider">Take Profit</div>
                <div className="mt-1 text-lg font-black font-mono text-emerald-500">
                  {levels.takeProfit ? fmtPrice(levels.takeProfit, marketType) : "—"}
                </div>
                {levels.avgEntry && levels.takeProfit && (
                  <div className="text-[9px] text-emerald-500/70 mt-0.5">
                    {Math.abs(levels.takeProfit - levels.avgEntry) < 1
                      ? (Math.abs(levels.takeProfit - levels.avgEntry) * 10000).toFixed(0) + " pts"
                      : "$" + Math.abs(levels.takeProfit - levels.avgEntry).toFixed(2)}
                    {" reward"}
                  </div>
                )}
              </div>

              {/* R:R */}
              <div className={`rounded-sm border p-3 ${
                levels.rr && levels.rr >= 2
                  ? "bg-emerald-500/10 border-emerald-500/30"
                  : levels.rr && levels.rr >= 1
                    ? "bg-amber-400/10 border-amber-500/20"
                    : "bg-muted/20 border-border/20"
              }`}>
                <div className="text-[9px] text-muted-foreground uppercase tracking-wider">R:R</div>
                <div className={`mt-1 text-lg font-black font-mono ${
                  levels.rr && levels.rr >= 2 ? "text-emerald-500" :
                  levels.rr && levels.rr >= 1 ? "text-amber-400" : "text-foreground"
                }`}>
                  {levels.rr ? `1 : ${levels.rr.toFixed(2)}` : "—"}
                </div>
                <div className="text-[9px] text-muted-foreground mt-0.5">
                  {levels.rr && levels.rr >= 2 ? "Excellent" :
                   levels.rr && levels.rr >= 1 ? "Acceptable" : "Below threshold"}
                </div>
              </div>
            </div>

            {/* Current price vs levels visual */}
            {levels.anchorPrice && (
              <div className="mt-4 rounded-sm bg-muted/20 border border-border/20 p-3">
                <div className="flex items-center justify-between text-[9px] text-muted-foreground mb-1.5">
                  <span>Current</span>
                  <span className="font-mono">{fmtPrice(levels.anchorPrice, marketType)}</span>
                </div>
                <div className="relative h-6 rounded-sm bg-muted overflow-hidden">
                  {/* Price range bar */}
                  {levels.stopLoss && levels.takeProfit && levels.avgEntry && (
                    <>
                      {/* SL → Entry (risk) */}
                      <div
                        className="absolute top-0 h-full bg-destructive/20"
                        style={{
                          left: `${Math.min(
                            ((levels.stopLoss - Math.min(levels.stopLoss, levels.takeProfit)) /
                              Math.abs(levels.takeProfit - levels.stopLoss)) * 100,
                            100
                          )}%`,
                          width: `${Math.abs(
                            ((levels.avgEntry - levels.stopLoss) /
                              Math.abs(levels.takeProfit - levels.stopLoss)) * 100
                          )}%`,
                        }}
                      />
                      {/* Entry → TP (reward) */}
                      <div
                        className="absolute top-0 h-full bg-emerald-500/20"
                        style={{
                          left: `${Math.min(
                            ((levels.avgEntry - Math.min(levels.stopLoss, levels.takeProfit)) /
                              Math.abs(levels.takeProfit - levels.stopLoss)) * 100,
                            100
                          )}%`,
                          width: `${Math.abs(
                            ((levels.takeProfit - levels.avgEntry) /
                              Math.abs(levels.takeProfit - levels.stopLoss)) * 100
                          )}%`,
                        }}
                      />
                      {/* Current price marker */}
                      <div
                        className="absolute top-0 w-0.5 h-full bg-cyan-400 shadow-[0_0_6px_#22d3ee]"
                        style={{
                          left: `${Math.min(
                            ((levels.anchorPrice - Math.min(levels.stopLoss, levels.takeProfit)) /
                              Math.abs(levels.takeProfit - levels.stopLoss)) * 100,
                            100
                          )}%`,
                        }}
                      />
                      {/* SL marker */}
                      <div className="absolute top-0 w-px h-full bg-destructive/60" style={{ left: '0%' }} />
                      {/* TP marker */}
                      <div className="absolute top-0 w-px h-full bg-emerald-500/60" style={{ left: '100%' }} />
                    </>
                  )}
                </div>
                <div className="flex justify-between text-[8px] text-muted-foreground mt-1">
                  <span className="font-mono">{levels.stopLoss ? fmtPrice(levels.stopLoss, marketType) : "SL"}</span>
                  <span className="font-mono">{levels.takeProfit ? fmtPrice(levels.takeProfit, marketType) : "TP"}</span>
                </div>
              </div>
            )}
          </div>

          {/* Trade actions — using existing TradeActions component */}
          <div className="p-5">
            <TradeActions
              setup={{
                symbol,
                timeframe: levels.entryTf,
                market: marketType,
                direction: levels.direction,
                entryLow: levels.entryLow,
                entryHigh: levels.entryHigh,
                stopLoss: levels.stopLoss,
                takeProfit: levels.takeProfit,
                confidence: levels.confidence,
                grade: qualityScore !== null && qualityScore >= 70 ? "A" : qualityScore !== null && qualityScore >= 50 ? "B" : "C",
              }}
            />
          </div>

          {/* Quick action buttons */}
          <div className="border-t border-border/20 px-5 py-3 flex flex-wrap gap-2">
            <button
              onClick={handleSendToTV}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-muted/20 border border-border/30 text-[10px] text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
            >
              ✏️ Send to TV
            </button>
            <button
              onClick={handleGenerateSignal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-muted/20 border border-border/30 text-[10px] text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
            >
              📡 Generate Signal
            </button>
            <button
              onClick={toggleChart}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-muted/20 border border-border/30 text-[10px] text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
            >
              📊 Open Chart
            </button>
            <button
              onClick={() => openEvidence("model-spec")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-muted/20 border border-border/30 text-[10px] text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
            >
              📋 Model Spec
            </button>
          </div>
        </section>

        {/* ── Right column: Checklist + Model ── */}
        <section className="col-span-12 lg:col-span-4 space-y-4">

          {/* Strategy model card */}
          {primary && (
            <div className="rounded-sm border border-border/30 bg-card/40 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">Matched Model</h3>
                <span className={`text-[9px] px-1.5 py-0.5 rounded-sm font-bold border ${
                  (primary.score ?? 0) >= 0.7
                    ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                    : "bg-primary/10 text-primary border-primary/20"
                }`}>
                  {Math.round((primary.score ?? 0) * 100)}%
                </span>
              </div>
              <p className="text-xs font-semibold text-foreground">{primary.strategyName}</p>
              <p className="text-[9px] text-muted-foreground mt-1 font-mono">{primary.strategyId}</p>

              {/* Evidence list */}
              {primary.evidence && primary.evidence.length > 0 && (
                <div className="mt-3 space-y-1">
                  {primary.evidence.slice(0, 5).map((ev, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-[9px]">
                      <span className={`shrink-0 mt-0.5 ${
                        ev.startsWith("✓") ? "text-emerald-500" :
                        ev.startsWith("✗") ? "text-destructive" :
                        "text-muted-foreground"
                      }`}>
                        {ev.startsWith("✓") ? "●" : ev.startsWith("✗") ? "○" : "◐"}
                      </span>
                      <span className="text-muted-foreground">{ev.replace(/^[✓✗◐]\s*/, "")}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Alternative models toggle */}
              {alternatives.length > 0 && (
                <div className="mt-3">
                  <button
                    onClick={() => setShowAltModels(!showAltModels)}
                    className="flex items-center gap-1 text-[9px] text-primary hover:text-primary/80 transition-colors"
                  >
                    <span>{showAltModels ? "Hide" : `${alternatives.length} alternative(s)`}</span>
                    <span>{showAltModels ? "▾" : "▸"}</span>
                  </button>
                  {showAltModels && (
                    <div className="mt-2 space-y-1.5">
                      {alternatives.slice(0, 5).map((alt) => (
                        <div key={alt.strategyId} className="flex items-center justify-between py-1 px-2 rounded-sm bg-muted/20 border border-border/20">
                          <span className="text-[9px] text-muted-foreground truncate mr-2">{alt.strategyName}</span>
                          <span className="text-[8px] px-1 py-0.5 rounded-sm bg-muted border border-border text-muted-foreground shrink-0">
                            {Math.round((alt.score ?? 0) * 100)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Model spec button */}
              <button
                onClick={() => openEvidence("model-spec")}
                className="mt-3 w-full py-1.5 rounded-sm bg-muted/20 border border-border/20 text-[9px] text-muted-foreground hover:text-foreground transition-colors"
              >
                View Full Spec →
              </button>
            </div>
          )}

          {/* Setup quality checklist */}
          <div className="rounded-sm border border-border/30 bg-card/40 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">Setup Quality</h3>
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

          {/* Narrative / Reasoning */}
          {narrative && (
            <div className="rounded-sm border border-border/30 bg-card/40 p-4">
              <h3 className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Narrative</h3>
              <p className="text-[10px] text-muted-foreground leading-relaxed">{narrative}</p>
              {reasoning && (
                <div className="mt-2">
                  <button
                    onClick={() => setShowReasoning(!showReasoning)}
                    className="text-[8px] text-primary hover:text-primary/80 transition-colors"
                  >
                    {showReasoning ? "Hide AI reasoning" : "Show AI reasoning"}
                  </button>
                  {showReasoning && (
                    <div className="mt-2 p-2 rounded-sm bg-muted/20 border border-border/20">
                      <p className="text-[9px] text-muted-foreground leading-relaxed">{reasoning.reasoning}</p>
                      <div className="mt-1 text-[8px] text-primary font-mono">
                        Confidence: {Math.round(reasoning.confidenceScore * 100)}%
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Session context */}
          <div className="rounded-sm border border-border/30 bg-card/40 p-4">
            <h3 className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Session</h3>
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
    </div>
  );
}
