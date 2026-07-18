/**
 * Trade View — Review mode, signal intent, broker abstraction.
 *
 * Fetches real signal data from GET /api/ledger and broker status
 * from GET /api/broker/status.
 */

import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Target, TrendingUp, TrendingDown, AlertTriangle, Loader2 } from "lucide-react";
import { apiUrl } from "@/lib/api";

interface TradeViewProps {
  symbol?: string;
  market?: string;
}

interface SignalEntry {
  id?: string;
  symbol?: string;
  setup_type?: string;
  direction?: string;
  entry?: number;
  stop?: number;
  target?: number;
  rr?: number;
  status?: string;
  result?: string;
  pnl?: number;
  pnlPercent?: number;
  mode?: string;
  detected_at?: string;
}

interface BrokerStatus {
  broker_name: string;
  is_ready: boolean;
  mode: "REVIEW" | "LIVE";
  is_paper: boolean;
}

interface LedgerResponse {
  signals: SignalEntry[];
  metrics?: {
    total_trades?: number;
    win_rate?: number;
    profit_factor?: number;
    avg_rr?: number;
  };
}

export function TradeView({ symbol = "BTCUSDT", market = "crypto" }: TradeViewProps) {
  const [, setLocation] = useLocation();
  const [signals, setSignals] = useState<SignalEntry[]>([]);
  const [metrics, setMetrics] = useState<LedgerResponse["metrics"] | null>(null);
  const [broker, setBroker] = useState<BrokerStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      fetch(apiUrl(`/ledger?symbol=${symbol}&limit=10`)).then(r => r.ok ? r.json() : { signals: [], metrics: null }),
      fetch(apiUrl("/broker/status")).then(r => r.ok ? r.json() : null).catch(() => null),
    ])
      .then(([ledgerData, brokerData]) => {
        if (cancelled) return;
        setSignals(ledgerData.signals ?? []);
        setMetrics(ledgerData.metrics ?? null);
        setBroker(brokerData);
      })
      .catch(e => { if (!cancelled) setError(e.message ?? "Failed to load trade data"); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [symbol]);

  const displaySignals = signals.length > 0
    ? signals.slice(0, 10)
    : [];

  const isReviewMode = broker?.mode === "REVIEW" || !broker;
  const brokerReady = broker?.is_ready ?? false;

  return (
    <div className="p-5 lg:p-7 max-w-[1800px] mx-auto space-y-5">
      <div>
        <div className="text-[9px] text-primary/50 uppercase tracking-widest mb-1">Trade</div>
        <h1 className="text-2xl lg:text-3xl font-black tracking-tight">From reasoning to trade intent.</h1>
        <p className="mt-1 text-xs text-muted-foreground max-w-2xl">
          The execution layer stays broker-agnostic. The system first produces a structured decision, then decides what to do with it.
        </p>
      </div>

      {loading && (
        <div className="flex items-center gap-3 justify-center py-20 text-xs text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading trade data…
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 justify-center py-20 text-xs text-destructive">
          <AlertTriangle className="w-4 h-4" />
          {error}
        </div>
      )}

      {!loading && !error && (
        <div className="grid grid-cols-12 gap-4">
          {/* Signal Ledger */}
          <section className="col-span-12 lg:col-span-7 rounded-sm border border-border/30 bg-card/40 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" />
                <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Signal Ledger</h3>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-sm font-semibold border ${
                isReviewMode
                  ? "bg-amber-400/10 text-amber-400 border-amber-500/20"
                  : "bg-[hsl(var(--bullish))]/10 text-[hsl(var(--bullish))] border-[hsl(var(--bullish))]/20"
              }`}>
                {isReviewMode ? "Review Mode" : "Live Mode"}
              </span>
            </div>

            {displaySignals.length > 0 ? (
              <div className="space-y-2">
                {displaySignals.map((s, i) => {
                  const direction = s.direction ?? "LONG";
                  const isWin = s.result === "win" || (s.pnl != null && s.pnl > 0);
                  const isLoss = s.result === "loss" || (s.pnl != null && s.pnl < 0);
                  const rrDisplay = s.rr != null ? `${s.rr > 0 ? "+" : ""}${s.rr.toFixed(2)}R` : null;
                  const setupLabel = s.setup_type ? s.setup_type.replace(/_/g, " ") : "Signal";
                  return (
                    <div key={s.id ?? i} className="flex items-center justify-between p-3 rounded-sm bg-muted/10 border border-border/20">
                      <div>
                        <div className="text-xs text-foreground">{setupLabel} · {direction}</div>
                        <div className="text-[9px] text-muted-foreground mt-0.5">
                          {s.symbol ?? symbol} · {s.mode ?? isReviewMode ? "REVIEW" : "LIVE"} · {s.status ?? "pending"}
                        </div>
                      </div>
                      <div className={`text-right text-xs font-bold font-mono ${
                        isWin ? "text-[hsl(var(--bullish))]" : isLoss ? "text-destructive" : "text-muted-foreground"
                      }`}>
                        {rrDisplay ?? "—"}
                        <div className="text-[8px] text-muted-foreground font-normal">
                          {isWin ? "WIN" : isLoss ? "LOSS" : s.status ?? "OUTCOME"}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center justify-center h-24 text-xs text-muted-foreground italic font-mono">
                No signals yet for {symbol}. Run analysis to generate signals.
              </div>
            )}

            <button
              onClick={() => setLocation("/analytics")}
              className="mt-4 w-full py-2 rounded-sm bg-muted/30 border border-border/30 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Open Full Ledger {metrics && `(${metrics.total_trades ?? 0} total)`}
            </button>
          </section>

          {/* Execution Abstraction */}
          <section className="col-span-12 lg:col-span-5 rounded-sm border border-border/30 bg-card/40 p-5">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">Execution Abstraction</h3>
            <div className="space-y-3">
              {[
                { step: "Signal generated", done: signals.length > 0 },
                { step: "Risk parameters validated", done: metrics?.avg_rr != null },
                { step: "Intent created", done: displaySignals.some(s => s.status === "ready" || s.status === "pending") },
                { step: "Broker interface ready", done: brokerReady },
              ].map((s, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-sm bg-muted/10 border border-border/20">
                  <div className={`w-6 h-6 rounded-sm flex items-center justify-center text-[10px] font-bold ${
                    s.done ? "bg-[hsl(var(--bullish))]/10 text-[hsl(var(--bullish))]" : "bg-amber-400/10 text-amber-400"
                  }`}>
                    {s.done ? "✓" : i + 1}
                  </div>
                  <span className="text-xs text-foreground">{s.step}</span>
                </div>
              ))}
            </div>

            {broker && (
              <div className="mt-3 p-2.5 rounded-sm bg-muted/20 border border-border/20 flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">{broker.broker_name}</span>
                <span className={`text-[10px] font-semibold ${broker.is_ready ? "text-[hsl(var(--bullish))]" : "text-amber-400"}`}>
                  {broker.is_ready ? "Connected" : "Disconnected"}
                  {broker.is_paper && " · Paper"}
                </span>
              </div>
            )}

            {isReviewMode && (
              <div className="mt-4 p-3 rounded-sm bg-amber-400/5 border border-amber-500/20">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-amber-300">
                    Review mode is active. Signals are recorded and evaluated, but not sent to a live broker.
                  </p>
                </div>
              </div>
            )}

            <button
              onClick={() => setLocation("/broker")}
              className="mt-4 w-full py-2 rounded-sm bg-primary/10 border border-primary/20 text-xs text-primary font-semibold hover:bg-primary/15 transition-colors"
            >
              Open Broker Interface
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
