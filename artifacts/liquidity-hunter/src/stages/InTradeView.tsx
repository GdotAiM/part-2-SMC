/**
 * InTradeView — position is open, monitoring risk.
 *
 * Renders when narrativeStage === "IN_TRADE".
 * Shows real-time P&L, SL/TP distance, structure integrity,
 * trail stop suggestion, and close position with confirmation.
 */

import { useMemo, useState, useCallback } from "react";
import { useMarketStore } from "@/state/market-store";
import { useProfileStore } from "@/state/profile-store";
import { useNarrativeStage } from "@/hooks/useNarrativeStage";
import { SessionFlowIndicator } from "@/panels/SessionFlowIndicator";
import { fmtPrice, getBias, TF_LABEL_MAP } from "@/lib/smc-display";
import { STAGE_LABELS } from "@/state/narrative";
import { getCapabilitiesForStage } from "@/state/capabilities";
import type { SmcReport } from "@workspace/api-client-react";
import type { Market } from "@/lib/smc-display";

// ── Component ─────────────────────────────────────────────────────────────────

export function InTradeView() {
  const reports = useMarketStore((s) => s.reports);
  const symbol = useMarketStore((s) => s.symbol);
  const marketType = useMarketStore((s) => s.marketType) as Market;
  const liveData = useMarketStore((s) => s.liveData);
  const entryPrice = useMarketStore((s) => s.currentEntryPrice);
  const stopLoss = useMarketStore((s) => s.currentStopLoss);
  const targets = useMarketStore((s) => s.currentTargets);
  const inTrade = useMarketStore((s) => s.inTrade);
  const toggleChart = useMarketStore((s) => s.toggleChart);
  const toggleDecisionFunnel = useMarketStore((s) => s.toggleDecisionFunnel);
  const openEvidence = useMarketStore((s) => s.openEvidence);
  const pushTimelineEvent = useMarketStore((s) => s.pushTimelineEvent);
  const setInTrade = useMarketStore((s) => s.setInTrade);
  const setTradeLevels = useMarketStore((s) => s.setTradeLevels);
  const strategyPrimary = useMarketStore((s) => s.strategyPrimary);
  const { stage, reasoning, session, availableCapabilities } = useNarrativeStage();
  const profile = useProfileStore((s) => s.profile);

  const [confirmClose, setConfirmClose] = useState(false);
  const [showTrailStop, setShowTrailStop] = useState(false);
  const [trailPrice, setTrailPrice] = useState<number | null>(null);

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
  const entryReport = sorted[sorted.length - 1]?.[1];

  // ── Current price from live data ──
  const currentPrice = useMemo(() => {
    // Try entry TF first, then fall back to any TF with live data
    const entryTf = sorted[sorted.length - 1]?.[0];
    if (entryTf && liveData[entryTf]?.currentPrice) return liveData[entryTf].currentPrice;
    for (const [tf, data] of Object.entries(liveData)) {
      if (data.currentPrice) return data.currentPrice;
    }
    return anchor?.currentPrice ?? null;
  }, [liveData, sorted, anchor]);

  // ── Derive trade direction from entry vs TP ──
  const direction = useMemo(() => {
    if (!entryPrice || targets.length === 0) return null;
    return targets[0] > entryPrice ? "long" : "short";
  }, [entryPrice, targets]);

  // ── P&L calculation ──
  const pnl = useMemo(() => {
    if (!entryPrice || !currentPrice || !direction) return null;
    const pct = direction === "long"
      ? ((currentPrice - entryPrice) / entryPrice) * 100
      : ((entryPrice - currentPrice) / entryPrice) * 100;
    const positionSize = profile.risk.positionSizePercent / 100;
    const absPnl = pct * positionSize * 100; // scaled
    return { pct, absPnl };
  }, [entryPrice, currentPrice, direction, profile.risk.positionSizePercent]);

  // ── Distance to SL/TP ──
  const levels = useMemo(() => {
    if (!currentPrice || !stopLoss) return null;
    const slDist = Math.abs(currentPrice - stopLoss);
    const slPct = entryPrice ? (Math.abs(stopLoss - entryPrice) / entryPrice) * 100 : null;
    const tp1Dist = targets[0] ? Math.abs(targets[0] - currentPrice) : null;
    const tp1Pct = entryPrice && targets[0] ? (Math.abs(targets[0] - entryPrice) / entryPrice) * 100 : null;
    return { slDist, slPct, tp1Dist, tp1Pct, tp1: targets[0] ?? null, tp2: targets[1] ?? null };
  }, [currentPrice, stopLoss, entryPrice, targets]);

  // ── Structure integrity ──
  const structureStatus = useMemo(() => {
    if (!anchor || !direction) return { status: "unknown" as const, label: "No structure data", color: "text-muted-foreground", bg: "bg-muted/20 border-border/20" };
    const bias = getBias(anchor);
    const tradeAligned = (direction === "long" && bias === "bullish") || (direction === "short" && bias === "bearish");

    if (tradeAligned) {
      return { status: "intact" as const, label: "INTACT", color: "text-emerald-500", bg: "bg-emerald-500/5 border-emerald-500/20" };
    }
    if (bias === "neutral") {
      return { status: "weakening" as const, label: "WEAKENING", color: "text-amber-400", bg: "bg-amber-400/5 border-amber-400/20" };
    }
    return { status: "broken" as const, label: "BROKEN", color: "text-destructive", bg: "bg-destructive/5 border-destructive/20" };
  }, [anchor, direction]);

  // ── Trail stop suggestion ──
  const trailStopSuggestion = useMemo(() => {
    if (!direction || !currentPrice || !entryPrice) return null;
    // If price moved 0.5R in favor, suggest moving SL to breakeven
    if (stopLoss) {
      const risk = Math.abs(entryPrice - stopLoss);
      const moved = direction === "long" ? currentPrice - entryPrice : entryPrice - currentPrice;
      if (moved >= risk * 0.5 && (direction === "long" ? entryPrice > stopLoss : entryPrice < stopLoss)) {
        return { price: entryPrice, label: "Breakeven", type: "breakeven" as const };
      }
    }
    // Suggest recent pivot as trail
    if (anchor && direction === "long") {
      const hl = anchor.structure.pivots.filter((p) => p.type === "HL").pop();
      if (hl && hl.price < currentPrice && (!stopLoss || hl.price > stopLoss)) {
        return { price: hl.price, label: "HL Pivot", type: "pivot" as const };
      }
    }
    if (anchor && direction === "short") {
      const lh = anchor.structure.pivots.filter((p) => p.type === "LH").pop();
      if (lh && lh.price > currentPrice && (!stopLoss || lh.price < stopLoss)) {
        return { price: lh.price, label: "LH Pivot", type: "pivot" as const };
      }
    }
    return null;
  }, [direction, currentPrice, entryPrice, stopLoss, anchor]);

  // ── Close position ──
  const handleClose = useCallback(() => {
    if (confirmClose) {
      pushTimelineEvent({
        type: "trade_closed",
        title: `Position closed: ${symbol}`,
        description: currentPrice ? `Exit at ${fmtPrice(currentPrice, marketType)} · P&L: ${pnl?.pct.toFixed(2) ?? "—"}%` : "",
        symbol,
        price: currentPrice ?? undefined,
        actionable: false,
      });
      setInTrade(false);
      setTradeLevels(null, null, []);
      setConfirmClose(false);
    } else {
      setConfirmClose(true);
      setTimeout(() => setConfirmClose(false), 5000);
    }
  }, [confirmClose, symbol, currentPrice, marketType, pnl, pushTimelineEvent, setInTrade, setTradeLevels]);

  // ── Handle trail stop ──
  const handleTrail = useCallback(() => {
    if (trailStopSuggestion) {
      pushTimelineEvent({
        type: "alert",
        title: `Trail stop to ${fmtPrice(trailStopSuggestion.price, marketType)}`,
        description: `${trailStopSuggestion.label} · Was ${stopLoss ? fmtPrice(stopLoss, marketType) : "—"}`,
        symbol,
        price: trailStopSuggestion.price,
        actionable: false,
      });
      setTrailPrice(trailStopSuggestion.price);
    }
  }, [trailStopSuggestion, marketType, symbol, stopLoss, pushTimelineEvent]);

  // ── Risk metrics ──
  const riskMetrics = useMemo(() => {
    const rrLockedIn = entryPrice && stopLoss && currentPrice
      ? Math.abs(currentPrice - entryPrice) / Math.abs(entryPrice - stopLoss)
      : null;
    return { rrLockedIn };
  }, [entryPrice, stopLoss, currentPrice]);

  if (!inTrade) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center space-y-3">
          <span className="text-2xl">📭</span>
          <p className="text-xs text-muted-foreground font-mono">No active position.</p>
        </div>
      </div>
    );
  }

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
          {direction && (
            <span className={`text-[10px] px-2 py-0.5 rounded-sm font-bold border ${
              direction === "long"
                ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/30"
                : "bg-destructive/15 text-destructive border-destructive/30"
            }`}>
              {direction === "long" ? "▲ LONG" : "▼ SHORT"}
            </span>
          )}
        </div>
        <h1 className="text-xl lg:text-2xl font-black tracking-tight">{symbol}</h1>
        <p className="mt-1 text-xs text-muted-foreground">{reasoning}</p>
      </div>

      <div className="grid grid-cols-12 gap-4">

        {/* ── Main column ── */}
        <section className="col-span-12 lg:col-span-7 space-y-4">

          {/* P&L Card */}
          <div className={`rounded-sm border-2 p-6 ${
            pnl && pnl.pct > 0
              ? "border-emerald-500/30 bg-gradient-to-br from-emerald-500/[0.06] to-transparent"
              : pnl && pnl.pct < 0
                ? "border-destructive/30 bg-gradient-to-br from-destructive/[0.06] to-transparent"
                : "border-border/30 bg-card/40"
          }`}>
            <div className="text-center">
              <div className="text-[9px] uppercase tracking-widest text-muted-foreground mb-1">
                Unrealized P&L
              </div>
              {pnl ? (
                <>
                  <div className={`text-4xl font-black font-mono ${
                    pnl.pct >= 0 ? "text-emerald-500" : "text-destructive"
                  }`}>
                    {pnl.pct >= 0 ? "+" : ""}{pnl.pct.toFixed(2)}%
                  </div>
                  <div className={`mt-1 text-xs font-mono ${
                    pnl.absPnl >= 0 ? "text-emerald-500/70" : "text-destructive/70"
                  }`}>
                    {pnl.absPnl >= 0 ? "+" : ""}${Math.abs(pnl.absPnl).toFixed(2)}
                  </div>
                </>
              ) : (
                <div className="text-2xl font-black text-muted-foreground font-mono">—</div>
              )}
            </div>
          </div>

          {/* Levels Monitor */}
          <div className="rounded-sm border border-border/30 bg-card/40 p-4">
            <h3 className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground mb-4">
              Position Levels
            </h3>

            {/* Price bar visualization */}
            {entryPrice && stopLoss && targets.length > 0 && currentPrice && (
              <div className="mb-4">
                <div className="relative h-8 rounded-sm bg-muted overflow-hidden">
                  {/* SL zone */}
                  <div className="absolute top-0 h-full bg-destructive/10" style={{
                    left: 0,
                    width: `${Math.min((Math.abs(entryPrice - stopLoss) / Math.abs(targets[0] - stopLoss)) * 100, 100)}%`
                  }} />
                  {/* TP zone */}
                  <div className="absolute top-0 h-full bg-emerald-500/10" style={{
                    left: `${(Math.abs(entryPrice - stopLoss) / Math.abs(targets[0] - stopLoss)) * 100}%`,
                    width: `${((Math.abs(targets[0] - entryPrice)) / Math.abs(targets[0] - stopLoss)) * 100}%`
                  }} />
                  {/* Current price marker */}
                  <div className="absolute top-0 w-0.5 h-full bg-cyan-400 shadow-[0_0_8px_#22d3ee] z-10" style={{
                    left: `${Math.min(Math.max(((currentPrice - stopLoss) / (targets[0] - stopLoss)) * 100, 0), 100)}%`
                  }} />
                </div>
                <div className="flex justify-between text-[8px] text-muted-foreground mt-1 font-mono">
                  <span>SL {fmtPrice(stopLoss, marketType)}</span>
                  <span>Entry {fmtPrice(entryPrice, marketType)}</span>
                  <span>TP1 {fmtPrice(targets[0], marketType)}</span>
                </div>
              </div>
            )}

            {/* Level details */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-sm bg-muted/20 border border-border/20 p-3">
                <div className="text-[9px] text-muted-foreground uppercase tracking-wider">Entry</div>
                <div className="mt-1 text-sm font-bold font-mono text-foreground">
                  {entryPrice ? fmtPrice(entryPrice, marketType) : "—"}
                </div>
              </div>
              <div className="rounded-sm bg-destructive/5 border border-destructive/20 p-3">
                <div className="text-[9px] text-muted-foreground uppercase tracking-wider">Stop Loss</div>
                <div className="mt-1 text-sm font-bold font-mono text-destructive">
                  {stopLoss ? fmtPrice(stopLoss, marketType) : "—"}
                </div>
                {levels && (
                  <div className="text-[8px] text-destructive/70 mt-0.5">
                    {fmtPrice(levels.slDist, marketType)} away
                  </div>
                )}
              </div>
              <div className="rounded-sm bg-emerald-500/5 border border-emerald-500/20 p-3">
                <div className="text-[9px] text-muted-foreground uppercase tracking-wider">TP1</div>
                <div className="mt-1 text-sm font-bold font-mono text-emerald-500">
                  {targets[0] ? fmtPrice(targets[0], marketType) : "—"}
                </div>
                {levels?.tp1Dist != null && (
                  <div className="text-[8px] text-emerald-500/70 mt-0.5">
                    {fmtPrice(levels.tp1Dist, marketType)} to go
                  </div>
                )}
              </div>
              <div className={`rounded-sm border p-3 ${
                riskMetrics.rrLockedIn && riskMetrics.rrLockedIn >= 1
                  ? "bg-emerald-500/10 border-emerald-500/30"
                  : "bg-muted/20 border-border/20"
              }`}>
                <div className="text-[9px] text-muted-foreground uppercase tracking-wider">R:R Locked</div>
                <div className="mt-1 text-sm font-bold font-mono text-foreground">
                  {riskMetrics.rrLockedIn ? `1:${riskMetrics.rrLockedIn.toFixed(1)}` : "—"}
                </div>
              </div>
            </div>
          </div>

          {/* Structure integrity */}
          <div className={`rounded-sm border p-4 ${structureStatus.bg}`}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Structure Integrity
                </h3>
                <div className={`mt-1 text-sm font-bold ${structureStatus.color}`}>
                  {structureStatus.label}
                </div>
              </div>
              <div className="w-3 h-3 rounded-full border-2 border-current opacity-50">
                <div className={`w-full h-full rounded-full ${
                  structureStatus.status === "intact" ? "bg-emerald-500" :
                  structureStatus.status === "weakening" ? "bg-amber-400 animate-pulse" :
                  "bg-destructive animate-pulse"
                }`} />
              </div>
            </div>
            {anchor && (
              <p className="mt-2 text-[9px] text-muted-foreground">
                HTF bias: {getBias(anchor).toUpperCase()} · {anchor.structure.breaks.length} recent breaks
              </p>
            )}
          </div>

        </section>

        {/* ── Right column ── */}
        <section className="col-span-12 lg:col-span-5 space-y-4">

          {/* Trail stop card */}
          {trailStopSuggestion && (
            <div className="rounded-sm border border-amber-400/20 bg-amber-400/5 p-4">
              <h3 className="text-[9px] font-semibold uppercase tracking-widest text-amber-400 mb-3">
                Trail Stop Suggestion
              </h3>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[9px] text-muted-foreground">{trailStopSuggestion.label}</div>
                  <div className="text-sm font-bold font-mono text-foreground">
                    {fmtPrice(trailStopSuggestion.price, marketType)}
                  </div>
                </div>
                <button
                  onClick={handleTrail}
                  className="px-3 py-1.5 rounded-sm bg-amber-400/10 border border-amber-400/20 text-[10px] text-amber-400 font-semibold hover:bg-amber-400/15 transition-colors"
                >
                  Move SL
                </button>
              </div>
            </div>
          )}

          {/* Current position summary */}
          <div className="rounded-sm border border-border/30 bg-card/40 p-4">
            <h3 className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
              Position Summary
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between text-[9px]">
                <span className="text-muted-foreground">Symbol</span>
                <span className="font-mono text-foreground font-semibold">{symbol}</span>
              </div>
              <div className="flex justify-between text-[9px]">
                <span className="text-muted-foreground">Direction</span>
                <span className={`font-mono font-semibold ${direction === "long" ? "text-emerald-500" : "text-destructive"}`}>
                  {direction?.toUpperCase() ?? "—"}
                </span>
              </div>
              {entryPrice && (
                <div className="flex justify-between text-[9px]">
                  <span className="text-muted-foreground">Entry</span>
                  <span className="font-mono text-foreground">{fmtPrice(entryPrice, marketType)}</span>
                </div>
              )}
              {currentPrice && (
                <div className="flex justify-between text-[9px]">
                  <span className="text-muted-foreground">Current</span>
                  <span className="font-mono text-foreground">{fmtPrice(currentPrice, marketType)}</span>
                </div>
              )}
              {trailPrice && (
                <div className="flex justify-between text-[9px] border-t border-border/20 pt-2">
                  <span className="text-muted-foreground">Trailed SL</span>
                  <span className="font-mono text-amber-400">{fmtPrice(trailPrice, marketType)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Strategy context */}
          {strategyPrimary && (
            <div className="rounded-sm border border-border/30 bg-card/40 p-4">
              <h3 className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                Entry Model
              </h3>
              <p className="text-[10px] font-semibold text-foreground">{strategyPrimary.strategyName}</p>
              <p className="text-[8px] text-muted-foreground mt-0.5 font-mono">{strategyPrimary.strategyId}</p>
            </div>
          )}

          {/* Risk */}
          <div className="rounded-sm border border-border/30 bg-card/40 p-4">
            <h3 className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
              Risk Parameters
            </h3>
            <div className="space-y-1.5">
              <div className="flex justify-between text-[9px]">
                <span className="text-muted-foreground">Position Size</span>
                <span className="font-mono text-foreground">{profile.risk.positionSizePercent}%</span>
              </div>
              <div className="flex justify-between text-[9px]">
                <span className="text-muted-foreground">Min R:R</span>
                <span className="font-mono text-foreground">1:{profile.risk.minRR}</span>
              </div>
              <div className="flex justify-between text-[9px]">
                <span className="text-muted-foreground">Daily Trades</span>
                <span className="font-mono text-foreground">{profile.risk.maxDailyTrades} max</span>
              </div>
            </div>
          </div>

          {/* TP management */}
          {targets.length > 0 && currentPrice && stopLoss && entryPrice && (
            <div className="rounded-sm border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-2">
              <h3 className="text-[9px] font-semibold uppercase tracking-widest text-emerald-500">Trade Management</h3>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    pushTimelineEvent({
                      type: "alert",
                      title: `TP1 Hit — moved SL to breakeven`,
                      description: `${fmtPrice(targets[0], marketType)} reached`,
                      symbol, price: targets[0], actionable: false,
                    });
                    // Move SL to breakeven
                    if (entryPrice) setTradeLevels(entryPrice, entryPrice, targets.slice(1));
                  }}
                  className="px-3 py-2 rounded-sm bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-500 font-semibold hover:bg-emerald-500/15 transition-colors"
                  title={`Move SL to entry (${entryPrice ? fmtPrice(entryPrice, marketType) : "—"}) — exiting TP1`}
                >
                  🎯 TP1 Hit (SL→BE)
                </button>
                <button
                  onClick={() => {
                    pushTimelineEvent({
                      type: "alert",
                      title: `Half position closed`,
                      description: `Closed 50% at ${fmtPrice(currentPrice, marketType)}`,
                      symbol, price: currentPrice, actionable: false,
                    });
                  }}
                  className="px-3 py-2 rounded-sm bg-amber-400/10 border border-amber-400/20 text-[10px] text-amber-400 font-semibold hover:bg-amber-400/15 transition-colors"
                >
                  📉 Close Half
                </button>
              </div>
              {targets.length > 1 && (
                <div className="text-[8px] text-muted-foreground text-center">
                  TP2: {fmtPrice(targets[1], marketType)} · SL now at {stopLoss ? fmtPrice(stopLoss, marketType) : "—"}
                </div>
              )}
            </div>
          )}

          {/* Close position */}
          <div className="space-y-2">
            <button
              onClick={handleClose}
              className={`w-full p-3 rounded-sm border text-[10px] font-bold transition-all ${
                confirmClose
                  ? "bg-destructive/20 border-destructive text-destructive animate-pulse"
                  : "bg-destructive/10 border-destructive/30 text-destructive hover:bg-destructive/15"
              }`}
            >
              {confirmClose ? "⚠ Confirm Close Position" : "Close Position"}
            </button>
            {confirmClose && (
              <button
                onClick={() => setConfirmClose(false)}
                className="w-full p-2 rounded-sm bg-muted/20 border border-border/30 text-[9px] text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
            )}
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
        <button onClick={() => openEvidence("risk")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-muted/20 border border-border/30 text-[10px] text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors">
          📋 Risk Evidence
        </button>
      </div>
    </div>
  );
}

export default InTradeView;
