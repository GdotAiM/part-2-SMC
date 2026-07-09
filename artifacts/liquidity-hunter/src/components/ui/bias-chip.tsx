import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface BiasChipProps {
  bias: string;
}

/**
 * Colored badge chip for bullish / bearish / neutral bias.
 * Uses the design-system bullish / destructive / primary tokens.
 */
export function BiasChip({ bias }: BiasChipProps) {
  const isBull = bias === "bullish";
  const isBear = bias === "bearish";

  const color = isBull
    ? "text-[hsl(var(--bullish))]"
    : isBear
      ? "text-destructive"
      : "text-primary";

  const bg = isBull
    ? "bg-[hsl(var(--bullish))]/15 border-[hsl(var(--bullish))]/30"
    : isBear
      ? "bg-destructive/15 border-destructive/30"
      : "bg-primary/15 border-primary/30";

  const Icon = isBull ? TrendingUp : isBear ? TrendingDown : Minus;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-sm border text-[10px] font-bold uppercase tracking-wider ${color} ${bg}`}
    >
      <Icon className="w-2.5 h-2.5" />
      {bias}
    </span>
  );
}
