/**
 * Market Intelligence View
 *
 * Dedicated market exploration surface with symbol selection,
 * structure, liquidity, and multi-timeframe context.
 */

import type { SmcReport } from "@workspace/api-client-react";
import { Activity } from "lucide-react";
import { MarketBriefing } from "@/components/MarketBriefing";
import { TvStatus } from "@/components/TvStatus";
import { fmtPrice, getBias, getConfidence, TF_LABEL_MAP, type Market } from "@/lib/smc-display";

interface MarketViewProps {
  symbol: string;
  market: Market;
  onSymbolChange: (symbol: string) => void;
  onMarketChange: (market: Market) => void;
  report?: SmcReport;
  isLoading?: boolean;
}

export function MarketView({ symbol, market, onSymbolChange, onMarketChange, report, isLoading }: MarketViewProps) {
  const bias = report ? getBias(report) : "neutral";
  const conf = report ? getConfidence(report) : 0;
  const price = report?.currentPrice;

  return (
    <div className="p-5 lg:p-7 max-w-[1800px] mx-auto space-y-5">
      <div>
        <div className="text-[9px] text-primary/50 uppercase tracking-widest mb-1">Market Intelligence</div>
        <h1 className="text-2xl lg:text-3xl font-black tracking-tight">The system sees the market.</h1>
        <p className="mt-1 text-xs text-muted-foreground max-w-2xl">
          Live market context, session intelligence, and structural analysis in one surface.
        </p>
      </div>

      {/* Symbol bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex rounded-sm overflow-hidden border border-border">
          {(["crypto", "forex"] as Market[]).map(m => (
            <button key={m} onClick={() => onMarketChange(m)}
              className={`px-3 py-1 text-xs font-bold uppercase tracking-wider transition-colors ${
                market === m ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
              }`}>
              {m}
            </button>
          ))}
        </div>
        <select value={symbol} onChange={e => onSymbolChange(e.target.value)}
          className="bg-muted border border-border text-xs rounded-sm px-2 py-1 font-semibold">
          {market === "crypto"
            ? ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT"].map(s => <option key={s} value={s}>{s}</option>)
            : ["EURUSD=X", "GBPUSD=X", "USDJPY=X", "AUDUSD=X", "USDCAD=X"].map(s => <option key={s} value={s}>{s}</option>)
          }
        </select>
        {report && (
          <div className="flex items-center gap-2 px-3 py-1 rounded-sm bg-muted/30 border border-border/40">
            <Activity className="w-3 h-3 text-primary" />
            <span className="text-xs font-mono">{fmtPrice(price ?? 0, market)}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-sm font-bold ${
              bias === "bullish" ? "bg-[hsl(var(--bullish))]/15 text-[hsl(var(--bullish))]" :
              bias === "bearish" ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground"
            }`}>{bias.toUpperCase()}</span>
            <span className="text-[9px] text-muted-foreground">Conf {conf}%</span>
          </div>
        )}
        <TvStatus />
      </div>

      {/* Content */}
      <div className="grid grid-cols-12 gap-4">
        <section className="col-span-12 xl:col-span-8 rounded-sm border border-border/30 bg-card/40 p-4">
          {report ? (
            <MarketBriefing report={report} market={market} />
          ) : isLoading ? (
            <div className="flex items-center justify-center h-40 text-xs text-muted-foreground italic font-mono animate-pulse">
              Loading market data...
            </div>
          ) : (
            <div className="flex items-center justify-center h-40 text-xs text-muted-foreground italic font-mono">
              Select a symbol to begin analysis
            </div>
          )}
        </section>

        {/* Key metrics */}
        <section className="col-span-12 xl:col-span-4 rounded-sm border border-border/30 bg-card/40 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Key Metrics</h3>
          {report ? (
            <div className="space-y-2">
              {[
                ["Bias", bias.toUpperCase(), bias === "bullish" ? "text-[hsl(var(--bullish))]" : bias === "bearish" ? "text-destructive" : "text-muted-foreground"],
                ["Trend", report.structure.trend?.toUpperCase() ?? "—", "text-primary"],
                ["Phase", report.structure.phase?.toUpperCase() ?? "—", "text-foreground"],
                ["Structure Conf", `${Math.round(report.structure.confidence * 100)}%`, conf >= 60 ? "text-[hsl(var(--bullish))]" : "text-muted-foreground"],
                ["Daily Bias", `${report.dailyBias.bias.toUpperCase()} (${report.dailyBias.consecutiveDays}d)`, report.dailyBias.bias === "bullish" ? "text-[hsl(var(--bullish))]" : report.dailyBias.bias === "bearish" ? "text-destructive" : "text-muted-foreground"],
                ["PD Array", report.pdArray.currentBias?.toUpperCase() ?? "—", report.pdArray.currentBias === "premium" ? "text-destructive" : report.pdArray.currentBias === "discount" ? "text-[hsl(var(--bullish))]" : "text-primary"],
              ].map(([label, val, color]) => (
                <div key={label as string} className="flex items-center justify-between py-1.5 border-b border-border/20 last:border-0">
                  <span className="text-[10px] text-muted-foreground">{label as string}</span>
                  <span className={`text-[11px] font-semibold font-mono ${color as string}`}>{val as string}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-40 text-xs text-muted-foreground italic font-mono">
              No data
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
