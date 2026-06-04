import { useState } from "react";
import { Zap, ChevronDown, ChevronUp, Loader2, Play } from "lucide-react";
import { runAgentPipeline, type PipelineEvent } from "@/lib/api";
import type { SmcReport } from "@workspace/api-client-react";

const AGENTS = ["Structure Agent", "Liquidity Agent", "FVG Agent", "Confluence Agent"];
const AGENT_DESC: Record<string, string> = {
  "Structure Agent": "Analyzes MSS, BOS, trend control",
  "Liquidity Agent": "Maps BSL/SSL pools and hunt probability",
  "FVG Agent": "Identifies imbalance zones and fill likelihood",
  "Confluence Agent": "Synthesizes all agents into final narrative",
};

type AgentState = { status: "idle" | "running" | "done" | "error"; text: string };

type Props = { report: SmcReport };

export function AgentPipeline({ report }: Props) {
  const [agentStates, setAgentStates] = useState<Record<string, AgentState>>(
    Object.fromEntries(AGENTS.map(a => [a, { status: "idle", text: "" }]))
  );
  const [running, setRunning] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [started, setStarted] = useState(false);

  async function handleRun() {
    setRunning(true);
    setStarted(true);
    setAgentStates(Object.fromEntries(AGENTS.map(a => [a, { status: "idle", text: "" }])));

    try {
      await runAgentPipeline(report, (event: PipelineEvent) => {
        if (event.type === "pipeline_done") {
          setRunning(false);
          return;
        }
        if (!("agent" in event)) return;
        const { agent } = event;
        setAgentStates(prev => {
          const cur = prev[agent] ?? { status: "idle", text: "" };
          if (event.type === "start") return { ...prev, [agent]: { ...cur, status: "running" } };
          if (event.type === "delta") return { ...prev, [agent]: { ...cur, text: cur.text + event.content } };
          if (event.type === "done") {
            setExpanded(e => ({ ...e, [agent]: true }));
            return { ...prev, [agent]: { ...cur, status: "done" } };
          }
          if (event.type === "error") return { ...prev, [agent]: { status: "error", text: event.content } };
          return prev;
        });
      });
    } catch {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Agent Pipeline</span>
        </div>
        {!running && (
          <button
            onClick={handleRun}
            className="flex items-center gap-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-sm px-2.5 py-1 text-xs font-semibold transition-colors"
          >
            <Play className="w-3 h-3" />
            {started ? "Re-run" : "Run Pipeline"}
          </button>
        )}
        {running && (
          <div className="flex items-center gap-1.5 text-xs text-primary">
            <Loader2 className="w-3 h-3 animate-spin" />
            Reasoning…
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        {AGENTS.map(agent => {
          const state = agentStates[agent];
          const isOpen = expanded[agent];
          const hasText = state.text.length > 0;

          return (
            <div
              key={agent}
              className={`border rounded-sm overflow-hidden transition-colors ${
                state.status === "running" ? "border-primary/50 bg-primary/5" :
                state.status === "done" ? "border-border bg-muted/20" :
                state.status === "error" ? "border-destructive/40 bg-destructive/5" :
                "border-border/50 bg-transparent"
              }`}
            >
              <button
                className="w-full flex items-center justify-between px-3 py-2 text-left"
                onClick={() => hasText && setExpanded(e => ({ ...e, [agent]: !isOpen }))}
              >
                <div className="flex items-center gap-2">
                  {state.status === "running" && <Loader2 className="w-3 h-3 animate-spin text-primary shrink-0" />}
                  {state.status === "done" && <span className="w-3 h-3 rounded-full bg-[hsl(var(--bullish))] shrink-0 block" />}
                  {state.status === "error" && <span className="w-3 h-3 rounded-full bg-destructive shrink-0 block" />}
                  {state.status === "idle" && <span className="w-3 h-3 rounded-full border border-border shrink-0 block" />}
                  <div>
                    <span className="text-xs font-semibold">{agent}</span>
                    {!hasText && <span className="ml-2 text-[10px] text-muted-foreground">{AGENT_DESC[agent]}</span>}
                  </div>
                </div>
                {hasText && (
                  isOpen ? <ChevronUp className="w-3 h-3 text-muted-foreground" /> : <ChevronDown className="w-3 h-3 text-muted-foreground" />
                )}
              </button>

              {hasText && isOpen && (
                <div className="px-3 pb-3">
                  <p className="text-xs text-foreground/90 leading-relaxed whitespace-pre-wrap">{state.text}</p>
                </div>
              )}
              {state.status === "running" && state.text && !isOpen && (
                <div className="px-3 pb-2">
                  <p className="text-xs text-muted-foreground truncate">{state.text.slice(-120)}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
