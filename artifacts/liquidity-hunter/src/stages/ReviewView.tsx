/**
 * ReviewView — post-trade analysis.
 *
 * Renders when narrativeStage === "REVIEW".
 * Shows trade outcome, timeline reconstruction, evidence chain,
 * model alignment, and journal entry prompt.
 */

import { useMemo, useState } from "react";
import { useMarketStore } from "@/state/market-store";
import { useNarrativeStage } from "@/hooks/useNarrativeStage";
import { SessionFlowIndicator } from "@/panels/SessionFlowIndicator";
import { fmtPrice, TF_LABEL_MAP } from "@/lib/smc-display";
import { STAGE_LABELS } from "@/state/narrative";
import { getCapabilitiesForStage } from "@/state/capabilities";
import type { SmcReport } from "@workspace/api-client-react";
import type { Market } from "@/lib/smc-display";

// ── Component ─────────────────────────────────────────────────────────────────

export function ReviewView() {
  const reports = useMarketStore((s) => s.reports);
  const symbol = useMarketStore((s) => s.symbol);
  const marketType = useMarketStore((s) => s.marketType) as Market;
  const timeline = useMarketStore((s) => s.timeline);
  const strategyPrimary = useMarketStore((s) => s.strategyPrimary);
  const toggleChart = useMarketStore((s) => s.toggleChart);
  const toggleDecisionFunnel = useMarketStore((s) => s.toggleDecisionFunnel);
  const openEvidence = useMarketStore((s) => s.openEvidence);
  const entryPrice = useMarketStore((s) => s.currentEntryPrice);
  const stopLoss = useMarketStore((s) => s.currentStopLoss);
  const targets = useMarketStore((s) => s.currentTargets);
  const { stage, reasoning, availableCapabilities } = useNarrativeStage();

  const [journalText, setJournalText] = useState("");

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

  // ── Reconstruct trade timeline ──
  const tradeEvents = useMemo(() => {
    // Find the most recent trade_opened → trade_closed pair, or trade_opened through end
    const openedIdx = [...timeline].reverse().findIndex((e) => e.type === "trade_opened");
    if (openedIdx === -1) return timeline.slice(0, 15).reverse();
    const startFrom = timeline.length - 1 - openedIdx;
    const closedIdx = timeline.slice(startFrom).findIndex((e) => e.type === "trade_closed");
    const endAt = closedIdx === -1 ? timeline.length : startFrom + closedIdx + 1;
    return timeline.slice(startFrom, endAt).reverse();
  }, [timeline]);

  // ── Trade outcome estimation ──
  const outcome = useMemo(() => {
    const closeEvent = timeline.find((e) => e.type === "trade_closed");
    const openEvent = timeline.find((e) => e.type === "trade_opened");
    if (closeEvent?.price && openEvent?.price) {
      const pct = ((closeEvent.price - openEvent.price) / openEvent.price) * 100;
      const isWin = pct > 0;
      return { pct, price: closeEvent.price, isWin, hasData: true };
    }
    // Fallback: estimate from current anchor price vs entry
    if (entryPrice && anchor?.currentPrice) {
      const pct = ((anchor.currentPrice - entryPrice) / entryPrice) * 100;
      return { pct, price: anchor.currentPrice, isWin: pct > 0, hasData: true };
    }
    return null;
  }, [timeline, entryPrice, anchor]);

  // ── R:R achieved ──
  const rrAchieved = useMemo(() => {
    if (!outcome?.hasData || !entryPrice || !stopLoss) return null;
    const reward = Math.abs(outcome.price - entryPrice);
    const risk = Math.abs(entryPrice - stopLoss);
    if (risk === 0) return null;
    return reward / risk;
  }, [outcome, entryPrice, stopLoss]);

  // ── Evidence chain from strategy ──
  const evidenceChain = useMemo(() => {
    if (!strategyPrimary?.evidence) return [];
    return strategyPrimary.evidence;
  }, [strategyPrimary]);

  // ── Model alignment ──
  const modelAlignment = useMemo(() => {
    if (!strategyPrimary) return { aligned: null, name: null, score: null };
    const score = strategyPrimary.score ?? 0;
    return {
      aligned: score >= 0.5,
      name: strategyPrimary.strategyName,
      score,
    };
  }, [strategyPrimary]);

  // ── Journal template ──
  const journalTemplate = useMemo(() => {
    const date = new Date().toISOString().split("T")[0];
    const dir = entryPrice && targets[0] ? (targets[0] > entryPrice ? "LONG" : "SHORT") : "";
    return `${date} | ${symbol} | ${dir}
Entry: ${entryPrice ? fmtPrice(entryPrice, marketType) : "—"}
Exit: ${outcome?.price ? fmtPrice(outcome.price, marketType) : "—"}
R:R Achieved: ${rrAchieved ? `1:${rrAchieved.toFixed(2)}` : "—"}
Model: ${strategyPrimary?.strategyName ?? "Manual"}

What worked:
-

What didn't:
-

Notes:
-`;
  }, [symbol, entryPrice, outcome, rrAchieved, strategyPrimary, marketType, targets]);

  const ICONS: Record<string, string> = {
    trade_opened: "🔵",
    trade_closed: "🔴",
    entry_ready: "🟢",
    signal_generated: "📡",
    liquidity_sweep: "🟡",
    structure_break: "🔷",
    displacement: "💨",
    mss_confirmed: "🔶",
    fvg_formed: "🟩",
    alert: "🔔",
    session_open: "▶️",
    system: "⚙️",
  };

  return (
    <div className="flex-1 overflow-y-auto p-5 lg:p-7 max-w-[1200px]">
      {/* ── Header ── */}
      <div className="mb-5">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-sm bg-muted/20 border border-border/30">
            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              {STAGE_LABELS[stage]}
            </span>
          </div>
          <SessionFlowIndicator />
        </div>
        <h1 className="text-xl lg:text-2xl font-black tracking-tight">{symbol}</h1>
        <p className="mt-1 text-xs text-muted-foreground">{reasoning}</p>
      </div>

      <div className="grid grid-cols-12 gap-4">

        {/* ── Main column ── */}
        <section className="col-span-12 lg:col-span-7 space-y-4">

          {/* Outcome card */}
          <div className={`rounded-sm border-2 p-6 text-center ${
            outcome?.isWin
              ? "border-emerald-500/30 bg-gradient-to-br from-emerald-500/[0.06] to-transparent"
              : outcome
                ? "border-destructive/30 bg-gradient-to-br from-destructive/[0.06] to-transparent"
                : "border-border/30 bg-card/40"
          }`}>
            <div className="text-3xl mb-2">
              {outcome?.isWin ? "🏆" : outcome ? "⚠️" : "📊"}
            </div>
            {outcome ? (
              <>
                <div className={`text-3xl font-black font-mono ${outcome.isWin ? "text-emerald-500" : "text-destructive"}`}>
                  {outcome.isWin ? "WIN" : "LOSS"}
                </div>
                <div className={`mt-1 text-lg font-mono ${outcome.isWin ? "text-emerald-500" : "text-destructive"}`}>
                  {outcome.pct >= 0 ? "+" : ""}{outcome.pct.toFixed(2)}%
                </div>
                {rrAchieved != null && (
                  <div className="mt-1 text-[10px] text-muted-foreground font-mono">
                    {rrAchieved >= 1 ? `+${rrAchieved.toFixed(1)}R` : `${rrAchieved.toFixed(1)}R`}
                  </div>
                )}
              </>
            ) : (
              <div className="text-xl font-bold text-muted-foreground">No trade data</div>
            )}
          </div>

          {/* Trade timeline reconstruction */}
          {tradeEvents.length > 0 && (
            <div className="rounded-sm border border-border/30 bg-card/40 overflow-hidden">
              <div className="p-4 border-b border-border/20">
                <h3 className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Trade Timeline
                </h3>
              </div>
              <div className="p-4">
                <div className="space-y-0">
                  {tradeEvents.map((evt, i) => (
                    <div key={evt.id} className="flex items-start gap-3 py-2">
                      {/* Timeline line */}
                      <div className="flex flex-col items-center shrink-0">
                        <span className="text-xs">{ICONS[evt.type] ?? "●"}</span>
                        {i < tradeEvents.length - 1 && (
                          <div className="w-px h-full min-h-[12px] bg-border/50 mt-0.5" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0 pb-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-semibold text-foreground">{evt.title}</span>
                          <span className="text-[7px] text-muted-foreground font-mono">
                            {new Date(evt.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                          </span>
                        </div>
                        <p className="text-[8px] text-muted-foreground mt-0.5 line-clamp-1">
                          {evt.description}
                        </p>
                        {evt.price != null && (
                          <span className="text-[7px] text-muted-foreground font-mono">
                            {fmtPrice(evt.price, marketType)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Evidence chain */}
          {evidenceChain.length > 0 && (
            <div className="rounded-sm border border-border/30 bg-card/40 p-4">
              <h3 className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                Evidence Chain
              </h3>
              <div className="space-y-1.5">
                {evidenceChain.slice(0, 8).map((ev, i) => (
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
            </div>
          )}

        </section>

        {/* ── Right column ── */}
        <section className="col-span-12 lg:col-span-5 space-y-4">

          {/* Model alignment */}
          <div className={`rounded-sm border p-4 ${
            modelAlignment.aligned === true
              ? "bg-emerald-500/5 border-emerald-500/20"
              : modelAlignment.aligned === false
                ? "bg-amber-400/5 border-amber-400/20"
                : "bg-muted/20 border-border/20"
          }`}>
            <h3 className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
              Model Alignment
            </h3>
            {modelAlignment.name ? (
              <>
                <p className="text-[10px] font-semibold text-foreground">{modelAlignment.name}</p>
                {modelAlignment.score != null && (
                  <div className="mt-1 flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full ${modelAlignment.score >= 0.7 ? "bg-emerald-500" : "bg-amber-400"}`}
                        style={{ width: `${Math.round(modelAlignment.score * 100)}%` }}
                      />
                    </div>
                    <span className="text-[9px] font-bold text-muted-foreground font-mono">
                      {Math.round(modelAlignment.score * 100)}%
                    </span>
                  </div>
                )}
                <div className="mt-2">
                  <span className={`text-[9px] font-bold ${
                    modelAlignment.aligned ? "text-emerald-500" : "text-amber-400"
                  }`}>
                    {modelAlignment.aligned ? "✓ Trade aligned with model" : "⚠ Trade deviated from model"}
                  </span>
                </div>
              </>
            ) : (
              <p className="text-[10px] text-muted-foreground">Manual entry — no model detected.</p>
            )}
          </div>

          {/* Trade stats */}
          <div className="rounded-sm border border-border/30 bg-card/40 p-4">
            <h3 className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
              Trade Summary
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between text-[9px]">
                <span className="text-muted-foreground">Symbol</span>
                <span className="font-mono text-foreground">{symbol}</span>
              </div>
              {entryPrice && (
                <div className="flex justify-between text-[9px]">
                  <span className="text-muted-foreground">Entry</span>
                  <span className="font-mono text-foreground">{fmtPrice(entryPrice, marketType)}</span>
                </div>
              )}
              {outcome?.price && (
                <div className="flex justify-between text-[9px]">
                  <span className="text-muted-foreground">Exit</span>
                  <span className="font-mono text-foreground">{fmtPrice(outcome.price, marketType)}</span>
                </div>
              )}
              {rrAchieved != null && (
                <div className="flex justify-between text-[9px]">
                  <span className="text-muted-foreground">R:R Achieved</span>
                  <span className={`font-mono font-semibold ${rrAchieved >= 1 ? "text-emerald-500" : "text-destructive"}`}>
                    1:{rrAchieved.toFixed(2)}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-[9px]">
                <span className="text-muted-foreground">Events</span>
                <span className="font-mono text-foreground">{tradeEvents.length}</span>
              </div>
            </div>
          </div>

          {/* Lessons */}
          <div className="rounded-sm border border-border/30 bg-card/40 p-4">
            <h3 className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
              Lessons
            </h3>
            {outcome?.isWin ? (
              <ul className="space-y-1 text-[9px] text-muted-foreground">
                <li>• Model alignment reinforced</li>
                <li>• Entry timing validated</li>
                <li>• Review: could you scale in?</li>
              </ul>
            ) : (
              <ul className="space-y-1 text-[9px] text-muted-foreground">
                <li>• Which prerequisite failed?</li>
                <li>• Was the session right?</li>
                <li>• Check HTF structure alignment</li>
                <li>• Did you override the system?</li>
              </ul>
            )}
          </div>

          {/* Journal prompt */}
          <div className="rounded-sm border border-border/30 bg-card/40 p-4">
            <h3 className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
              Journal Entry
            </h3>
            <textarea
              value={journalText || journalTemplate}
              onChange={(e) => setJournalText(e.target.value)}
              rows={6}
              className="w-full rounded-sm bg-muted/20 border border-border/20 p-2 text-[9px] font-mono text-foreground resize-y focus:outline-none focus:border-primary/30"
            />
            <button
              onClick={() => {
                // In future: POST to /api/agent-loop/memory
                setJournalText("");
              }}
              className="mt-2 w-full py-1.5 rounded-sm bg-primary/10 border border-primary/20 text-[9px] text-primary font-semibold hover:bg-primary/15 transition-colors"
            >
              Save to Journal
            </button>
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
        <button onClick={() => openEvidence("model-spec")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-muted/20 border border-border/30 text-[10px] text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors">
          📋 Model Spec
        </button>
      </div>
    </div>
  );
}

export default ReviewView;
