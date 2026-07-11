import { useState, useEffect, useRef } from "react";
import {
  Activity, Play, Square, Clock, ChevronDown, ChevronUp,
  Loader2, Brain, Database, Target, AlertCircle, CheckCircle,
  RefreshCw, Zap, Trash2, Newspaper,
} from "lucide-react";
import {
  runAgentLoop, startLoopMonitor, stopLoopMonitor,
  getLoopStatus, getLoopRuns, getLoopRunDetail, getSemanticMemory,
  type LoopStepEvent,
} from "@/lib/api";
import { MarketIntelligence } from "./MarketIntelligence";

type View = "loop" | "monitors" | "history" | "knowledge" | "memory";

type Props = {
  /** Optional preset symbol to pre-fill the loop runner */
  presetSymbol?: string;
  /** Optional preset timeframe to pre-fill the loop runner */
  presetTimeframe?: string;
  /** Optional preset market */
  presetMarket?: "crypto" | "forex";
};

// ── Skeleton ────────────────────────────────────────────────────────────────

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-muted rounded-sm ${className}`} />;
}

// ── Step Timeline visual map ────────────────────────────────────────────────

const STEP_META: Record<string, { icon: string; label: string; color: string }> = {
  observe:    { icon: "●", label: "Observe",    color: "bg-blue-400" },
  interpret:  { icon: "◆", label: "Interpret",  color: "bg-purple-400" },
  reason:     { icon: "▲", label: "Reason",     color: "bg-amber-400" },
  decide:     { icon: "■", label: "Decide",     color: "bg-orange-400" },
  act:        { icon: "▶", label: "Act",        color: "bg-emerald-400" },
  evaluate:   { icon: "★", label: "Evaluate",   color: "bg-cyan-400" },
  update_memory: { icon: "●", label: "Update",  color: "bg-sky-400" },
};

// ── Main Dashboard ──────────────────────────────────────────────────────────

export function AgentLoopDashboard({ presetSymbol, presetTimeframe, presetMarket }: Props) {
  const [view, setView] = useState<View>("loop");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <Brain className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold uppercase tracking-wider">Agent Loop</span>
        <div className="flex-1" />
        <div className="flex gap-1">
          {(["loop", "monitors", "history", "knowledge", "memory"] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`text-[11px] px-2.5 py-1 rounded-sm font-medium transition-colors ${
                view === v
                  ? "bg-primary/20 text-primary border border-primary/30"
                  : "text-muted-foreground hover:text-foreground border border-transparent"
              }`}
            >
              {v === "loop" ? "Run Loop" : v === "monitors" ? "Monitors" : v === "history" ? "History" : v === "knowledge" ? "Knowledge" : "Memory"}
            </button>
          ))}
        </div>
      </div>

      {view === "loop" && <LoopRunner presetSymbol={presetSymbol} presetTimeframe={presetTimeframe} presetMarket={presetMarket} />}
      {view === "monitors" && <MonitorManager />}
      {view === "history" && <RunHistory />}
      {view === "memory" && <MemoryViewer />}
      {view === "knowledge" && (
        <MarketIntelligence
          symbol={presetSymbol || "BTCUSDT"}
          timeframe={presetTimeframe || "4h"}
          market={presetMarket || "crypto"}
        />
      )}
    </div>
  );
}

// ── Loop Runner ─────────────────────────────────────────────────────────────

function LoopRunner({ presetSymbol, presetTimeframe, presetMarket }: Props) {
  const [symbol, setSymbol] = useState(presetSymbol || "BTCUSDT");
  const [timeframe, setTimeframe] = useState(presetTimeframe || "4h");
  const [running, setRunning] = useState(false);
  const [events, setEvents] = useState<LoopStepEvent[]>([]);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const eventsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll events
  useEffect(() => {
    eventsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events]);

  async function handleRun() {
    setRunning(true);
    setEvents([]);
    setResult(null);
    setError(null);

    try {
      const mkt = presetMarket || (symbol.includes("=X") ? "forex" : "crypto");
      await runAgentLoop({ symbol, timeframe, market: mkt }, (event) => {
        setEvents((prev) => [...prev, event]);
        if (event.type === "loop_complete") {
          setResult(event.result);
          setRunning(false);
        }
        if (event.type === "loop_error") {
          setError(event.error ?? "Unknown error");
          setRunning(false);
        }
      });
    } catch (err: any) {
      setError(err.message);
      setRunning(false);
    }
  }

  return (
    <div className="space-y-3">
      {/* Input bar */}
      <div className="flex gap-2 items-end">
        <div className="flex-1 space-y-1">
          <label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Symbol</label>
          <input
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            disabled={running}
            className="w-full bg-muted border border-border rounded-sm px-2.5 py-1.5 text-xs text-foreground disabled:opacity-50"
            placeholder="BTCUSDT"
          />
        </div>
        <div className="w-24 space-y-1">
          <label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Timeframe</label>
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value)}
            disabled={running}
            className="w-full bg-muted border border-border rounded-sm px-2.5 py-1.5 text-xs text-foreground disabled:opacity-50"
          >
            {["1m", "5m", "15m", "1h", "4h", "1d", "1w"].map((tf) => (
              <option key={tf} value={tf}>{tf}</option>
            ))}
          </select>
        </div>
        <button
          onClick={handleRun}
          disabled={running}
          className="flex items-center gap-1.5 bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/30 rounded-sm px-3 py-1.5 text-xs font-bold transition-colors disabled:opacity-50"
        >
          {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
          {running ? "Running..." : "Run Agent Loop"}
        </button>
      </div>

      {/* Events stream — visual step timeline */}
      {events.length > 0 && (
        <div className="border border-border rounded-sm bg-muted/20 max-h-80 overflow-y-auto">
          <div className="px-3 py-2 border-b border-border/60 bg-muted/30">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Cycle Timeline</span>
          </div>
          <div className="p-3 space-y-2">
            {events
              .filter((e) => e.type === "loop_step")
              .map((evt, i) => {
                const step = evt.step;
                const meta = STEP_META[step?.type as string];
                const duration = step?.completedAt && step?.startedAt
                  ? `+${step.completedAt - step.startedAt}ms`
                  : "…";
                return (
                  <div key={i} className="flex items-center gap-2 text-[11px]">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${meta?.color ?? "bg-muted-foreground"}`} />
                    <span className="font-semibold text-foreground/70 uppercase text-[10px] tracking-wider w-20">
                      {meta?.label ?? step?.type}
                    </span>
                    <span className="text-muted-foreground/50 text-[10px] ml-auto">{duration}</span>
                  </div>
                );
              })}

            {/* Decision card */}
            {events.find((e) => e.type === "loop_decision") && (() => {
              const d = events.find((e) => e.type === "loop_decision")!.decision;
              return (
                <div className="flex items-start gap-2 text-[11px] bg-amber-500/8 border border-amber-500/20 rounded-sm px-2.5 py-2 mt-2">
                  <Brain className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-foreground capitalize">{d.action.replace(/_/g, " ")}</span>
                      <span className="text-amber-400 font-bold">{d.confidence}%</span>
                    </div>
                    <p className="text-muted-foreground mt-0.5 leading-relaxed">{d.reasoning?.slice(0, 240)}</p>
                  </div>
                </div>
              );
            })()}

            {/* Signal card */}
            {events.find((e) => e.type === "loop_signal") && (() => {
              const s = events.find((e) => e.type === "loop_signal")!.signal;
              return (
                <div className="flex items-start gap-2 text-[11px] bg-emerald-500/10 border border-emerald-500/25 rounded-sm px-2.5 py-2 mt-1">
                  <Target className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-emerald-400">Signal Generated</span>
                    <p className="text-muted-foreground mt-0.5">
                      Entry: {s.entry_price} · SL: {s.stop_loss} · TP: {s.take_profit}
                    </p>
                  </div>
                </div>
              );
            })()}

            <div ref={eventsEndRef} />
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/30 rounded-sm p-2.5 text-xs text-destructive">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold mb-0.5">Loop Error</p>
            <p className="text-destructive/80">{error}</p>
          </div>
        </div>
      )}

      {/* Result summary */}
      {result && (
        <div className={`rounded-sm border p-3 text-xs ${
          result.action === "signal_generated"
            ? "bg-emerald-500/10 border-emerald-500/30"
            : result.action === "analysis_complete"
              ? "bg-primary/8 border-primary/25"
              : "bg-muted/30 border-border"
        }`}>
          <div className="flex items-center gap-1.5 mb-1.5">
            {result.action === "signal_generated" ? (
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
            ) : result.action === "analysis_complete" ? (
              <Brain className="w-3.5 h-3.5 text-primary" />
            ) : (
              <Clock className="w-3.5 h-3.5 text-muted-foreground" />
            )}
            <span className="font-bold capitalize">{result.action.replace(/_/g, " ")}</span>
            <span className="text-muted-foreground">· {result.confidence}% confidence</span>
          </div>
          <p className="text-muted-foreground leading-relaxed">{result.narrative?.slice(0, 300)}</p>
        </div>
      )}
    </div>
  );
}

// ── Monitor Manager ─────────────────────────────────────────────────────────

function MonitorManager() {
  const [monitors, setMonitors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [timeframe, setTimeframe] = useState("1h");

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const data = await getLoopStatus();
      setMonitors(data.monitors);
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  }

  // Auto-refresh on mount
  useEffect(() => { refresh(); }, []);

  async function handleStart() {
    try {
      await startLoopMonitor({ symbol, timeframe, market: symbol.includes("=X") ? "forex" : "crypto" });
      await refresh();
    } catch { /* ignore */ }
  }

  async function handleStop(id: string) {
    try {
      await stopLoopMonitor(id);
      await refresh();
    } catch { /* ignore */ }
  }

  return (
    <div className="space-y-3">
      {/* Start new monitor form */}
      <div className="flex gap-2 items-end">
        <div className="flex-1 space-y-1">
          <label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Symbol</label>
          <input
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            className="w-full bg-muted border border-border rounded-sm px-2.5 py-1.5 text-xs text-foreground"
            placeholder="BTCUSDT"
          />
        </div>
        <div className="w-24 space-y-1">
          <label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">TF</label>
          <select value={timeframe} onChange={(e) => setTimeframe(e.target.value)}
            className="w-full bg-muted border border-border rounded-sm px-2.5 py-1.5 text-xs text-foreground">
            {["1m", "5m", "15m", "1h", "4h", "1d", "1w"].map((tf) => (
              <option key={tf} value={tf}>{tf}</option>
            ))}
          </select>
        </div>
        <button onClick={handleStart}
          className="flex items-center gap-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-sm px-2.5 py-1.5 text-xs font-bold hover:bg-emerald-500/30 transition-colors">
          <Play className="w-3 h-3" /> Start
        </button>
        <button onClick={refresh} disabled={loading}
          className="flex items-center gap-1 bg-muted border border-border rounded-sm px-2.5 py-1.5 text-xs hover:bg-muted/70 transition-colors disabled:opacity-50">
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-1.5">
          {[1, 2].map((i) => (
            <div key={i} className="flex items-center justify-between border border-border rounded-sm px-3 py-3">
              <div className="flex items-center gap-2">
                <Skeleton className="w-3 h-3 rounded-full" />
                <Skeleton className="w-20 h-3" />
                <Skeleton className="w-8 h-3" />
                <Skeleton className="w-16 h-4" />
              </div>
              <Skeleton className="w-3 h-3" />
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/30 rounded-sm p-2.5 text-xs text-destructive">
          <AlertCircle className="w-3 h-3 shrink-0" />
          {error}
          <button onClick={refresh} className="ml-auto underline">Retry</button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && monitors.length === 0 && (
        <div className="text-center py-8 space-y-2">
          <Activity className="w-6 h-6 text-muted-foreground/40 mx-auto" />
          <p className="text-xs text-muted-foreground">No active monitors.</p>
          <p className="text-[10px] text-muted-foreground/60">Start one above — it will trigger on each candle close.</p>
        </div>
      )}

      {/* Monitors list */}
      {!loading && monitors.length > 0 && (
        <div className="space-y-1.5">
          {monitors.map((m) => (
            <div key={m.id} className="flex items-center justify-between border border-border rounded-sm px-3 py-2.5 bg-muted/20 hover:bg-muted/30 transition-colors">
              <div className="flex items-center gap-2.5">
                <div className={`w-2 h-2 rounded-full ${
                  m.status === "awaiting_data" ? "bg-amber-400 animate-pulse" :
                  m.status === "running" ? "bg-emerald-400 animate-pulse" : "bg-muted-foreground"
                }`} />
                <span className="text-xs font-bold">{m.symbol}</span>
                <span className="text-[10px] font-mono text-muted-foreground">{m.timeframe}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-sm font-semibold ${
                  m.status === "running" ? "bg-emerald-500/20 text-emerald-400" :
                  m.status === "awaiting_data" ? "bg-amber-500/20 text-amber-400" :
                  "bg-muted text-muted-foreground"
                }`}>{m.status.replace(/_/g, " ")}</span>
                <span className="text-[10px] text-muted-foreground">{m.iterations} cycles</span>
              </div>
              <button
                onClick={() => handleStop(m.id)}
                className="p-1 hover:bg-destructive/10 rounded-sm transition-colors group"
                title="Stop monitor"
              >
                <Square className="w-3 h-3 text-muted-foreground group-hover:text-destructive" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Run History ─────────────────────────────────────────────────────────────

function RunHistory() {
  const [runs, setRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRun, setSelectedRun] = useState<string | null>(null);
  const [runDetail, setRunDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await getLoopRuns({ limit: 25 });
      setRuns(data.runs);
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function showDetail(id: string) {
    if (selectedRun === id) {
      setSelectedRun(null);
      setRunDetail(null);
      return;
    }
    setSelectedRun(id);
    setDetailLoading(true);
    try {
      const data = await getLoopRunDetail(id);
      setRunDetail(data);
    } catch { /* ignore */ }
    setDetailLoading(false);
  }

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{runs.length} runs recorded</span>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/30 rounded-sm p-2.5 text-xs text-destructive">
          <AlertCircle className="w-3 h-3 shrink-0" />
          {error}
          <button onClick={load} className="ml-auto underline">Retry</button>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-1">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center justify-between border border-border rounded-sm px-3 py-2.5">
              <div className="flex items-center gap-2">
                <Skeleton className="w-3 h-3 rounded-full" />
                <Skeleton className="w-16 h-3" />
                <Skeleton className="w-6 h-3" />
                <Skeleton className="w-14 h-4" />
              </div>
              <Skeleton className="w-12 h-3" />
            </div>
          ))}
        </div>
      )}

      {/* Empty */}
      {!loading && !error && runs.length === 0 && (
        <div className="text-center py-8 space-y-2">
          <Clock className="w-6 h-6 text-muted-foreground/40 mx-auto" />
          <p className="text-xs text-muted-foreground">No runs yet.</p>
          <p className="text-[10px] text-muted-foreground/60">Run a loop cycle using the Run Loop tab above.</p>
        </div>
      )}

      {/* Runs list */}
      {!loading && runs.length > 0 && (
        <div className="space-y-1 max-h-72 overflow-y-auto">
          {runs.map((run) => {
            const resultAction = run.result?.action ?? "";
            const isSelected = selectedRun === run.id;
            return (
              <button
                key={run.id}
                onClick={() => showDetail(run.id)}
                className={`w-full flex items-center justify-between border rounded-sm px-3 py-2.5 text-left transition-all ${
                  isSelected ? "border-primary/50 bg-primary/5" : "border-border hover:bg-muted/40"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {run.status === "completed" ? (
                    resultAction === "signal_generated"
                      ? <Target className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      : <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  ) : run.status === "error" ? (
                    <AlertCircle className="w-3.5 h-3.5 text-destructive shrink-0" />
                  ) : (
                    <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  )}
                  <span className="text-xs font-bold truncate">{run.symbol}</span>
                  <span className="text-[10px] font-mono text-muted-foreground">{run.timeframe}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-sm font-semibold ${
                    run.evaluation_score != null && run.evaluation_score >= 70
                      ? "bg-emerald-500/20 text-emerald-400"
                      : run.evaluation_score != null && run.evaluation_score >= 50
                        ? "bg-primary/20 text-primary"
                        : run.evaluation_score != null
                          ? "bg-muted text-muted-foreground"
                          : "bg-muted/50 text-muted-foreground"
                  }`}>
                    {run.evaluation_score != null ? `${run.evaluation_score}/100` : "—"}
                  </span>
                  {resultAction && (
                    <span className="text-[10px] text-muted-foreground hidden sm:inline truncate">
                      {resultAction.replace(/_/g, " ")}
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0">{formatTime(run.started_at)}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Detail panel */}
      {runDetail && !detailLoading && (
        <div className="border border-border rounded-sm overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 bg-muted/30 border-b border-border/60">
            <span className="text-xs font-semibold">Trace: {runDetail.steps.length} steps</span>
            <button onClick={() => { setSelectedRun(null); setRunDetail(null); }}
              className="text-[10px] text-muted-foreground hover:text-foreground">Close</button>
          </div>
          <div className="p-3 space-y-2">
            {/* Step timeline */}
            {runDetail.steps.length === 0 && (
              <p className="text-[11px] text-muted-foreground italic">No step data recorded for this run.</p>
            )}
            {runDetail.steps.map((s: any, i: number) => {
              const meta = STEP_META[s.step_type as string];
              return (
                <div key={i} className="flex items-center gap-2 text-[11px]">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${s.error ? "bg-destructive" : meta?.color ?? "bg-muted-foreground"}`} />
                  <span className="font-medium text-foreground/70 capitalize">{meta?.label ?? s.step_type}</span>
                  {s.duration_ms != null && (
                    <span className="text-muted-foreground/60 font-mono text-[10px]">{s.duration_ms}ms</span>
                  )}
                  {s.error && <span className="text-destructive text-[10px] ml-auto">error</span>}
                </div>
              );
            })}

            {/* Run config summary */}
            {runDetail.run?.config_snapshot && (
              <div className="mt-3 pt-2 border-t border-border/60">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Config</p>
                <div className="flex flex-wrap gap-2 text-[10px]">
                  <span className="px-1.5 py-0.5 rounded-sm bg-muted">Max iter: {runDetail.run.config_snapshot.maxIterations}</span>
                  <span className="px-1.5 py-0.5 rounded-sm bg-muted">Conf floor: {runDetail.run.config_snapshot.confidenceFloor}</span>
                  <span className="px-1.5 py-0.5 rounded-sm bg-muted">Max risk: {(runDetail.run.config_snapshot.maxRiskPerTrade * 100).toFixed(0)}%</span>
                </div>
                {/* Evaluation */}
                {runDetail.run.evaluation && (
                  <div className="mt-2">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Evaluation</p>
                    <div className="flex flex-wrap gap-1.5">
                      {runDetail.run.evaluation.strengths?.map((s: string, i: number) => (
                        <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-sm bg-emerald-500/15 text-emerald-400">{s}</span>
                      ))}
                      {runDetail.run.evaluation.weaknesses?.map((w: string, i: number) => (
                        <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-sm bg-destructive/15 text-destructive">{w}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Detail loading */}
      {detailLoading && (
        <div className="border border-border rounded-sm p-4 space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-3/4" />
        </div>
      )}
    </div>
  );
}

// ── Memory Viewer ───────────────────────────────────────────────────────────

function MemoryViewer() {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await getSemanticMemory({ limit: 50 });
      setEntries(data.entries);
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{entries.length} entries</span>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-1.5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="border border-border rounded-sm px-3 py-2.5 space-y-1.5">
              <div className="flex items-center gap-2">
                <Skeleton className="w-3 h-3" />
                <Skeleton className="w-40 h-3" />
                <Skeleton className="w-12 h-3" />
              </div>
              <Skeleton className="h-3 w-full" />
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/30 rounded-sm p-2.5 text-xs text-destructive">
          <AlertCircle className="w-3 h-3 shrink-0" />
          {error}
          <button onClick={load} className="ml-auto underline">Retry</button>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && entries.length === 0 && (
        <div className="text-center py-8 space-y-2">
          <Database className="w-6 h-6 text-muted-foreground/40 mx-auto" />
          <p className="text-xs text-muted-foreground">No memory entries yet.</p>
          <p className="text-[10px] text-muted-foreground/60">Run the agent loop to generate evaluation insights.</p>
        </div>
      )}

      {/* Entries */}
      {!loading && entries.length > 0 && (
        <div className="space-y-1.5 max-h-96 overflow-y-auto">
          {entries.map((e) => (
            <div key={e.id} className="border border-border rounded-sm px-3 py-2.5 hover:bg-muted/20 transition-colors">
              <div className="flex items-center gap-2 mb-1">
                <Database className="w-3 h-3 text-primary shrink-0" />
                <span className="text-[10px] font-mono text-muted-foreground truncate max-w-[240px]">{e.key}</span>
                <span className={`text-[9px] px-1 py-0.5 rounded-sm font-semibold ${
                  e.source === "matrix" ? "bg-blue-500/20 text-blue-400" :
                  e.source === "evaluation" ? "bg-purple-500/20 text-purple-400" :
                  e.source === "manual" ? "bg-emerald-500/20 text-emerald-400" :
                  "bg-muted text-muted-foreground"
                }`}>{e.source}</span>
                <span className="text-[10px] text-muted-foreground ml-auto">{e.score > 0 ? `${(e.score * 100).toFixed(0)}%` : "—"}</span>
              </div>
              <p className="text-[11px] text-foreground/80 leading-relaxed">{e.content}</p>
              {e.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {e.tags.map((tag: string, i: number) => (
                    <span key={i} className="text-[9px] px-1 py-0.5 rounded-sm bg-muted text-muted-foreground">{tag}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
