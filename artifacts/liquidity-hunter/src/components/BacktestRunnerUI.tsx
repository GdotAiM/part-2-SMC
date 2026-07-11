import { useState, useEffect } from "react";
import {
  Play, Loader2, CheckCircle, AlertCircle, RefreshCw, Target, TrendingUp, TrendingDown,
} from "lucide-react";
import { apiUrl, fetchSymbols, type SymbolsData } from "@/lib/api";

interface BacktestResult {
  signals: any[];
  metrics: {
    win_rate: number;
    sharpe_ratio: number;
    profit_factor: number;
    avg_win: number;
    avg_loss: number;
    max_drawdown: number;
    total_signals: number;
    winning_signals: number;
    losing_signals: number;
  };
  candleCount: number;
}

type RunStep = "idle" | "fetching" | "running" | "logging" | "done" | "error";

export function BacktestRunnerUI({ onComplete }: { onComplete: () => void }) {
  const [assetClass, setAssetClass] = useState<"CRYPTO" | "FOREX" | "STOCK">("CRYPTO");
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [timeframe, setTimeframe] = useState("4h");
  const [symbolsData, setSymbolsData] = useState<SymbolsData | null>(null);
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState<RunStep>("idle");
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetchSymbols().then(setSymbolsData).catch(() => {});
  }, []);

  // Filter symbols by asset class
  const availableSymbols = assetClass === "CRYPTO"
    ? (symbolsData?.crypto || [])
    : assetClass === "FOREX"
      ? (symbolsData?.forex || [])
      : [{ symbol: "AAPL", label: "AAPL" }, { symbol: "MSFT", label: "MSFT" }, { symbol: "GOOGL", label: "GOOGL" }];

  const timeframes = ["1h", "4h", "1d"];

  async function handleRun() {
    setRunning(true);
    setStep("fetching");
    setResult(null);
    setError(null);
    setMessage("Fetching historical candles...");

    try {
      const displaySym = symbol;
      setMessage("Running backtest windows...");
      setStep("running");

      const res = await fetch(apiUrl("/backtest/run"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetClass, symbol, displaySymbol: displaySym, timeframe }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

      setMessage(`Logging ${data.signals?.length || 0} signals...`);
      setStep("logging");

      // Brief pause for UX
      await new Promise(r => setTimeout(r, 300));

      setResult(data);
      setStep("done");
      setMessage(`Complete: ${data.metrics?.total_signals || 0} signals, ${data.candleCount} candles`);
    } catch (err: any) {
      setStep("error");
      setError(err.message);
      setMessage("");
    }
    setRunning(false);
  }

  // Color helpers
  const pctColor = (v: number) => v >= 0 ? "text-emerald-400" : "text-destructive";
  const winColor = (v: number) => v >= 0.6 ? "text-emerald-400" : v >= 0.5 ? "text-yellow-400" : "text-destructive";
  const sharpeColor = (v: number) => v >= 1.5 ? "text-emerald-400" : v >= 1.0 ? "text-green-400" : v >= 0.5 ? "text-yellow-400" : v > 0 ? "text-orange-400" : "text-destructive";

  return (
    <div className="border border-border rounded-sm bg-card overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2 mb-3">
          <Target className="w-4 h-4 text-primary" />
          <span className="text-sm font-bold uppercase tracking-wider">Run Backtest</span>
          <span className="text-[10px] text-muted-foreground ml-auto">
            Sliding-window SMC backtest on real historical data
          </span>
        </div>

        {/* Controls row */}
        <div className="flex flex-wrap gap-2 items-end">
          {/* Asset class */}
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Asset</label>
            <div className="flex rounded-sm overflow-hidden border border-border">
              {(["CRYPTO", "FOREX", "STOCK"] as const).map((a) => (
                <button
                  key={a}
                  onClick={() => { setAssetClass(a); setSymbol(a === "CRYPTO" ? "BTCUSDT" : a === "FOREX" ? "EURUSD=X" : "AAPL"); }}
                  disabled={running}
                  className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                    assetClass === a ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
                  } disabled:opacity-40`}
                >
                  {a === "CRYPTO" ? "Crypto" : a === "FOREX" ? "Forex" : "Stocks"}
                </button>
              ))}
            </div>
          </div>

          {/* Symbol */}
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Symbol</label>
            <select
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              disabled={running}
              className="bg-muted border border-border rounded-sm px-2.5 py-1.5 text-xs text-foreground disabled:opacity-50"
            >
              {availableSymbols.map((s: any) => (
                <option key={s.symbol} value={s.symbol}>{s.label || s.symbol}</option>
              ))}
            </select>
          </div>

          {/* Timeframe */}
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">TF</label>
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
              disabled={running}
              className="bg-muted border border-border rounded-sm px-2.5 py-1.5 text-xs text-foreground disabled:opacity-50"
            >
              {timeframes.map((tf) => (
                <option key={tf} value={tf}>{tf}</option>
              ))}
            </select>
          </div>

          {/* Run button */}
          <button
            onClick={handleRun}
            disabled={running}
            className="flex items-center gap-1.5 bg-primary/15 hover:bg-primary/25 text-primary border border-primary/30 rounded-sm px-3 py-1.5 text-xs font-bold transition-colors disabled:opacity-50"
          >
            {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            {running ? "Running..." : "Run Backtest"}
          </button>
        </div>
      </div>

      {/* Progress */}
      {step !== "idle" && step !== "done" && step !== "error" && (
        <div className="px-4 py-2.5 border-b border-border/60 bg-muted/20 flex items-center gap-2 text-xs">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
          <span className="text-muted-foreground">{message}</span>
          <span className="text-[10px] text-primary font-semibold ml-auto uppercase">
            {step === "fetching" ? "Fetching..." : step === "running" ? "Analyzing..." : "Saving..."}
          </span>
        </div>
      )}

      {/* Result */}
      {result && step === "done" && (
        <div className="p-4 space-y-3">
          {/* Success banner */}
          <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/25 rounded-sm px-3 py-2 text-xs">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-emerald-400 font-semibold">Backtest Complete</span>
            <span className="text-muted-foreground">· {result.signals.length} signals across {result.candleCount} candles</span>
            <button
              onClick={onComplete}
              className="ml-auto text-[10px] text-primary hover:underline"
            >
              Refresh Matrix
            </button>
          </div>

          {/* Metrics grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="bg-muted/20 border border-border rounded-sm px-3 py-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Win Rate</p>
              <p className={`text-lg font-bold font-mono ${winColor(result.metrics.win_rate)}`}>
                {(result.metrics.win_rate * 100).toFixed(1)}%
              </p>
            </div>
            <div className="bg-muted/20 border border-border rounded-sm px-3 py-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Sharpe</p>
              <p className={`text-lg font-bold font-mono ${sharpeColor(result.metrics.sharpe_ratio)}`}>
                {result.metrics.sharpe_ratio.toFixed(2)}
              </p>
            </div>
            <div className="bg-muted/20 border border-border rounded-sm px-3 py-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Profit Factor</p>
              <p className={`text-lg font-bold font-mono ${pctColor(result.metrics.profit_factor)}`}>
                {result.metrics.profit_factor.toFixed(2)}
              </p>
            </div>
            <div className="bg-muted/20 border border-border rounded-sm px-3 py-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Max DD</p>
              <p className={`text-lg font-bold font-mono ${result.metrics.max_drawdown > 0 ? "text-destructive" : "text-emerald-400"}`}>
                {(result.metrics.max_drawdown * 100).toFixed(1)}%
              </p>
            </div>
          </div>

          {/* Detailed stats */}
          <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground border-t border-border/60 pt-2">
            <span>Avg Win: <span className="font-semibold text-emerald-400">${result.metrics.avg_win.toFixed(2)}</span></span>
            <span>Avg Loss: <span className="font-semibold text-destructive">${result.metrics.avg_loss.toFixed(2)}</span></span>
            <span>Winners: <span className="font-semibold text-emerald-400">{result.metrics.winning_signals}</span></span>
            <span>Losers: <span className="font-semibold text-destructive">{result.metrics.losing_signals}</span></span>
            <span>Total: <span className="font-semibold">{result.metrics.total_signals}</span></span>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="px-4 py-3 flex items-start gap-2 bg-destructive/10 border-t border-destructive/30 text-xs text-destructive">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold mb-0.5">Backtest Failed</p>
            <p className="text-destructive/80">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
}
