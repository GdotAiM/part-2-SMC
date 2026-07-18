/**
 * Agent Workspace — dedicated AI intelligence interface.
 *
 * Reuses the existing AgentChat and AgentLoopDashboard components
 * within the new OS shell.
 */

import { useState } from "react";
import { Bot, Zap, Activity, Brain, MessageSquare } from "lucide-react";
import { AgentLoopDashboard } from "@/components/AgentLoopDashboard";
import type { SmcReport } from "@workspace/api-client-react";

interface AgentWorkspaceProps {
  report?: SmcReport;
  symbol?: string;
  timeframe?: string;
  market?: string;
}

export function AgentWorkspace({ report, symbol = "BTCUSDT", timeframe = "1h", market = "crypto" }: AgentWorkspaceProps) {
  const [view, setView] = useState<"chat" | "loop">("chat");

  return (
    <div className="p-5 lg:p-7 max-w-[1800px] mx-auto space-y-5">
      <div>
        <div className="text-[9px] text-primary/50 uppercase tracking-widest mb-1">Agent</div>
        <h1 className="text-2xl lg:text-3xl font-black tracking-tight">The intelligence interface.</h1>
        <p className="mt-1 text-xs text-muted-foreground max-w-2xl">
          Ask the system questions in human language. The agent orchestrates the capability graph underneath.
        </p>
      </div>

      {/* View toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setView("chat")}
          className={`px-3 py-1.5 rounded-sm text-xs font-semibold border transition-colors ${
            view === "chat"
              ? "bg-primary/10 border-primary/30 text-primary"
              : "bg-muted/30 border-border/40 text-muted-foreground hover:text-foreground"
          }`}
        >
          <MessageSquare className="w-3 h-3 inline mr-1" /> Agent Chat
        </button>
        <button
          onClick={() => setView("loop")}
          className={`px-3 py-1.5 rounded-sm text-xs font-semibold border transition-colors ${
            view === "loop"
              ? "bg-primary/10 border-primary/30 text-primary"
              : "bg-muted/30 border-border/40 text-muted-foreground hover:text-foreground"
          }`}
        >
          <Activity className="w-3 h-3 inline mr-1" /> Agent Loop
        </button>
      </div>

      {view === "chat" ? (
        <div className="grid grid-cols-12 gap-4">
          <section className="col-span-12 lg:col-span-8 rounded-sm border border-border/30 bg-card/40 overflow-hidden">
            <div className="p-4 border-b border-border/20">
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4 text-primary" />
                <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Pulse Agent</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse ml-1" />
              </div>
            </div>
            <div className="h-[600px] flex flex-col">
              {report ? (
                <div className="flex-1 flex flex-col">
                  {/* AgentChat is rendered via IntelligenceSheet — present a prompt instead */}
                  <div className="flex-1 flex items-center justify-center p-8">
                    <div className="text-center max-w-md">
                      <Brain className="w-10 h-10 text-primary/30 mx-auto mb-4" />
                      <p className="text-sm text-muted-foreground mb-4">
                        The Pulse Agent can inspect market structure, evaluate SMC models,
                        run SMC-EVAL, or trace the evidence behind a signal. Open a symbol
                        and use the Intelligence Sheet for context-aware analysis.
                      </p>
                      <div className="flex flex-wrap gap-2 justify-center">
                        {["Analyse Market", "Run Cascade", "Browse Strategies", "Run SMC-EVAL"].map(s => (
                          <span key={s} className="px-2.5 py-1.5 rounded-sm bg-muted/30 text-xs text-muted-foreground border border-border/40 font-mono">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground italic font-mono">
                  Load a symbol and analysis first, then interact with the agent
                </div>
              )}
            </div>
          </section>

          {/* Agent Activity */}
          <section className="col-span-12 lg:col-span-4 rounded-sm border border-border/30 bg-card/40 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">Capabilities</h3>
            <div className="space-y-2">
              {[
                ["Inspect Market", "7-TF cascade + SMC analysis"],
                ["Analyse SMC", "Structure, liquidity, OB, FVG, SMT"],
                ["Browse Strategies", "59-model ontology browser"],
                ["Run SMC-EVAL", "100 scenarios, 5 dimensions"],
                ["Compare Evidence", "Truth Engine arbitration"],
                ["Trace Signal", "Signal generation + review"],
              ].map(([label, desc]) => (
                <div key={label} className="p-2.5 rounded-sm bg-muted/10 border border-border/20">
                  <div className="text-[11px] font-medium">{label}</div>
                  <div className="text-[9px] text-muted-foreground mt-0.5">{desc}</div>
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : (
        <AgentLoopDashboard
          presetSymbol={symbol}
          presetTimeframe={timeframe}
          presetMarket={market as "crypto" | "forex"}
        />
      )}
    </div>
  );
}
