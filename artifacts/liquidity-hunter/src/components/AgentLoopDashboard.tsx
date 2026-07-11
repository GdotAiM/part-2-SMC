import { useState } from "react";
import {
  Activity, Play, Square, Clock, ChevronDown, ChevronUp,
  Loader2, Brain, Database, Target, AlertCircle, CheckCircle,
} from "lucide-react";
import {
  runAgentLoop, startLoopMonitor, stopLoopMonitor,
  getLoopStatus, getLoopRuns, getLoopRunDetail, getSemanticMemory,
  type LoopStepEvent,
} from "@/lib/api";

type View = "loop" | "monitors" | "history" | "memory";

export function AgentLoopDashboard() {
  const [view, setView] = useState<View>("loop");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <Brain className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold uppercase tracking-wider">Agent Loop</span>
        <div className="flex-1" />
        <div className="flex gap-1">
          {(["loop", "monitors", "history", "memory"] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`text-[11px] px-2.5 py-1 rounded-sm font-medium transition-colors ${
                view === v
                  ? "bg-primary/20 text-primary border border-primary/30"
                  : "text-muted-foreground hover:text-foreground border border-transparent"
              }`}
            >
              {v === "loop" ? "Run Loop" : v === "monitors" ? "Monitors" : v === "history" ? "History" : "Memory"}
            </button>
          ))}
        </div>
      </div>

      {view === "loop" && <LoopRunner />}
      {view === "monitors" && <MonitorManager />}
      {view === "history" && <RunHistory />}
      {view === "memory" && <MemoryViewer />}
    </div>
  );
}

// ── Loop Runner ──────────────────────────────────────────────────────────

function LoopRunner() {
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [timeframe, setTimeframe] = useState("4h");
  const [running, setRunning] = useState(false);
  const [events, setEvents] = useState<LoopStepEvent[]>([]);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRun() {
    setRunning(true);
    setEvents([]);
    setResult(null);
    setError(null);

    try {
      await runAgentLoop({ symbol, timeframe, market: symbol.includes("=X") ? "forex" : "crypto" }, (event) => {
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
      <div className="flex gap-2 items-end">
        <div className="flex-1 space-y-1">
          <label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Symbol</label>
          <input
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            className="w-full bg-muted border border-border rounded-sm px-2.5 py-1.5 text-xs text-foreground"
            placeholder="BTCUSDT"
          />
        </div>
        <div className="w-24 space-y-1">
          <label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Timeframe</label>
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value)}
            className="w-full bg-muted border border-border rounded-sm px-2.5 py-1.5 text-xs text-foreground"
          >
            {["1m", "5m", "15m", "1h", "4h", "1d", "1w"].map((tf) => (
              <option key={tf} value={tf}>{tf}</option>
            ))}
          </select>
        </div>
        <button
          onClick={handleRun}
          disabled={running}
          className="flex items-center gap-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-sm px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50"
        >
          {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
          {running ? "Running..." : "Run Loop"}
        </button>
      </div>

      {/* Events stream */}
      {events.length > 0 && (
        <div className="space-y-1 max-h-64 overflow-y-auto border border-border rounded-sm p-2 bg-muted/30">
          {events.map((evt, i) => (
            <div key={i} className="flex items-start gap-2 text-[11px]">
              {evt.type === "loop_step" && <Activity className="w-3 h-3 text-primary mt-0.5 shrink-0" />}
              {evt.type === "loop_decision" && <Brain className="w-3 h-3 text-amber-400 mt-0.5 shrink-0" />}
              {evt.type === "loop_signal" && <Target className="w-3 h-3 text-emerald-400 mt-0.5 shrink-0" />}
              {evt.type === "loop_complete" && <CheckCircle className="w-3 h-3 text-emerald-400 mt-0.5 shrink-0" />}
              {evt.type === "loop_error" && <AlertCircle className="w-3 h-3 text-destructive mt-0.5 shrink-0" />}
              <div className="text-muted-foreground">
                <span className="font-medium text-foreground">
                  {evt.type === "loop_step" ? `Step: ${evt.step?.type ?? ""}` :
                   evt.type === "loop_decision" ? "Decision" :
                   evt.type === "loop_signal" ? "Signal Generated" :
                   evt.type === "loop_complete" ? `Complete: ${evt.result?.action ?? ""}` : "Error"}
                </span>
                {evt.decision && <p className="mt-0.5">{evt.decision.reasoning?.slice(0, 120)}</p>}
                {evt.result?.action && <p className="mt-0.5">→ {evt.result.action} ({evt.result.confidence}%)</p>}
                {evt.signal && <p className="mt-0.5">Entry: {evt.signal.entry_price} SL: {evt.signal.stop_loss} TP: {evt.signal.take_profit}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-sm p-2.5 text-xs text-destructive">
          {error}
        </div>
      )}

      {result && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-sm p-2.5 text-xs">
          <span className="font-semibold text-emerald-400">Result:</span> {result.action} (confidence: {result.confidence}%)
          <p className="text-muted-foreground mt-1">{result.narrative?.slice(0, 200)}</p>
        </div>
      )}
    </div>
  );
}

// ── Monitor Manager ──────────────────────────────────────────────────────

function MonitorManager() {
  const [monitors, setMonitors] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [timeframe, setTimeframe] = useState("1h");

  async function refresh() {
    setLoading(true);
    try {
      const data = await getLoopStatus();
      setMonitors(data.monitors);
    } catch { /* ignore */ }
    setLoading(false);
  }

  async function handleStart() {
    try {
      await startLoopMonitor({ symbol, timeframe, market: symbol.includes("=X") ? "forex" : "crypto" });
      refresh();
    } catch { /* ignore */ }
  }

  async function handleStop(id: string) {
    try {
      await stopLoopMonitor(id);
      refresh();
    } catch { /* ignore */ }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2 items-end">
        <div className="flex-1 space-y-1">
          <label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Symbol</label>
          <input value={symbol} onChange={(e) => setSymbol(e.target.value)}
            className="w-full bg-muted border border-border rounded-sm px-2.5 py-1.5 text-xs text-foreground" />
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
          className="flex items-center gap-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-sm px-2.5 py-1.5 text-xs font-semibold">
          <Play className="w-3 h-3" /> Start
        </button>
        <button onClick={refresh} disabled={loading}
          className="flex items-center gap-1 bg-muted border border-border rounded-sm px-2.5 py-1.5 text-xs disabled:opacity-50">
          <Loader2 className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {monitors.length === 0 && !loading && (
        <p className="text-xs text-muted-foreground text-center py-6">No active monitors. Start one above.</p>
      )}

      <div className="space-y-1.5">
        {monitors.map((m) => (
          <div key={m.id} className="flex items-center justify-between border border-border rounded-sm px-3 py-2 bg-muted/20">
            <div className="flex items-center gap-2">
              <Activity className={`w-3 h-3 ${m.status === "awaiting_data" ? "text-amber-400" : "text-emerald-400"}`} />
              <span className="text-xs font-medium">{m.symbol}</span>
              <span className="text-[10px] text-muted-foreground">{m.timeframe}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-sm ${
                m.status === "running" ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"
              }`}>{m.status}</span>
              <span className="text-[10px] text-muted-foreground">{m.iterations} iterations</span>
            </div>
            <button onClick={() => handleStop(m.id)}
              className="text-[10px] text-destructive hover:text-destructive/80">
              <Square className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Run History ──────────────────────────────────────────────────────────

function RunHistory() {
  const [runs, setRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRun, setSelectedRun] = useState<string | null>(null);
  const [runDetail, setRunDetail] = useState<any>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await getLoopRuns({ limit: 20 });
      setRuns(data.runs);
    } catch { /* ignore */ }
    setLoading(false);
  }

  async function showDetail(id: string) {
    setSelectedRun(id);
    try {
      const data = await getLoopRunDetail(id);
      setRunDetail(data);
    } catch { /* ignore */ }
  }

  return (
    <div className="space-y-2">
      <button onClick={load} disabled={loading}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-2">
        <Loader2 className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} /> Refresh
      </button>

      {runs.length === 0 && !loading && (
        <p className="text-xs text-muted-foreground text-center py-6">No runs yet.</p>
      )}

      <div className="space-y-1 max-h-60 overflow-y-auto">
        {runs.map((run) => (
          <button
            key={run.id}
            onClick={() => showDetail(run.id)}
            className={`w-full flex items-center justify-between border rounded-sm px-3 py-2 text-left transition-colors ${
              selectedRun === run.id ? "border-primary/50 bg-primary/5" : "border-border hover:bg-muted/30"
            }`}
          >
            <div className="flex items-center gap-2">
              {run.status === "completed" ? <CheckCircle className="w-3 h-3 text-emerald-400" /> :
               run.status === "error" ? <AlertCircle className="w-3 h-3 text-destructive" /> :
               <Clock className="w-3 h-3 text-amber-400" />}
              <span className="text-xs font-medium">{run.symbol}</span>
              <span className="text-[10px] text-muted-foreground">{run.timeframe}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-sm ${
                run.evaluation_score != null && run.evaluation_score >= 60
                  ? "bg-emerald-500/20 text-emerald-400"
                  : "bg-muted text-muted-foreground"
              }`}>{run.evaluation_score != null ? `${run.evaluation_score}/100` : "—"}</span>
            </div>
            <span className="text-[10px] text-muted-foreground">{run.triggered_by}</span>
          </button>
        ))}
      </div>

      {runDetail && (
        <div className="border border-border rounded-sm p-3 space-y-2 bg-muted/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold">Steps ({runDetail.steps.length})</span>
            <button onClick={() => { setSelectedRun(null); setRunDetail(null); }}
              className="text-[10px] text-muted-foreground">Close</button>
          </div>
          <div className="space-y-1">
            {runDetail.steps.map((s: any, i: number) => (
              <div key={i} className="flex items-center gap-2 text-[11px]">
                <span className={`w-1.5 h-1.5 rounded-full ${
                  s.error ? "bg-destructive" : s.step_type === "interpret" ? "bg-blue-400" : "bg-emerald-400"
                }`} />
                <span className="font-medium">{s.step_type}</span>
                {s.duration_ms != null && <span className="text-muted-foreground">({s.duration_ms}ms)</span>}
                {s.error && <span className="text-destructive">error</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Memory Viewer ────────────────────────────────────────────────────────

function MemoryViewer() {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await getSemanticMemory({ limit: 50 });
      setEntries(data.entries);
    } catch { /* ignore */ }
    setLoading(false);
  }

  return (
    <div className="space-y-2">
      <button onClick={load} disabled={loading}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-2">
        <Loader2 className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} /> {loading ? "Loading..." : "Load Memory"}
      </button>

      {entries.length === 0 && !loading && (
        <p className="text-xs text-muted-foreground text-center py-6">No memory entries yet. Run the loop to generate them.</p>
      )}

      <div className="space-y-1.5 max-h-80 overflow-y-auto">
        {entries.map((e) => (
          <div key={e.id} className="border border-border rounded-sm px-3 py-2">
            <div className="flex items-center gap-2 mb-1">
              <Database className="w-3 h-3 text-primary" />
              <span className="text-[10px] font-mono text-muted-foreground truncate max-w-[200px]">{e.key}</span>
              <span className="text-[10px] px-1 py-0.5 rounded-sm bg-muted">{e.source}</span>
              <span className="text-[10px] text-muted-foreground ml-auto">{(e.score * 100).toFixed(0)}%</span>
            </div>
            <p className="text-[11px] text-foreground leading-relaxed">{e.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
