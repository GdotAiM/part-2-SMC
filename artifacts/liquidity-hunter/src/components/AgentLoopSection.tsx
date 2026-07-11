import { useState } from "react";
import {
  Play, Loader2, Activity, Brain, Target, CheckCircle, AlertCircle,
  ChevronDown, ChevronUp, Zap, Clock,
} from "lucide-react";
import { runAgentLoop, type LoopStepEvent } from "@/lib/api";

type Props = {
  symbol: string;
  timeframe: string;
  market: "crypto" | "forex";
};

export function AgentLoopSection({ symbol, timeframe, market }: Props) {
  const [running, setRunning] = useState(false);
  const [events, setEvents] = useState<LoopStepEvent[]>([]);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  async function handleRun() {
    setRunning(true);
    setEvents([]);
    setResult(null);
    setError(null);
    setExpanded(true);

    try {
      await runAgentLoop({ symbol, timeframe, market }, (event) => {
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
    <div className="border border-border rounded-sm overflow-hidden">
      {/* ── Header ── */}
      <button
        onClick={() => !running && setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/20 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-xs font-semibold uppercase tracking-wider">Agent Loop</span>
          <span className="text-[10px] text-muted-foreground">Full decision cycle</span>
        </div>
        <div className="flex items-center gap-2">
          {running && <Loader2 className="w-3 h-3 animate-spin text-primary" />}
          {result && !running && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-sm font-bold ${
              result.action === "signal_generated"
                ? "bg-emerald-500/20 text-emerald-400"
                : result.action === "analysis_complete"
                  ? "bg-primary/20 text-primary"
                  : "bg-muted text-muted-foreground"
            }`}>{result.action.replace(/_/g, " ")}</span>
          )}
          {running ? null : expanded ? <ChevronUp className="w-3 h-3 text-muted-foreground" /> : <ChevronDown className="w-3 h-3 text-muted-foreground" />}
        </div>
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          {/* ── Info note ── */}
          <div className="flex items-start gap-2 px-2 py-1.5 rounded-sm bg-amber-500/8 border border-amber-500/20 text-[10px] text-muted-foreground">
            <Zap className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
            <span>Runs a full 7-step decision cycle: observe market data, interpret via 8 SMC tools, reason with LLM, guardrail check, act (signal/no-action), evaluate, update memory. Results are stored in the agent loop ledger.</span>
          </div>

          {/* ── Run button ── */}
          <button
            onClick={handleRun}
            disabled={running}
            className="w-full flex items-center justify-center gap-2 bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/30 rounded-sm px-3 py-2 text-xs font-bold transition-colors disabled:opacity-50"
          >
            {running ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Running Agent Loop...</>
            ) : (
              <><Play className="w-4 h-4" /> Run Full Agent Loop</>
            )}
          </button>

          {/* ── Step timeline ── */}
          {events.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Cycle Timeline</p>
              {events
                .filter((e) => e.type === "loop_step")
                .map((evt, i) => {
                  const step = evt.step;
                  const duration = step?.completedAt && step?.startedAt
                    ? `+${step.completedAt - step.startedAt}ms`
                    : "";
                  return (
                    <div key={i} className="flex items-center gap-2 text-[11px]">
                      {/* Step indicator dot */}
                      <span className={`w-2 h-2 rounded-full shrink-0 ${
                        step?.type === "observe" ? "bg-blue-400" :
                        step?.type === "interpret" ? "bg-purple-400" :
                        step?.type === "reason" ? "bg-amber-400" :
                        step?.type === "decide" ? "bg-orange-400" :
                        step?.type === "act" ? "bg-emerald-400" :
                        step?.type === "evaluate" ? "bg-cyan-400" :
                        "bg-muted-foreground"
                      }`} />
                      <span className="font-medium capitalize text-muted-foreground/80">{step?.type}</span>
                      {duration && <span className="text-muted-foreground/50 ml-auto">{duration}</span>}
                    </div>
                  );
                })}

              {/* Decision event */}
              {events.find((e) => e.type === "loop_decision") && (() => {
                const d = events.find((e) => e.type === "loop_decision")!.decision;
                return (
                  <div className="flex items-start gap-2 text-[11px] bg-primary/8 border border-primary/20 rounded-sm px-2 py-1.5 mt-1">
                    <Brain className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-medium text-foreground">Decision: {d.action.replace(/_/g, " ")}</span>
                      <span className="text-muted-foreground ml-1">({d.confidence}%)</span>
                      <p className="text-muted-foreground mt-0.5">{d.reasoning?.slice(0, 180)}</p>
                    </div>
                  </div>
                );
              })()}

              {/* Signal event */}
              {events.find((e) => e.type === "loop_signal") && (() => {
                const s = events.find((e) => e.type === "loop_signal")!.signal;
                return (
                  <div className="flex items-start gap-2 text-[11px] bg-emerald-500/10 border border-emerald-500/25 rounded-sm px-2 py-1.5 mt-1">
                    <Target className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-medium text-emerald-400">Signal Generated</span>
                      <p className="text-muted-foreground mt-0.5">
                        Entry: {s.entry_price} · SL: {s.stop_loss} · TP: {s.take_profit}
                      </p>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* ── Error ── */}
          {error && (
            <div className="flex items-start gap-2 text-[11px] bg-destructive/10 border border-destructive/30 rounded-sm px-2 py-1.5">
              <AlertCircle className="w-3 h-3 text-destructive shrink-0 mt-0.5" />
              <span className="text-destructive">{error}</span>
            </div>
          )}

          {/* ── Result ── */}
          {result && (
            <div className={`rounded-sm px-2.5 py-2 text-[11px] ${
              result.action === "signal_generated"
                ? "bg-emerald-500/10 border border-emerald-500/25"
                : result.action === "analysis_complete"
                  ? "bg-primary/8 border border-primary/20"
                  : "bg-muted/30 border border-border"
            }`}>
              <div className="flex items-center gap-1.5 mb-1">
                {result.action === "signal_generated" ? (
                  <CheckCircle className="w-3 h-3 text-emerald-400" />
                ) : result.action === "analysis_complete" ? (
                  <Brain className="w-3 h-3 text-primary" />
                ) : (
                  <Clock className="w-3 h-3 text-muted-foreground" />
                )}
                <span className="font-semibold capitalize">{result.action.replace(/_/g, " ")}</span>
                <span className="text-muted-foreground">· {result.confidence}% confidence</span>
                <span className="ml-auto text-[10px] text-muted-foreground">
                  Score: {events.find(e => e.type === "loop_step" && e.step?.type === "evaluate") ? "pending" : "—"}
                </span>
              </div>
              <p className="text-muted-foreground leading-relaxed">{result.narrative?.slice(0, 240)}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
