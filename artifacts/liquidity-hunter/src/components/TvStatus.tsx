import { useState, useEffect, useCallback } from "react";
import { Tv, Wifi, WifiOff, RefreshCw, X, Trash2, Eye, EyeOff, BarChart3, Target, Layers, Zap, Paintbrush } from "lucide-react";

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
  visibleRange?: any;
  drawings?: any[];
}

interface DrawResult {
  action: string;
  levels: any[];
  fvgs: any[];
  logs: string[];
}

type DrawAction = "levels" | "fvgs" | "killzones" | "bos" | "clear" | "all";

export function TvStatus() {
  const [open, setOpen] = useState(false);
  const [tv, setTv] = useState<TvState | null>(null);
  const [chart, setChart] = useState<ChartState | null>(null);
  const [loading, setLoading] = useState(false);
  const [drawing, setDrawing] = useState<DrawAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [alertPrice, setAlertPrice] = useState("");
  const [alertCondition, setAlertCondition] = useState("crossing");
  const [alertSetting, setAlertSetting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl("/agent-loop/tv-status"));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setTv(await res.json());

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
      await fetch(apiUrl("/agent-loop/tv-connect"), { method: "POST" });
      load();
    } catch (err: any) { setError(err.message); }
    setLoading(false);
  }, [load]);

  const draw = useCallback(async (action: DrawAction) => {
    setDrawing(action);
    setError(null);
    setLogs([]);
    try {
      const res = await fetch(apiUrl("/agent-loop/tv-draw"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data: DrawResult = await res.json();
      if (data.logs) setLogs(data.logs);
      if (!res.ok) setError(data.logs?.join(", ") || "Draw failed");
      // Refresh chart state after drawing
      load();
    } catch (err: any) {
      setError(err.message);
    }
    setDrawing(null);
  }, [load]);

  const setAlert = useCallback(async () => {
    if (!alertPrice) return;
    setAlertSetting(true);
    setError(null);
    try {
      const res = await fetch(apiUrl("/agent-loop/tv-alert-create"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ price: Number(alertPrice), condition: alertCondition, message: `SMC Pulse: ${alertCondition} ${alertPrice}` }),
      });
      const data = await res.json();
      if (res.ok) {
        setLogs([`Alert set at ${alertPrice} (${alertCondition})`]);
        setAlertPrice("");
      } else {
        setError(data.error || "Alert failed");
      }
    } catch (err: any) { setError(err.message); }
    setAlertSetting(false);
  }, [alertPrice, alertCondition]);

  const isConnected = tv?.connected ?? false;
  const isReadWrite = tv?.config?.interactionMode === "readwrite";

  return (
    <>
      {/* TV Button in header */}
      <button
        onClick={() => setOpen(true)}
        title={`TradingView Desktop — ${isConnected ? "Connected" : "Disconnected"}${isReadWrite ? " (Read/Write)" : ""}`}
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
          <div className="bg-card border border-border rounded-md w-full max-w-lg mx-4 shadow-2xl font-mono max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border sticky top-0 bg-card z-10">
              <div className="flex items-center gap-2">
                <Tv className="w-4 h-4 text-primary" />
                <span className="text-sm font-bold text-primary">TV Desktop Control</span>
              </div>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-4 text-xs">
              {/* Status Row */}
              <div className="flex items-center justify-between bg-muted/30 rounded-sm px-3 py-2">
                <div className="flex items-center gap-2">
                  {isConnected
                    ? <Wifi className="w-3.5 h-3.5 text-green-400" />
                    : <WifiOff className="w-3.5 h-3.5 text-destructive" />}
                  <span className={isConnected ? "text-green-400 font-semibold" : "text-destructive font-semibold"}>
                    {isConnected ? "Connected" : "Disconnected"}
                  </span>
                </div>
                {tv?.config && (
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <span className="uppercase">{tv.config.connection.type}</span>
                    <span>:{tv.config.connection.cdpPort}</span>
                    <span className={`uppercase ${isReadWrite ? "text-green-400" : ""}`}>
                      {tv.config.interactionMode}
                    </span>
                  </div>
                )}
              </div>

              {/* Chart Info */}
              {chart && (
                <div className="flex items-center gap-3 text-muted-foreground bg-muted/20 rounded-sm px-3 py-2">
                  <span className="font-semibold text-primary">{chart.symbol}</span>
                  <span>{chart.timeframe}</span>
                  {chart.visibleRange && (
                    <span className="text-[10px]">
                      {new Date(chart.visibleRange.from * 1000).toLocaleTimeString()} – {new Date(chart.visibleRange.to * 1000).toLocaleTimeString()}
                    </span>
                  )}
                </div>
              )}

              {/* Section: Drawing Controls */}
              <div>
                <div className="flex items-center gap-1.5 mb-2 text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">
                  <Paintbrush className="w-3 h-3" /> Drawing Tools
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => draw("levels")} disabled={!!drawing || !isConnected}
                    className="flex items-center gap-2 px-3 py-2 rounded-sm border border-border bg-muted hover:bg-muted/80 text-xs font-semibold transition-colors disabled:opacity-40">
                    <BarChart3 className="w-3.5 h-3.5 text-green-400" />
                    <span>BSL / SSL / Price</span>
                  </button>
                  <button onClick={() => draw("fvgs")} disabled={!!drawing || !isConnected}
                    className="flex items-center gap-2 px-3 py-2 rounded-sm border border-border bg-muted hover:bg-muted/80 text-xs font-semibold transition-colors disabled:opacity-40">
                    <Target className="w-3.5 h-3.5 text-purple-400" />
                    <span>FVG Boxes</span>
                  </button>
                  <button onClick={() => draw("killzones")} disabled={!!drawing || !isConnected}
                    className="flex items-center gap-2 px-3 py-2 rounded-sm border border-border bg-muted hover:bg-muted/80 text-xs font-semibold transition-colors disabled:opacity-40">
                    <Layers className="w-3.5 h-3.5 text-blue-400" />
                    <span>Killzone Sessions</span>
                  </button>
                  <button onClick={() => draw("bos")} disabled={!!drawing || !isConnected}
                    className="flex items-center gap-2 px-3 py-2 rounded-sm border border-border bg-muted hover:bg-muted/80 text-xs font-semibold transition-colors disabled:opacity-40">
                    <Eye className="w-3.5 h-3.5 text-amber-400" />
                    <span>Mark BOS/CHoCH</span>
                  </button>
                  <button onClick={() => draw("all")} disabled={!!drawing || !isConnected}
                    className="flex items-center gap-2 px-3 py-2 rounded-sm border border-primary/30 bg-primary/10 hover:bg-primary/20 text-xs font-semibold transition-colors disabled:opacity-40">
                    <Zap className="w-3.5 h-3.5 text-primary" />
                    <span>Draw All</span>
                  </button>
                  <button onClick={() => draw("clear")} disabled={!!drawing || !isConnected}
                    className="flex items-center gap-2 px-3 py-2 rounded-sm border border-destructive/30 bg-destructive/10 hover:bg-destructive/20 text-xs font-semibold transition-colors disabled:opacity-40 col-span-2">
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    <span>Clear All Drawings</span>
                  </button>
                </div>
              </div>

              {/* Section: Set Alert */}
              <div>
                <div className="flex items-center gap-1.5 mb-2 text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">
                  🔔 Set Price Alert
                </div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="any"
                    value={alertPrice}
                    onChange={(e) => setAlertPrice(e.target.value)}
                    placeholder="Price level"
                    className="flex-1 rounded-sm bg-muted/20 border border-border/20 px-2 py-1.5 text-xs font-mono text-foreground"
                  />
                  <select
                    value={alertCondition}
                    onChange={(e) => setAlertCondition(e.target.value)}
                    className="rounded-sm bg-muted/20 border border-border/20 px-1.5 py-1.5 text-[10px] font-mono text-foreground"
                  >
                    <option value="crossing">Crossing</option>
                    <option value="greater_than">Above</option>
                    <option value="less_than">Below</option>
                  </select>
                  <button
                    onClick={setAlert}
                    disabled={alertSetting || !isConnected || !alertPrice}
                    className="px-3 py-1.5 rounded-sm bg-primary/10 border border-primary/20 text-xs font-semibold text-primary hover:bg-primary/15 transition-colors disabled:opacity-40"
                  >
                    {alertSetting ? "..." : "Set"}
                  </button>
                </div>
              </div>

              {/* Drawing status / logs */}
              {drawing && (
                <div className="flex items-center gap-2 text-primary animate-pulse">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  <span>{drawing === "clear" ? "Clearing..." : `Drawing ${drawing}...`}</span>
                </div>
              )}
              {logs.length > 0 && (
                <div className="bg-muted/30 rounded-sm p-2 max-h-24 overflow-y-auto space-y-0.5">
                  {logs.map((l, i) => (
                    <p key={i} className="text-[10px] text-muted-foreground">{l}</p>
                  ))}
                </div>
              )}
              {error && (
                <div className="bg-destructive/10 border border-destructive/30 rounded-sm p-2 text-destructive">
                  {error}
                </div>
              )}

              {/* Section: Connection Actions */}
              <div className="border-t border-border/40 pt-3 flex gap-2">
                <button onClick={load} disabled={loading}
                  className="flex items-center justify-center gap-1 px-3 py-1.5 rounded-sm border border-border bg-muted text-xs font-semibold hover:bg-muted/80 transition-colors disabled:opacity-50">
                  <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} /> Refresh
                </button>
                {!isConnected && (
                  <button onClick={connect} disabled={loading}
                    className="px-3 py-1.5 rounded-sm bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50">
                    Connect
                  </button>
                )}
              </div>

              {/* Footer */}
              <div className="border-t border-border/40 pt-3 text-[10px] text-muted-foreground space-y-1">
                <p>Drawing uses <span className="text-primary font-semibold">Alt+H</span> (Horizontal ray) and <span className="text-primary font-semibold">Alt+Shift+R</span> (Rectangle) keyboard shortcuts on TV Desktop.</p>
                <p>SMC levels: BSL (🟢 above), SSL (🔴 below), Current (🔵). FVGs in 🟣, killzone sessions in colored boxes.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
