/**
 * SessionFlowIndicator — visual representation of the market phase sequence.
 * Shows Accumulation → Manipulation → Distribution → Continuation
 * and highlights where price currently is.
 */

import { useMarketStore } from "@/state/market-store";
import type { MarketPhase } from "@/state/narrative";

const PHASES: Array<{ key: MarketPhase; label: string; color: string }> = [
  { key: "ACCUMULATION", label: "ACC", color: "bg-blue-500" },
  { key: "MANIPULATION", label: "MAN", color: "bg-amber-500" },
  { key: "DISTRIBUTION", label: "DIST", color: "bg-destructive" },
  { key: "CONTINUATION", label: "CONT", color: "bg-emerald-500" },
];

function PhaseDot({ phase, current }: { phase: MarketPhase; current: MarketPhase | null }) {
  const def = PHASES.find((p) => p.key === phase);
  if (!def) return null;
  const isActive = phase === current;
  const isPast = current
    ? PHASES.findIndex((p) => p.key === phase) < PHASES.findIndex((p) => p.key === current)
    : false;

  return (
    <div className="flex items-center gap-1.5">
      <div
        className={`w-2.5 h-2.5 rounded-full transition-all duration-500 ${
          isActive
            ? `${def.color} shadow-[0_0_8px] shadow-current scale-125`
            : isPast
              ? `${def.color}/50`
              : "bg-muted-foreground/20"
        }`}
      />
      <span
        className={`text-[9px] font-semibold uppercase tracking-wider transition-colors ${
          isActive ? "text-foreground" : isPast ? "text-muted-foreground/50" : "text-muted-foreground/20"
        }`}
      >
        {def.label}
      </span>
    </div>
  );
}

export function SessionFlowIndicator() {
  const phase = useMarketStore((s) => s.stageInfo.phase);

  return (
    <div className="flex items-center gap-2">
      {PHASES.map((p, i) => (
        <div key={p.key} className="flex items-center gap-1.5">
          <PhaseDot phase={p.key} current={phase} />
          {i < PHASES.length - 1 && (
            <div className={`w-6 h-px ${phase ? "bg-border/40" : "bg-border/10"}`} />
          )}
        </div>
      ))}
    </div>
  );
}
