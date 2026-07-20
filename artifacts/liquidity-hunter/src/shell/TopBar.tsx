/**
 * TopBar — Symbol picker, session clock, connection status, health indicator.
 * Always visible at the top of the Session Cockpit.
 */

import { useMarketStore } from "@/state/market-store";
import { useProfileStore } from "@/state/profile-store";
import { useSessionClock } from "@/hooks/useSessionClock";
import { useSystemEvidence } from "@/hooks/useEvidence";
import { SESSION_LABELS } from "@/state/narrative";
import { TvStatus } from "@/components/TvStatus";

export function TopBar() {
  const symbol = useMarketStore((s) => s.symbol);
  const marketType = useMarketStore((s) => s.marketType);
  const streamConnected = useMarketStore((s) => s.streamConnected);
  const setSymbol = useMarketStore((s) => s.setSymbol);
  const toggleCapabilityExplorer = useMarketStore((s) => s.toggleCapabilityExplorer);
  const toggleChart = useMarketStore((s) => s.toggleChart);
  const session = useSessionClock();
  const health = useSystemEvidence();

  const apiOk = health.find((h) => h.label === "API Server")?.status === "pass";
  const tvOk = health.find((h) => h.label === "TradingView")?.status === "pass";

  const watchlist = useProfileStore((s) => s.profile.watchlist);

  return (
    <header className="h-14 border-b border-border/30 flex items-center justify-between px-4 lg:px-6 shrink-0 bg-card/20">
      {/* Left — Symbol + Market + Session */}
      <div className="flex items-center gap-3">
        {/* Market toggle */}
        <div className="flex rounded-sm overflow-hidden border border-border h-7">
          {(["crypto", "forex"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setSymbol(symbol, m)}
              className={`px-2.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                marketType === m
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {m === "crypto" ? "C" : "F"}
            </button>
          ))}
        </div>

        {/* Symbol select */}
        <select
          value={symbol}
          onChange={(e) => setSymbol(e.target.value, marketType)}
          className="bg-muted border border-border text-xs rounded-sm px-2 py-1 font-semibold h-7"
        >
          {watchlist.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
          {marketType === "crypto"
            ? ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT"]
                .filter((s) => !watchlist.includes(s))
                .map((s) => <option key={s} value={s}>{s}</option>)
            : ["EURUSD=X", "GBPUSD=X", "USDJPY=X", "AUDUSD=X", "USDCAD=X"]
                .filter((s) => !watchlist.includes(s))
                .map((s) => <option key={s} value={s}>{s}</option>)
          }
        </select>

        {/* Session badge */}
        <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-sm bg-muted/30 border border-border/40">
          <span className={`w-1.5 h-1.5 rounded-full ${session.isActive ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground"}`} />
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            {SESSION_LABELS[session.name]}
          </span>
          <span className="text-[10px] font-mono text-primary">{session.formatted}</span>
        </div>

        {/* Session progress bar */}
        <div className="hidden lg:block w-20 h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-cyan-400 transition-all duration-1000"
            style={{ width: `${session.progress}%` }}
          />
        </div>
      </div>

      {/* Right — Status + Actions */}
      <div className="flex items-center gap-2">
        {/* Stream status */}
        <div className="hidden md:flex items-center gap-1.5 px-2 py-1 rounded-sm bg-muted/20 border border-border/30">
          <span className={`w-1.5 h-1.5 rounded-full ${streamConnected ? "bg-emerald-500" : "bg-amber-400"}`} />
          <span className="text-[9px] text-muted-foreground font-mono">
            {streamConnected ? "LIVE" : "OFFLINE"}
          </span>
        </div>

        {/* Health indicator */}
        <div className="flex items-center gap-1 px-2 py-1 rounded-sm bg-muted/20 border border-border/30">
          <span className={`w-1.5 h-1.5 rounded-full ${apiOk ? "bg-emerald-500" : "bg-destructive"}`} />
          <span className="text-[9px] text-muted-foreground font-mono">API</span>
        </div>

        {/* TV Status */}
        <TvStatus />

        {/* Chart toggle */}
        <button
          onClick={toggleChart}
          className="px-2 py-1 rounded-sm bg-muted/20 border border-border/30 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          title="Toggle chart"
        >
          📊
        </button>

        {/* Capability explorer */}
        <button
          onClick={toggleCapabilityExplorer}
          className="px-2 py-1 rounded-sm bg-primary/10 border border-primary/20 text-[10px] text-primary font-semibold hover:bg-primary/15 transition-colors flex items-center gap-1"
        >
          <kbd className="text-[8px] px-1 py-0.5 rounded bg-primary/20 text-primary">⌘K</kbd>
          <span className="hidden sm:inline">Capabilities</span>
        </button>
      </div>
    </header>
  );
}
