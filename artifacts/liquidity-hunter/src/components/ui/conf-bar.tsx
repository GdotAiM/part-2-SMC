interface ConfBarProps {
  /** Confidence fraction 0–1 (matches API data types like structure.confidence). */
  fraction: number;
  /** Optional label shown to the left of the bar. */
  label?: string;
  /** Override the percentage display. Defaults to `Math.round(fraction * 100)`. */
  displayPct?: number;
}

/**
 * Horizontal confidence / strength bar.
 * - > 65% → green (bullish)
 * - > 40% → primary (neutral-positive)
 * - ≤ 40% → destructive (bearish/weak)
 */
export function ConfBar({ fraction, label, displayPct }: ConfBarProps) {
  const pct = displayPct ?? Math.round(fraction * 100);
  const color =
    pct > 65 ? "bg-[hsl(var(--bullish))]" :
    pct > 40 ? "bg-primary" :
    "bg-destructive";

  return (
    <div className="flex items-center gap-2">
      {label && <span className="text-[10px] text-muted-foreground w-16 shrink-0">{label}</span>}
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-muted-foreground w-7 text-right tabular-nums">{pct}%</span>
    </div>
  );
}
