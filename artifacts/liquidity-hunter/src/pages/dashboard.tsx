import { useState, useMemo } from "react";
import { RefreshCw, Zap, TrendingUp, TrendingDown, Minus, ChevronUp, ChevronDown, AlertCircle, Activity } from "lucide-react";
import {
  useListSymbols,
  useAnalyzeCrypto,
  useAnalyzeForex,
  getAnalyzeCryptoQueryKey,
  getAnalyzeForexQueryKey,
  type SmcReport,
} from "@workspace/api-client-react";
import { ConfluenceCard } from "@/components/ConfluenceCard";
import { IntelligenceSheet } from "@/components/IntelligenceSheet";

type Market = "crypto" | "forex";

const TRADING_STYLES: Array<{ label: string; timeframes: string[] }> = [
  { label: "Scalp", timeframes: ["1h"] },
  { label: "Intraday", timeframes: ["1h", "4h"] },
  { label: "Swing", timeframes: ["4h", "1d"] },
  { label: "All", timeframes: ["1h", "4h", "1d"] },
];

function fmtPrice(p: number, market: Market): string {
  if (market === "forex") return p.toFixed(5);
  if (p >= 10000) return p.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (p >= 1) return p.toFixed(4);
  return p.toFixed(6);
}

function getConfidence(report: SmcReport): number {
  return Math.round(((report.structure.confidence + report.dailyBias.strength) / 2) * 100);
}

function getBias(report: SmcReport): "bullish" | "bearish" | "neutral" {
  return report.structure.bias !== "neutral" ? report.structure.bias as "bullish" | "bearish" : report.dailyBias.bias as "bullish" | "bearish" | "neutral";
}

function BiasIcon({ bias }: { bias: string }) {
  if (bias === "bullish") return <TrendingUp className="w-4 h-4 text-[hsl(var(--bullish))]" />;
  if (bias === "bearish") return <TrendingDown className="w-4 h-4 text-destructive" />;
  return <Minus className="w-4 h-4 text-muted-foreground" />;
}

// A single timeframe analysis card
function TfAgentCard({
  tf,
  report,
  market,
  isLoading,
  error,
  onOpen,
}: {
  tf: string;
  report: SmcReport | undefined;
  market: Market;
  isLoading: boolean;
  error: unknown;
  onOpen: () => void;
}) {
  if (isLoading) {
    return (
      <div className="rounded-sm border border-border bg-card p-4 animate-pulse space-y-3">
        <div className="flex items-center justify-between">
          <div className="h-4 w-10 bg-muted rounded-sm" />
          <div className="h-4 w-16 bg-muted rounded-sm" />
        </div>
        <div className="h-8 w-3/4 bg-muted rounded-sm" />
        <div className="h-3 w-1/2 bg-muted rounded-sm" />
        <div className="h-3 w-2/3 bg-muted rounded-sm" />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="rounded-sm border border-destructive/30 bg-destructive/5 p-4 flex items-center gap-2">
        <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
        <div>
          <p className="text-xs font-semibold">{tf}</p>
          <p className="text-[10px] text-muted-foreground">Data unavailable</p>
        </div>
      </div>
    );
  }

  const bias = getBias(report);
  const conf = getConfidence(report);
  const topDraw = report.draw[0];
  const altDraw = report.draw[1];

  const borderColor =
    bias === "bullish" ? "border-[hsl(var(--bullish))]/30" :
    bias === "bearish" ? "border-destructive/30" :
    "border-border";
  const bgGrad =
    bias === "bullish" ? "from-[hsl(var(--bullish))]/5 to-transparent" :
    bias === "bearish" ? "from-destructive/5 to-transparent" :
    "from-muted/20 to-transparent";
  const drawColor =
    bias === "bullish" ? "text-[hsl(var(--bullish))]" :
    bias === "bearish" ? "text-destructive" :
    "text-primary";

  return (
    <button
      onClick={onOpen}
      className={`rounded-sm border ${borderColor} bg-gradient-to-b ${bgGrad} p-4 text-left hover:opacity-90 active:scale-[0.99] transition-all w-full space-y-3 group`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{tf}</span>
          <Activity className="w-3 h-3 text-primary" />
        </div>
        <span className={`text-[10px] px-1.5 py-0.5 rounded-sm font-semibold uppercase ${
          bias === "bullish" ? "bg-[hsl(var(--bullish))]/15 text-[hsl(var(--bullish))]" :
          bias === "bearish" ? "bg-destructive/15 text-destructive" :
          "bg-muted text-muted-foreground"
        }`}>{bias}</span>
      </div>

      {/* Next draw target */}
      <div>
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Next Draw on Liquidity</p>
        {topDraw ? (
          <div className="flex items-center gap-1.5">
            {topDraw.direction === "long"
              ? <ChevronUp className={`w-5 h-5 ${drawColor} shrink-0`} />
              : <ChevronDown className={`w-5 h-5 ${drawColor} shrink-0`} />}
            <span className={`text-xl font-bold font-mono ${drawColor}`}>
              {fmtPrice(topDraw.price, market)}
            </span>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">No clear target</p>
        )}
      </div>

      {/* Confidence */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span>Conf {conf}%</span>
          {report.smt.detected && (
            <span className="text-primary font-semibold">SMT ⚡</span>
          )}
        </div>
        <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${conf > 65 ? "bg-[hsl(var(--bullish))]" : conf > 40 ? "bg-primary" : "bg-destructive"}`}
            style={{ width: `${conf}%` }}
          />
        </div>
      </div>

      {/* Alt target */}
      {altDraw && (
        <div className="border-t border-border/40 pt-2 flex items-center gap-1.5 text-[10px]">
          <span className="text-muted-foreground">Alt Target</span>
          <span className="font-mono text-muted-foreground">{fmtPrice(altDraw.price, market)}</span>
        </div>
      )}

      <div className="text-[10px] text-primary/60 group-hover:text-primary/90 transition-colors text-right">
        Tap for Intelligence Sheet →
      </div>
    </button>
  );
}

// A single TF fetch wrapper
function useTfReport(
  market: Market,
  symbol: string,
  tf: string,
  correlatedSymbol: string | undefined,
) {
  const cryptoParams = { symbol, timeframe: tf, correlatedSymbol };
  const forexParams = { symbol, timeframe: tf, correlatedSymbol };

  const crypto = useAnalyzeCrypto(cryptoParams, {
    query: {
      enabled: market === "crypto" && !!symbol,
      queryKey: getAnalyzeCryptoQueryKey(cryptoParams),
      staleTime: 60_000,
    },
  });

  const forex = useAnalyzeForex(forexParams, {
    query: {
      enabled: market === "forex" && !!symbol,
      queryKey: getAnalyzeForexQueryKey(forexParams),
      staleTime: 60_000,
    },
  });

  return market === "crypto" ? crypto : forex;
}

// Per-TF wrapper
function TfBlock({
  market,
  symbol,
  tf,
  correlatedSymbol,
  onOpen,
}: {
  market: Market;
  symbol: string;
  tf: string;
  correlatedSymbol: string | undefined;
  onOpen: (tf: string, report: SmcReport) => void;
}) {
  const { data, isLoading, error } = useTfReport(market, symbol, tf, correlatedSymbol);

  return (
    <TfAgentCard
      tf={tf}
      report={data}
      market={market}
      isLoading={isLoading}
      error={error}
      onOpen={() => data && onOpen(tf, data)}
    />
  );
}

export default function Dashboard() {
  const [market, setMarket] = useState<Market>("crypto");
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [correlatedSymbol, setCorrelatedSymbol] = useState<string>("ETHUSDT");
  const [smtEnabled, setSmtEnabled] = useState(true);
  const [styleIndex, setStyleIndex] = useState(3); // default "All"
  const [sheet, setSheet] = useState<{ tf: string; report: SmcReport } | null>(null);
  const [confluenceTf, setConfluenceTf] = useState<string | null>(null);

  const { data: symbols } = useListSymbols();

  const symbolOptions = useMemo(
    () => (market === "crypto" ? symbols?.crypto ?? [] : symbols?.forex ?? []),
    [market, symbols],
  );
  const corrOptions = useMemo(
    () => symbolOptions.filter(s => s.symbol !== symbol),
    [symbolOptions, symbol],
  );

  const activeStyle = TRADING_STYLES[styleIndex];
  const corrSym = smtEnabled ? correlatedSymbol : undefined;

  function handleMarketSwitch(m: Market) {
    setMarket(m);
    setSheet(null);
    setConfluenceTf(null);
    if (m === "crypto") { setSymbol("BTCUSDT"); setCorrelatedSymbol("ETHUSDT"); }
    else { setSymbol("EURUSD=X"); setCorrelatedSymbol("GBPUSD=X"); }
  }

  function handleOpenSheet(tf: string, report: SmcReport) {
    setSheet({ tf, report });
  }

  function handleConfluenceSelect(tf: string) {
    setConfluenceTf(tf);
  }

  // For confluence card — we gather loaded reports from each TF
  const tf1h = useTfReport(market, symbol, "1h", corrSym);
  const tf4h = useTfReport(market, symbol, "4h", corrSym);
  const tf1d = useTfReport(market, symbol, "1d", corrSym);

  const allTfReports = useMemo(() => {
    const acc: Array<{ tf: string; report: SmcReport }> = [];
    if (tf1h.data) acc.push({ tf: "1h", report: tf1h.data });
    if (tf4h.data) acc.push({ tf: "4h", report: tf4h.data });
    if (tf1d.data) acc.push({ tf: "1d", report: tf1d.data });
    return acc;
  }, [tf1h.data, tf4h.data, tf1d.data]);

  const confluenceReports = useMemo(
    () => allTfReports.filter(r => activeStyle.timeframes.includes(r.tf)),
    [allTfReports, activeStyle],
  );

  const primaryReport = tf4h.data ?? tf1h.data ?? tf1d.data;
  const isAnyLoading = tf1h.isLoading || tf4h.isLoading || tf1d.isLoading;

  // When user selects TF from confluence card, open the intelligence sheet
  const confluenceSheetReport = useMemo(() => {
    if (!confluenceTf) return null;
    return allTfReports.find(r => r.tf === confluenceTf) ?? null;
  }, [confluenceTf, allTfReports]);

  return (
    <div className="min-h-screen bg-background text-foreground font-mono">
      {/* Header */}
      <header className="border-b border-border bg-card/60 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-screen-xl mx-auto px-4 py-2.5 flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 mr-1">
            <Zap className="w-4 h-4 text-primary" />
            <span className="font-bold text-sm text-primary tracking-tight">SMC PULSE PREDICT</span>
          </div>

          {/* Market */}
          <div className="flex rounded-sm overflow-hidden border border-border">
            {(["crypto", "forex"] as Market[]).map(m => (
              <button key={m} onClick={() => handleMarketSwitch(m)}
                className={`px-3 py-1 text-xs font-bold uppercase tracking-wider transition-colors ${market === m ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
                {m}
              </button>
            ))}
          </div>

          {/* Symbol */}
          <select value={symbol} onChange={e => setSymbol(e.target.value)}
            className="bg-muted border border-border text-foreground text-xs rounded-sm px-2 py-1 font-semibold">
            {symbolOptions.map(s => <option key={s.symbol} value={s.symbol}>{s.label}</option>)}
          </select>

          {/* Trading Style */}
          <div className="flex rounded-sm overflow-hidden border border-border">
            {TRADING_STYLES.map((style, i) => (
              <button key={style.label} onClick={() => setStyleIndex(i)}
                className={`px-3 py-1 text-xs font-bold uppercase tracking-wider transition-colors ${styleIndex === i ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
                {style.label}
              </button>
            ))}
          </div>

          {/* SMT */}
          <div className="flex items-center gap-1.5">
            <button onClick={() => setSmtEnabled(!smtEnabled)}
              className={`text-xs px-2 py-1 rounded-sm border transition-colors ${smtEnabled ? "border-primary/50 bg-primary/10 text-primary" : "border-border bg-muted text-muted-foreground"}`}>
              SMT
            </button>
            {smtEnabled && (
              <select value={correlatedSymbol} onChange={e => setCorrelatedSymbol(e.target.value)}
                className="bg-muted border border-border text-foreground text-xs rounded-sm px-2 py-1">
                {corrOptions.map(s => <option key={s.symbol} value={s.symbol}>{s.label}</option>)}
              </select>
            )}
          </div>

          {/* Price + Refresh */}
          <div className="ml-auto flex items-center gap-3">
            {primaryReport && (
              <div className="text-right">
                <div className="text-base font-bold">{fmtPrice(primaryReport.currentPrice, market)}</div>
                <div className="text-[10px] text-muted-foreground">{symbol} · {new Date(primaryReport.generatedAt * 1000).toLocaleTimeString()}</div>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto px-4 py-5 space-y-5">

        {/* Confluence overview */}
        {confluenceReports.length > 0 && (
          <ConfluenceCard
            reports={confluenceReports}
            onSelect={tf => {
              const found = allTfReports.find(r => r.tf === tf);
              if (found) handleOpenSheet(found.tf, found.report);
            }}
          />
        )}

        {/* Style label */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
            {activeStyle.label} — Timeframe Agents
          </span>
          <div className="flex-1 h-px bg-border" />
          <span className="text-[10px] text-muted-foreground">{activeStyle.timeframes.join(" · ")}</span>
        </div>

        {/* TF Agent Cards */}
        <div className={`grid gap-4 ${
          activeStyle.timeframes.length === 1 ? "grid-cols-1 max-w-sm" :
          activeStyle.timeframes.length === 2 ? "grid-cols-1 sm:grid-cols-2" :
          "grid-cols-1 sm:grid-cols-3"
        }`}>
          {activeStyle.timeframes.map(tf => (
            <TfBlock
              key={tf}
              market={market}
              symbol={symbol}
              tf={tf}
              correlatedSymbol={corrSym}
              onOpen={handleOpenSheet}
            />
          ))}
        </div>

        {/* Session context footer */}
        {primaryReport && !isAnyLoading && (
          <div className="border border-border/50 rounded-sm bg-muted/20 px-4 py-3">
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <span className="font-semibold text-foreground">Daily Bias</span>
                <BiasIcon bias={primaryReport.dailyBias.bias} />
                <span className={primaryReport.dailyBias.bias === "bullish" ? "text-[hsl(var(--bullish))]" : primaryReport.dailyBias.bias === "bearish" ? "text-destructive" : "text-muted-foreground"}>
                  {primaryReport.dailyBias.bias.toUpperCase()}
                </span>
                <span className="text-muted-foreground">({primaryReport.dailyBias.consecutiveDays}d)</span>
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <span className="font-semibold text-foreground">PD Position</span>
                <span className={
                  primaryReport.pdArray.currentBias === "premium" ? "text-destructive" :
                  primaryReport.pdArray.currentBias === "discount" ? "text-[hsl(var(--bullish))]" :
                  "text-primary"
                }>{primaryReport.pdArray.currentBias.toUpperCase()}</span>
              </div>
              {primaryReport.liquidity.nearestBSL && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="font-semibold text-[hsl(var(--bullish))]">BSL</span>
                  <span className="font-mono">{fmtPrice(primaryReport.liquidity.nearestBSL.price, market)}</span>
                </div>
              )}
              {primaryReport.liquidity.nearestSSL && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="font-semibold text-destructive">SSL</span>
                  <span className="font-mono">{fmtPrice(primaryReport.liquidity.nearestSSL.price, market)}</span>
                </div>
              )}
              {primaryReport.smt.detected && (
                <div className="flex items-center gap-1.5">
                  <Zap className="w-3 h-3 text-primary" />
                  <span className={primaryReport.smt.type === "bearish_smt" ? "text-destructive" : "text-[hsl(var(--bullish))]"}>
                    {primaryReport.smt.type?.replace("_", " ").toUpperCase()}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Intelligence Sheet */}
      {sheet && (
        <IntelligenceSheet
          report={sheet.report}
          market={market}
          onClose={() => setSheet(null)}
        />
      )}
      {confluenceSheetReport && !sheet && (
        <IntelligenceSheet
          report={confluenceSheetReport.report}
          market={market}
          onClose={() => setConfluenceTf(null)}
        />
      )}
    </div>
  );
}
