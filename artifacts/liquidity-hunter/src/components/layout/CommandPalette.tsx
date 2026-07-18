import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { Search, Zap, Brain, Target, BookOpen, FlaskConical, Bot, Activity, Layers, ChevronRight, X } from "lucide-react";

interface CmdEntry {
  id: string;
  label: string;
  description: string;
  icon: typeof Zap;
  action: () => void;
  category: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  symbol?: string;
  market?: string;
  onViewChange?: (view: string) => void;
}

export function CommandPalette({ open, onClose, symbol = "BTCUSDT", market = "crypto", onViewChange }: Props) {
  const [, setLocation] = useLocation();
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands: CmdEntry[] = [
    { id: "analyze-market", label: "Analyse Market", description: `Inspect ${symbol} current market structure`, icon: Activity, category: "Analysis", action: () => { onViewChange?.("market"); onClose(); } },
    { id: "run-cascade", label: "Run 7-TF Cascade", description: "Multi-timeframe structural alignment", icon: Layers, category: "Analysis", action: () => { setLocation("/"); onClose(); } },
    { id: "strategy-atlas", label: "Open Strategy Atlas", description: "Browse 59 model definitions", icon: Brain, category: "Strategies", action: () => { onViewChange?.("analyze"); onClose(); } },
    { id: "smc-eval", label: "Run SMC-EVAL", description: "Evaluate AI reasoning (100 scenarios)", icon: FlaskConical, category: "Evaluate", action: () => { onViewChange?.("evaluate"); onClose(); } },
    { id: "ask-agent", label: "Ask Pulse Agent", description: "Talk to the intelligence interface", icon: Bot, category: "Agent", action: () => { onViewChange?.("agent"); onClose(); } },
    { id: "view-learning", label: "View Learning", description: "Inspect evidence, reliability, outcomes", icon: BookOpen, category: "Learn", action: () => { onViewChange?.("learn"); onClose(); } },
    { id: "overview", label: "Command Center", description: "Return to system overview", icon: Zap, category: "Navigate", action: () => { onViewChange?.("overview"); onClose(); } },
    { id: "trade-intent", label: "Trade Intelligence", description: "View signals and execution layer", icon: Target, category: "Trade", action: () => { onViewChange?.("trade"); onClose(); } },
    { id: "analytics", label: "Trade Analytics", description: "Ledger, performance matrix, backtest", icon: Target, category: "Trade", action: () => { setLocation("/analytics"); onClose(); } },
    { id: "broker", label: "Broker Status", description: "Connection, mode, account, orders", icon: Target, category: "Trade", action: () => { setLocation("/broker"); onClose(); } },
    { id: "agent-loop", label: "Agent Loop Dashboard", description: "Loop runner, monitors, history", icon: Bot, category: "Agent", action: () => { setLocation("/agent-loop"); onClose(); } },
  ];

  const filtered = query.trim()
    ? commands.filter(c => c.label.toLowerCase().includes(query.toLowerCase()) || c.description.toLowerCase().includes(query.toLowerCase()) || c.category.toLowerCase().includes(query.toLowerCase()))
    : commands;

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, filtered.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)); }
    if (e.key === "Enter" && filtered[selectedIdx]) { filtered[selectedIdx].action(); }
    if (e.key === "Escape") { onClose(); }
  }, [filtered, selectedIdx, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[14vh] bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-[min(620px,calc(100vw-32px))] rounded-sm border border-border/30 bg-background shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center gap-3 p-4 border-b border-border/50">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setSelectedIdx(0); }}
            placeholder="Search capabilities, markets, strategies..."
            className="flex-1 bg-transparent outline-none text-sm font-mono"
          />
          <kbd className="text-[10px] text-muted-foreground font-mono px-1.5 py-0.5 rounded border border-border bg-muted">ESC</kbd>
        </div>

        <div className="p-2 max-h-[400px] overflow-y-auto">
          {filtered.length === 0 && (
            <div className="p-6 text-center text-sm text-muted-foreground font-mono">
              No capabilities match "{query}"
            </div>
          )}
          {filtered.map((cmd, i) => {
            const Icon = cmd.icon;
            return (
              <button
                key={cmd.id}
                onClick={cmd.action}
                className={`w-full flex items-center gap-3 p-3 rounded-sm text-left transition-colors ${
                  i === selectedIdx ? "bg-primary/10 text-primary" : "hover:bg-muted/50 text-foreground"
                }`}
              >
                <div className="w-8 h-8 rounded-sm bg-primary/10 text-primary flex items-center justify-center">
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{cmd.label}</div>
                  <div className="text-xs text-muted-foreground font-mono truncate">{cmd.description}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">{cmd.category}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40" />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
