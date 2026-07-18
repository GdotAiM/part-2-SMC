/**
 * Trade View — Review mode, signal intent, broker abstraction.
 */

import { useLocation } from "wouter";
import { Target, TrendingUp, TrendingDown, Shield, AlertTriangle } from "lucide-react";

export function TradeView() {
  const [, setLocation] = useLocation();

  return (
    <div className="p-5 lg:p-7 max-w-[1800px] mx-auto space-y-5">
      <div>
        <div className="text-[9px] text-primary/50 uppercase tracking-widest mb-1">Trade</div>
        <h1 className="text-2xl lg:text-3xl font-black tracking-tight">From reasoning to trade intent.</h1>
        <p className="mt-1 text-xs text-muted-foreground max-w-2xl">
          The execution layer stays broker-agnostic. The system first produces a structured decision, then decides what to do with it.
        </p>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Signal Ledger */}
        <section className="col-span-12 lg:col-span-7 rounded-sm border border-border/30 bg-card/40 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" />
              <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Signal Ledger</h3>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-sm bg-amber-400/10 text-amber-400 border border-amber-500/20 font-semibold">
              Review Mode
            </span>
          </div>
          <div className="space-y-2">
            {[
              { name: "Silver Bullet · LONG", model: "PRIMARY", rr: "+1.94R", ok: true },
              { name: "SMC Confluence 1 · LONG", model: "ALTERNATIVE", rr: "+1.2R", ok: true },
              { name: "Liquidity Raid · SHORT", model: "ALTERNATIVE", rr: "-0.8R", ok: false },
              { name: "FVG Model · LONG", model: "CONFLUENCE", rr: "+0.6R", ok: true },
            ].map((s, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-sm bg-muted/10 border border-border/20">
                <div>
                  <div className="text-xs text-foreground">{s.name}</div>
                  <div className="text-[9px] text-muted-foreground mt-0.5">BTCUSDT · {i + 2}h ago · {s.model}</div>
                </div>
                <div className={`text-right text-xs font-bold font-mono ${s.ok ? "text-[hsl(var(--bullish))]" : "text-destructive"}`}>
                  {s.rr}
                  <div className="text-[8px] text-muted-foreground font-normal">OUTCOME</div>
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={() => setLocation("/analytics")}
            className="mt-4 w-full py-2 rounded-sm bg-muted/30 border border-border/30 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Open Full Ledger
          </button>
        </section>

        {/* Execution Abstraction */}
        <section className="col-span-12 lg:col-span-5 rounded-sm border border-border/30 bg-card/40 p-5">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">Execution Abstraction</h3>
          <div className="space-y-3">
            {[
              { step: "Signal generated", done: true },
              { step: "Risk parameters validated", done: true },
              { step: "Intent created", done: true },
              { step: "Broker interface ready", done: false },
            ].map((s, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-sm bg-muted/10 border border-border/20">
                <div className={`w-6 h-6 rounded-sm flex items-center justify-center text-[10px] font-bold ${s.done ? "bg-[hsl(var(--bullish))]/10 text-[hsl(var(--bullish))]" : "bg-amber-400/10 text-amber-400"}`}>
                  {s.done ? "✓" : i + 1}
                </div>
                <span className="text-xs text-foreground">{s.step}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 p-3 rounded-sm bg-amber-400/5 border border-amber-500/20">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-[10px] text-amber-300">
                Review mode is active. Signals are recorded and evaluated, but not sent to a live broker.
              </p>
            </div>
          </div>
          <button
            onClick={() => setLocation("/broker")}
            className="mt-4 w-full py-2 rounded-sm bg-primary/10 border border-primary/20 text-xs text-primary font-semibold hover:bg-primary/15 transition-colors"
          >
            Open Broker Interface
          </button>
        </section>
      </div>
    </div>
  );
}
