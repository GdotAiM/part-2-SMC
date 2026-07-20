/**
 * ScanningView — default market observation state.
 *
 * Shows session context, HTF bias, key liquidity levels, and available
 * capabilities. Calm, informative, not actionable.
 */

import { useMarketStore } from "@/state/market-store";
import { useNarrativeStage } from "@/hooks/useNarrativeStage";
import { SessionFlowIndicator } from "@/panels/SessionFlowIndicator";
import { fmtPrice, getBias, getConfidence, TF_LABEL_MAP } from "@/lib/smc-display";
import { getCapabilitiesForStage } from "@/state/capabilities";
import type { SmcReport } from "@workspace/api-client-react";

function BiasBadge({ report, market }: { report: SmcReport; market: string }) {
  const bias = getBias(report);
  const conf = getConfidence(report);
  const colors = {
    bullish: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    bearish: "bg-destructive/10 text-destructive border-destructive/20",
    neutral: "bg-muted text-muted-foreground border-border",
  };
  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm border ${colors[bias]}`}>
      <span className={`text-[10px] ${bias === "bullish" ? "text-emerald-500" : bias === "bearish" ? "text-destructive" : ""}`}>
        {bias === "bullish" ? "▲" : bias === "bearish" ? "▼" : "◆"}
      </span>
      <span className="text-[10px] font-bold uppercase tracking-wider">{bias}</span>
      <span className="text-[9px] font-mono opacity-70">{conf}%</span>
      <span className="text-[8px] text-muted-foreground font-mono">{fmtPrice(report.currentPrice, market as "crypto" | "forex")}</span>
    </div>
  );
}

export function ScanningView() {
  const reports = useMarketStore((s) => s.reports);
  const symbol = useMarketStore((s) => s.symbol);
  const marketType = useMarketStore((s) => s.marketType);
  const toggleDecisionFunnel = useMarketStore((s) => s.toggleDecisionFunnel);
  const toggleChart = useMarketStore((s) => s.toggleChart);
  const openEvidence = useMarketStore((s) => s.openEvidence);
  const { reasoning, stage } = useNarrativeStage();

  const availableCaps = getCapabilitiesForStage(stage);
  const sortedTfs = Object.entries(reports)
    .filter(([, r]) => r !== null)
    .sort(([a], [b]) => ({ "1w": 7, "1d": 6, "4h": 5, "1h": 4, "15m": 3, "5m": 2, "1m": 1 }[b] ?? 0) -
                        ({ "1w": 7, "1d": 6, "4h": 5, "1h": 4, "15m": 3, "5m": 2, "1m": 1 }[a] ?? 0));

  const anchorReport = sortedTfs[0]?.[1];

  return (
    <div className="flex-1 overflow-y-auto p-5 lg:p-7 max-w-[1200px]">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-sm bg-muted/30 border border-border/40">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-semibold text-emerald-500 uppercase tracking-wider">Scanning</span>
          </div>
          <SessionFlowIndicator />
        </div>
        <h1 className="text-xl lg:text-2xl font-black tracking-tight">{symbol}</h1>
        <p className="mt-1 text-xs text-muted-foreground">{reasoning}</p>
      </div>

      {/* Bias cards (per TF) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-6">
        {sortedTfs.map(([tf, report]) => {
          const rep = report!;
          return (
          <button
            key={tf}
            onClick={() => openEvidence(`tf-${tf}`)}
            className="rounded-sm border border-border/20 bg-card/30 p-3 text-left hover:border-primary/30 hover:bg-muted/20 transition-colors group"
          >
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
                {TF_LABEL_MAP[tf] ?? tf}
              </span>
              <span className="text-[8px] text-muted-foreground/50 group-hover:text-primary/50">→</span>
            </div>
            <div className={`text-[11px] font-bold mt-1 ${
              rep.structure.bias === "bullish" ? "text-emerald-500" :
              rep.structure.bias === "bearish" ? "text-destructive" : "text-muted-foreground"
            }`}>
              {rep.structure.bias.toUpperCase()}
            </div>
            <div className="mt-1.5 h-1 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  rep.structure.confidence > 0.6 ? "bg-emerald-500" :
                  rep.structure.confidence > 0.3 ? "bg-primary" : "bg-muted-foreground/30"
                }`}
                style={{ width: `${Math.round(rep.structure.confidence * 100)}%` }}
              />
            </div>
            <div className="text-[8px] text-muted-foreground mt-1">
              {Math.round(rep.structure.confidence * 100)}% conf
            </div>
          </button>
          );
        })}
        {sortedTfs.length === 0 && (
          <div className="col-span-full flex items-center justify-center h-24 text-xs text-muted-foreground italic font-mono">
            No data loaded yet. Select a symbol to begin.
          </div>
        )}
      </div>

      {/* Key levels */}
      {anchorReport && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Nearest liquidity */}
          <div className="rounded-sm border border-border/30 bg-card/40 p-4">
            <h3 className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Key Liquidity</h3>
            <div className="space-y-2">
              {anchorReport.liquidity.pools.slice(0, 4).map((pool, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 border-b border-border/20 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${pool.type === "BSL" ? "bg-emerald-500" : "bg-destructive"}`} />
                    <span className="text-[10px] text-muted-foreground">{pool.type}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-semibold">{fmtPrice(pool.price, marketType)}</span>
                    {pool.wasSwept && <span className="text-[8px] text-emerald-500">SWEPT</span>}
                    {!pool.wasSwept && (pool.probabilityOfSweep ?? 0) > 0 && (
                      <span className="text-[8px] text-muted-foreground">{Math.round((pool.probabilityOfSweep ?? 0) * 100)}%</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Market context */}
          <div className="rounded-sm border border-border/30 bg-card/40 p-4">
            <h3 className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Market Context</h3>
            <div className="space-y-2">
              {[
                ["Daily Bias", `${anchorReport.dailyBias.bias.toUpperCase()} · ${Math.round(anchorReport.dailyBias.strength * 100)}% · ${anchorReport.dailyBias.consecutiveDays}d streak`],
                ["PD Array", anchorReport.pdArray.currentBias?.toUpperCase() ?? "—"],
                ["Equilibrium", fmtPrice(anchorReport.pdArray.equilibrium, marketType)],
                ["SMT", anchorReport.smt?.detected ? `Detected (${anchorReport.smt.type})` : "None"],
                ["Session", anchorReport.sessionState ?? "—"],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between py-1.5 border-b border-border/20 last:border-0">
                  <span className="text-[9px] text-muted-foreground">{label}</span>
                  <span className="text-[10px] font-mono font-semibold text-foreground">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Available capabilities */}
      <div className="rounded-sm border border-border/30 bg-card/40 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
            Capabilities Available Now
          </h3>
          <span className="text-[8px] text-primary">{availableCaps.length} available</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {availableCaps.slice(0, 8).map((cap) => (
            <button
              key={cap.id}
              onClick={toggleDecisionFunnel}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm bg-muted/20 border border-border/30 text-[9px] text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
            >
              <span>{cap.icon}</span>
              <span>{cap.name}</span>
            </button>
          ))}
        </div>
        <button
          onClick={toggleDecisionFunnel}
          className="mt-2 text-[8px] text-primary hover:text-primary/80 transition-colors"
        >
          Open Decision Funnel for full cascade →
        </button>
      </div>
    </div>
  );
}
