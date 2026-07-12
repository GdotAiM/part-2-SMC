import { useState, useEffect, useCallback } from "react";
import { Monitor, Tv, Wifi, WifiOff, RefreshCw, X } from "lucide-react";

const API = import.meta.env.BASE_URL.replace(/\/$/, "");
function apiUrl(path: string) { return `${API}/api${path}`; }

interface TvState {
  enabled: boolean;
  connected: boolean;
  url?: string;
  config?: {
    connection: { type: string; cdpPort: number };
    dataSource: string;
    interactionMode: string;
  };
}

interface ChartState {
  symbol: string;
  timeframe: string;
  drawings?: any[];
}

export function TvStatus() {
  const [open, setOpen] = useState(false);
  const [tv, setTv] = useState<TvState | null>(null);
  const [chart, setChart] = useState<ChartState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl("/agent-loop/tv-status"));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setTv(data);

      // Also try to get chart state
      try {
        const cr = await fetch(apiUrl("/agent-loop/tv-read"));
        if (cr.ok) {
          const cd = await cr.json();
          setChart(cd.state);
        }
      } catch {}
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  }, []);

  const connect = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(apiUrl("/agent-loop/tv-connect"), { method: "POST" });
      const data = await res.json();
      load();
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  }, [load]);

  const sync = useCallback(async () => {
    setSyncing(true);
    setSyncMsg(null);
    try {
      // Read current chart state as a report
      const res = await fetch(apiUrl("/agent-loop/tv-read"));
      if (!res.ok) throw new Error("Cannot read chart");
      setSyncMsg("TV Desktop connected and ready");
      setTimeout(() => setSyncMsg(null), 3000);
    } catch (err: any) {
      setSyncMsg("Sync failed: " + err.message);
    }
    setSyncing(false);
  }, []);

  useEffect(() => { if (open) load(); }, [open, load]);

  const isConnected = tv?.connected ?? false;
  const isEnabled = tv?.enabled ?? false;

  return (
    <>
      {/* TV Button in header */}
      <button
        onClick={() => setOpen(true)}
        title="TradingView Desktop integration"
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-sm border transition-colors text-xs font-bold
          ${isConnected
            ? "border-green-500/50 bg-green-500/10 text-green-400"
            : "border-border bg-muted text-muted-foreground hover:text-foreground"}`}
      >
        {isConnected ? <Wifi className="w-3.5 h-3.5 text-green-400" /> : <Tv className="w-3.5 h-3.5" />}
        <span className="hidden sm:inline">TV</span>
        {isConnected && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />}
      </button>

      {/* TV Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-md w-full max-w-sm mx-4 shadow-2xl font-mono">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Tv className="w-4 h-4 text-primary" />
                <span className="text-sm font-bold text-primary">TV Desktop</span>
              </div>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-4 space-y-3 text-xs">
              {/* Status */}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Connection</span>
                <span className={`font-semibold flex items-center gap-1 ${isConnected ? "text-green-400" : "text-destructive"}`}>
                  {isConnected ? <><Wifi className="w-3 h-3" /> Connected</> : <><WifiOff className="w-3 h-3" /> Disconnected</>}
                </span>
              </div>

              {tv?.config && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Mode</span>
                    <span className="font-semibold uppercase">{tv.config.connection.type}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">CDP Port</span>
                    <span className="font-semibold">{tv.config.connection.cdpPort}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Data Source</span>
                    <span className="font-semibold uppercase">{tv.config.dataSource}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Interaction</span>
                    <span className="font-semibold uppercase">{tv.config.interactionMode}</span>
                  </div>
                </>
              )}

              {chart && (
                <>
                  <div className="border-t border-border/40 pt-3" />
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Chart Symbol</span>
                    <span className="font-semibold text-primary">{chart.symbol}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Timeframe</span>
                    <span className="font-semibold">{chart.timeframe}</span>
                  </div>
                </>
              )}

              {error && (
                <div className="bg-destructive/10 border border-destructive/30 rounded-sm p-2 text-destructive">
                  {error}
                </div>
              )}

              {syncMsg && (
                <div className="bg-green-500/10 border border-green-500/30 rounded-sm p-2 text-green-400">
                  {syncMsg}
                </div>
              )}

              {/* Actions */}
              <div className="border-t border-border/40 pt-3 flex gap-2">
                <button onClick={load} disabled={loading}
                  className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 rounded-sm border border-border bg-muted text-xs font-semibold hover:bg-muted/80 transition-colors disabled:opacity-50">
                  <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} /> Refresh
                </button>
                {!isConnected && (
                  <button onClick={connect} disabled={loading}
                    className="flex-1 px-3 py-1.5 rounded-sm bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50">
                    Connect
                  </button>
                )}
                {isConnected && (
                  <button onClick={sync} disabled={syncing}
                    className="flex-1 px-3 py-1.5 rounded-sm bg-primary/10 border border-primary/30 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors disabled:opacity-50">
                    Sync Data
                  </button>
                )}
              </div>

              {/* Instructions */}
              <div className="border-t border-border/40 pt-3 text-[10px] text-muted-foreground space-y-0.5">
                <p>TV Desktop integration reads live chart bars for SMC analysis when external APIs are unavailable.</p>
                <p className="mt-1"><span className="text-green-400">●</span> Green = connected &amp; ready</p>
                <p><span className="text-destructive">●</span> Red = disconnected (click Connect)</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
