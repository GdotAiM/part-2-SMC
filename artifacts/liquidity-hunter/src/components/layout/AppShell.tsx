import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { CommandPalette } from "./CommandPalette";
import {
  Zap, Activity, Brain, Target, BookOpen, FlaskConical, Bot,
  ChevronRight, Search, Grid3X3, TrendingUp, TrendingDown, Minus
} from "lucide-react";

export type OsView = "overview" | "market" | "analyze" | "trade" | "learn" | "evaluate" | "agent";

interface AppShellProps {
  children: React.ReactNode;
  currentView: OsView;
  onViewChange: (view: OsView) => void;
  symbol?: string;
  market?: string;
}

const NAV_ITEMS: Array<{ id: OsView; label: string; icon: typeof Zap; desc: string }> = [
  { id: "overview", label: "Overview", icon: Grid3X3, desc: "Command center" },
  { id: "market", label: "Market", icon: Activity, desc: "Market intelligence" },
  { id: "analyze", label: "Analyze", icon: Brain, desc: "Strategy Atlas" },
  { id: "trade", label: "Trade", icon: Target, desc: "Review & execute" },
  { id: "learn", label: "Learn", icon: BookOpen, desc: "Truth Engine" },
  { id: "evaluate", label: "Evaluate", icon: FlaskConical, desc: "SMC-EVAL" },
  { id: "agent", label: "Agent", icon: Bot, desc: "Intelligence interface" },
];

export function AppShell({ children, currentView, onViewChange, symbol = "BTCUSDT", market = "crypto" }: AppShellProps) {
  const [cmdOpen, setCmdOpen] = useState(false);
  const [, setLocation] = useLocation();

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      setCmdOpen(o => !o);
    }
    if (e.key === "Escape") setCmdOpen(false);
  }, []);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="min-h-screen bg-background text-foreground font-mono flex">
      {/* ── Sidebar ── */}
      <aside className="w-[220px] hidden lg:flex flex-col border-r border-border/40 bg-card/30 shrink-0">
        {/* Logo */}
        <div className="px-4 pt-4 pb-6 border-b border-border/20">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-sm bg-gradient-to-br from-primary to-fuchsia-500 flex items-center justify-center text-xs font-black text-primary-foreground shadow-sm">
              P
            </div>
            <div>
              <div className="text-sm font-bold tracking-tight text-foreground">SMC PULSE</div>
              <div className="text-[9px] text-primary/50 tracking-widest uppercase">Intelligence OS</div>
            </div>
          </div>
        </div>

        {/* Command button */}
        <button
          onClick={() => setCmdOpen(true)}
          className="mx-3 mt-3 flex items-center gap-2 px-3 py-2 rounded-sm border border-border/40 bg-muted/30 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <Search className="w-3 h-3" />
          <span>Search capabilities</span>
          <kbd className="ml-auto text-[9px] px-1 py-0.5 rounded bg-muted border border-border text-muted-foreground">⌘K</kbd>
        </button>

        {/* Navigation */}
        <nav className="mt-4 px-3 space-y-0.5">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            const active = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onViewChange(item.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-sm text-xs transition-all ${
                  active
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${active ? "text-primary" : ""}`} />
                <div className="flex-1 text-left">
                  <div className="font-semibold">{item.label}</div>
                  <div className="text-[9px] text-muted-foreground/50">{item.desc}</div>
                </div>
                {active && <span className="w-1 h-1 rounded-full bg-primary shadow-[0_0_6px_hsl(var(--primary))]" />}
              </button>
            );
          })}
        </nav>

        {/* Quick actions */}
        <div className="mt-auto px-3 pb-4">
          <div className="text-[9px] text-muted-foreground/40 uppercase tracking-wider mb-2 px-3">System</div>
          <div className="rounded-sm border border-border/30 bg-card/50 p-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] text-emerald-400">Online</span>
            </div>
            <div className="text-[9px] text-muted-foreground">150+ capabilities</div>
            <div className="mt-1.5 h-1 rounded-full bg-muted overflow-hidden">
              <div className="h-full w-[68%] rounded-full bg-gradient-to-r from-primary to-cyan-400" />
            </div>
            <div className="text-[8px] text-muted-foreground/50 mt-1">68% surfaced</div>
          </div>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 min-w-0 flex flex-col">
        {/* Top bar */}
        <header className="h-14 border-b border-border/30 flex items-center justify-between px-4 lg:px-6 shrink-0 bg-card/20">
          <div className="flex items-center gap-3">
            {/* Mobile menu */}
            <div className="flex lg:hidden items-center gap-2">
              <select
                value={currentView}
                onChange={e => onViewChange(e.target.value as OsView)}
                className="bg-muted border border-border text-xs rounded-sm px-2 py-1 font-semibold"
              >
                {NAV_ITEMS.map(n => <option key={n.id} value={n.id}>{n.label}</option>)}
              </select>
            </div>
            <div className="text-xs text-muted-foreground">
              <span className="hidden sm:inline">{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* ⌘K button (mobile) */}
            <button
              onClick={() => setCmdOpen(true)}
              className="lg:hidden flex items-center gap-1.5 px-2 py-1.5 rounded-sm border border-border/40 bg-muted/30 text-xs text-muted-foreground"
            >
              <Search className="w-3 h-3" />
              <kbd className="text-[9px] text-muted-foreground/50">⌘K</kbd>
            </button>

            {/* Current view label */}
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:inline">
              {NAV_ITEMS.find(n => n.id === currentView)?.label ?? currentView}
            </span>
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </main>

      {/* Command Palette */}
      <CommandPalette
        open={cmdOpen}
        onClose={() => setCmdOpen(false)}
        symbol={symbol}
        market={market}
        onViewChange={(v) => {
          const osView = v as OsView;
          if (["overview", "market", "analyze", "trade", "learn", "evaluate", "agent"].includes(osView)) {
            onViewChange(osView);
          }
        }}
      />
    </div>
  );
}
