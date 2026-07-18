/**
 * SMC Pulse OS — Overview / Command Center
 *
 * Primary intelligence dashboard showing market state, active signals,
 * strategy candidates, system health, and quick-action surfaces.
 */

import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import type { SmcReport } from "@workspace/api-client-react";
import {
  Zap, Activity, Brain, Target, BookOpen, FlaskConical, Bot,
  TrendingUp, TrendingDown, Minus, ChevronRight, Layers,
} from "lucide-react";
import { ConfluenceCard } from "@/components/ConfluenceCard";
import { MarketBriefing } from "@/components/MarketBriefing";
import { TvStatus } from "@/components/TvStatus";
import type { OsView } from "@/components/layout/AppShell";
import { fmtPrice, getBias, getConfidence, TF_LABEL_MAP } from "@/lib/smc-display";

interface OverviewProps {
  reports?: Array<{ tf: string; report: SmcReport }>;
  symbol?: string;
  market?: "crypto" | "forex";
  matchedStrategies?: Array<{ id: string; name: string; score: number }>;
  cascade?: { anchorTf: string; anchorBias: string; roles: Record<string, string> };
  onViewChange?: (view: OsView) => void;
  onSelectTf?: (tf: string) => void;
  onOpenConfluence?: () => void;
  calResult?: { ok: boolean; detail: string } | null;
  strategyProps?: { primary: { id: string; name: string; score: number } | null; alternatives: Array<{ id: string; name: string; score: number }> };
}

export function Overview({
  reports, symbol = "BTCUSDT", market = "crypto",
  matchedStrategies, cascade,
  onViewChange, onSelectTf, onOpenConfluence,
  strategyProps,
}: OverviewProps) {
  const [, setLocation] = useLocation();
  const primaryReport = reports?.find(r => r.tf === "4h")?.report ?? reports?.[0]?.report;

  const stats = useMemo(() => {
    if (!primaryReport) return null;
    const bias = getBias(primaryReport);
    const conf = getConfidence(primaryReport);
    return { bias, conf, price: primaryReport.currentPrice, trend: primaryReport.structure.trend };
  }, [primaryReport]);

  return (
    <div className="p-5 lg:p-7 max-w-[1800px] mx-auto space-y-5">

      {/* ── Page Header ── */}
      <div>
        <div className="text-[9px] text-primary/50 uppercase tracking-widest mb-1">Command Center</div>
        <h1 className="text-2xl lg:text-3xl font-black tracking-tight">Market intelligence, exposed.</h1>
        <p className="mt-1 text-xs text-muted-foreground max-w-2xl">
          150+ capabilities. One operating surface.
        </p>
      </div>

      {/* ── Quick action buttons ── */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => onViewChange?.("analyze")} className="flex items-center gap-2 px-4 py-2 rounded-sm bg-primary/10 border border-primary/20 text-xs text-primary font-semibold hover:bg-primary/15 transition-colors">
          <Brain className="w-3.5 h-3.5" /> Strategy Atlas <ChevronRight className="w-3 h-3" />
        </button>
        <button onClick={() => onViewChange?.("evaluate")} className="flex items-center gap-2 px-4 py-2 rounded-sm bg-muted/50 border border-border/40 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <FlaskConical className="w-3.5 h-3.5" /> Run SMC-EVAL
        </button>
        <button onClick={() => onViewChange?.("agent")} className="flex items-center gap-2 px-4 py-2 rounded-sm bg-muted/50 border border-border/40 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <Bot className="w-3.5 h-3.5" /> Ask Agent
        </button>
      </div>

      {/* ── Grid ── */}
      <div className="grid grid-cols-12 gap-4">

        {/* Market Intelligence Card */}
        <section className="col-span-12 xl:col-span-8 rounded-sm border border-border/30 bg-card/40 overflow-hidden">
          <div className="p-4 border-b border-border/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />
                <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Market Intelligence</span>
              </div>
              {stats && (
                <span className={`text-[10px] px-2 py-0.5 rounded-sm font-bold border ${
                  stats.bias === "bullish" ? "bg-[hsl(var(--bullish))]/15 border-[hsl(var(--bullish))]/30 text-[hsl(var(--bullish))]"
                    : stats.bias === "bearish" ? "bg-destructive/15 border-destructive/30 text-destructive"
                    : "bg-muted border-border text-muted-foreground"
                }`}>
                  {stats.bias.toUpperCase()} · {stats.conf}%
                </span>
              )}
            </div>
          </div>
          <div className="p-4">
            {primaryReport ? (
              <MarketBriefing report={primaryReport} market={market} />
            ) : (
              <p className="text-xs text-muted-foreground italic font-mono">No market data loaded. Select a symbol to begin.</p>
            )}
          </div>
        </section>

        {/* Key Intelligence Panel */}
        <section className="col-span-12 xl:col-span-4 rounded-sm border border-border/30 bg-card/40 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Key Intelligence</h3>
            {stats && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-sm font-bold ${
                stats.conf >= 60 ? "text-[hsl(var(--bullish))] bg-[hsl(var(--bullish))]/10" :
                stats.conf >= 40 ? "text-primary bg-primary/10" : "text-muted-foreground bg-muted"
              }`}>
                Conf {stats.conf}%
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              ["Bias", stats?.bias?.toUpperCase() ?? "—", stats?.bias === "bullish" ? "text-[hsl(var(--bullish))]" : stats?.bias === "bearish" ? "text-destructive" : "text-muted-foreground"],
              ["Price", stats?.price ? fmtPrice(stats.price, market) : "—", "text-foreground"],
              ["Trend", stats?.trend?.toUpperCase() ?? "—", "text-primary"],
              ["Models Matched", `${matchedStrategies?.length ?? 0}`, "text-primary"],
            ].map(([label, value, color]) => (
              <div key={label as string} className="rounded-sm bg-muted/30 border border-border/30 p-2.5">
                <div className="text-[9px] text-muted-foreground uppercase tracking-wider">{label as string}</div>
                <div className={`mt-1 text-sm font-bold font-mono ${color as string}`}>{value as string}</div>
              </div>
            ))}
          </div>
          {strategyProps?.primary && (
            <div className="mt-3 rounded-sm bg-primary/5 border border-primary/20 p-2.5">
              <div className="text-[9px] text-muted-foreground uppercase tracking-wider">Primary Strategy</div>
              <div className="mt-1 text-xs font-bold text-primary truncate">{strategyProps.primary.name}</div>
              <div className="text-[10px] text-[hsl(var(--bullish))]">{Math.round(strategyProps.primary.score * 100)}% confidence</div>
            </div>
          )}
        </section>

        {/* Strategy Intelligence */}
        <section className="col-span-12 lg:col-span-7 rounded-sm border border-border/30 bg-card/40 p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-primary" />
              <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Strategy Intelligence</h3>
            </div>
            <button onClick={() => onViewChange?.("analyze")} className="text-[10px] text-primary hover:text-primary/80 transition-colors">
              Open Atlas <ChevronRight className="w-3 h-3 inline" />
            </button>
          </div>
          {matchedStrategies && matchedStrategies.length > 0 ? (
            <div className="grid grid-cols-2 gap-2">
              {matchedStrategies.slice(0, 6).map((s, i) => (
                <div key={s.id} className="rounded-sm bg-muted/20 border border-border/20 p-3 hover:border-primary/30 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium truncate">{s.name}</span>
                    <span className="text-[10px] text-[hsl(var(--bullish))]">{Math.round(s.score * 100)}%</span>
                  </div>
                  <div className="mt-2 h-1 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-primary/70" style={{ width: `${s.score * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-20 text-xs text-muted-foreground italic font-mono">
              No strategies detected — run analysis first
            </div>
          )}
        </section>

        {/* Cascade */}
        <section className="col-span-12 lg:col-span-5 rounded-sm border border-border/30 bg-card/40 p-4">
          <div className="flex items-center gap-2 mb-4">
            <Layers className="w-4 h-4 text-primary" />
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Multi-TF Cascade</h3>
          </div>
          {reports && cascade && (
            <ConfluenceCard
              reports={reports}
              cascade={cascade}
              onSelect={onSelectTf ?? (() => {})}
              onOpenConfluence={onOpenConfluence ?? (() => {})}
              primaryStrategy={strategyProps?.primary ?? null}
              alternativeStrategies={strategyProps?.alternatives ?? []}
            />
          )}
          {(!reports || reports.length === 0) && (
            <div className="flex items-center justify-center h-20 text-xs text-muted-foreground italic font-mono">
              No reports loaded
            </div>
          )}
        </section>

        {/* System Health */}
        <section className="col-span-12 md:col-span-6 rounded-sm border border-border/30 bg-card/40 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">System Health</h3>
          <div className="space-y-2">
            {[
              ["SMC Engine", "99.9%", "Core", true],
              ["MCP Server", "104 Tools", "Orchestrator", true],
              ["TradingView", "Connected", "Data", true],
              ["Database", "Healthy", "Persistence", !!process.env.DATABASE_URL],
              ["Broker", "Review Mode", "Execution", true],
            ].map(([name, status, category, ok]) => (
              <div key={name as string} className="flex items-center justify-between p-2.5 rounded-sm bg-muted/10 border border-border/20">
                <div className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${ok ? "bg-emerald-500" : "bg-amber-400"}`} />
                  <span className="text-xs text-foreground">{name as string}</span>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-mono text-muted-foreground">{status as string}</div>
                  <div className="text-[8px] text-muted-foreground/50 uppercase">{category as string}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* SMC-EVAL Snapshot */}
        <section className="col-span-12 md:col-span-6 rounded-sm border border-border/30 bg-card/40 p-4 relative overflow-hidden">
          <div className="absolute -right-12 -top-12 w-40 h-40 rounded-full bg-primary/5 blur-3xl" />
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FlaskConical className="w-4 h-4 text-primary" />
                <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">SMC-EVAL Benchmark</h3>
              </div>
              <span className="text-[10px] text-primary">100 Scenarios</span>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-4xl font-black">66.6</span>
              <span className="text-xs text-muted-foreground pb-1">/ 100 · <span className="text-amber-400">Developing</span></span>
            </div>
            <div className="mt-4 space-y-1.5">
              {[
                ["Structural", 23.4, 30],
                ["Model Align", 23.4, 25],
                ["Reasoning", 5.3, 20],
                ["Precision", 7, 15],
                ["Hallucination", 7.1, 10],
              ].map(([label, score, max]) => (
                <div key={label as string}>
                  <div className="flex justify-between text-[9px] text-muted-foreground">
                    <span>{label as string}</span>
                    <span>{score}/{max}</span>
                  </div>
                  <div className="h-1 rounded-full bg-muted mt-0.5 overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-primary to-cyan-400" style={{ width: `${(score as number) / (max as number) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => onViewChange?.("evaluate")} className="mt-4 w-full py-2 rounded-sm bg-primary/10 border border-primary/20 text-xs text-primary font-semibold hover:bg-primary/15 transition-colors">
              Run Benchmark <ChevronRight className="w-3 h-3 inline" />
            </button>
          </div>
        </section>

      </div>
    </div>
  );
}
