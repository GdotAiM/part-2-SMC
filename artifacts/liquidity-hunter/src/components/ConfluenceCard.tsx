import { ChevronRight, Minus, TrendingDown, TrendingUp } from "lucide-react";
import type { SmcReport } from "@workspace/api-client-react";

type Props = {
  reports: Array<{ tf: string; report: SmcReport }>;
  onSelect: (tf: string) => void;
};

const TF_LABELS: Record<string, string> = {
  "1m": "M1", "5m": "M5", "15m": "M15",
  "1h": "H1", "4h": "H4", "1d": "D1", "1w": "W1",
};

function getDominant(reports: Array<{ tf: string; report: SmcReport }>) {
  let bull = 0, bear = 0;
  for (const { report: r } of reports) {
    const bias = r.structure.bias !== "neutral" ? r.structure.bias : r.dailyBias.bias;
    if (bias === "bullish") bull++;
    else if (bias === "bearish") bear++;
  }
  if (bull > bear) return { dominant: "bullish" as const, bull, bear };
  if (bear > bull) return { dominant: "bearish" as const, bull, bear };
  return { dominant: "mixed" as const, bull, bear };
}

function getConfidence(report: SmcReport): number {
  return Math.round(((report.structure.confidence + report.dailyBias.strength) / 2) * 100);
}

function getBias(report: SmcReport): string {
  return report.structure.bias !== "neutral" ? report.structure.bias : report.dailyBias.bias;
}

function fmtP(price: number): string {
  if (price >= 10000) return price.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (price >= 1) return price.toFixed(4);
  return price.toFixed(6);
}

export function ConfluenceCard({ reports, onSelect }: Props) {
  if (reports.length === 0) return null;

  const { dominant, bull, bear } = getDominant(reports);
  const total = reports.length;

  /* Pick the best TF to open when user clicks the headline */
  const bestTf = [...reports].sort((a, b) => getConfidence(b.report) - getConfidence(a.report))[0];

  const color =
    dominant === "bullish" ? "text-[hsl(var(--bullish))]" :
    dominant === "bearish" ? "text-destructive" : "text-primary";

  const border =
    dominant === "bullish" ? "border-[hsl(var(--bullish))]/25" :
    dominant === "bearish" ? "border-destructive/25" : "border-primary/25";

  const grad =
    dominant === "bullish" ? "from-[hsl(var(--bullish))]/8 to-transparent" :
    dominant === "bearish" ? "from-destructive/8 to-transparent" : "from-primary/8 to-transparent";

  const Icon = dominant === "bullish" ? TrendingUp : dominant === "bearish" ? TrendingDown : Minus;

  return (
    <div className={`rounded-sm border ${border} bg-gradient-to-br ${grad} overflow-hidden`}>

      {/* ── Dominant headline — clicking opens best-conf TF ── */}
      <button
        onClick={() => onSelect(bestTf.tf)}
        className="w-full text-left px-4 pt-4 pb-3 hover:bg-white/3 active:bg-white/5 transition-colors group"
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Multi-TF Confluence
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[10px] bg-muted px-2 py-0.5 rounded-sm text-muted-foreground">
              {total} timeframe{total > 1 ? "s" : ""}
            </span>
            <span className="text-[10px] text-primary/50 group-hover:text-primary transition-colors">
              Intelligence Sheet →
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Icon className={`w-6 h-6 ${color} shrink-0`} />
          <div>
            <p className={`text-xl font-bold tracking-tight ${color}`}>
              {dominant === "bullish" ? "BULLISH DRAW" :
               dominant === "bearish" ? "BEARISH DRAW" : "MIXED CONDITIONS"}
            </p>
            <p className="text-xs text-muted-foreground">
              {bull}↑ / {bear}↓ timeframes aligned
            </p>
          </div>
        </div>
      </button>

      {/* ── Per-TF mini cards ── */}
      <div className={`grid gap-px border-t border-border/30 ${
        total <= 2 ? "grid-cols-2" :
        total === 3 ? "grid-cols-3" :
        total <= 4 ? "grid-cols-2 sm:grid-cols-4" :
        "grid-cols-2 sm:grid-cols-3 lg:grid-cols-7"
      }`}>
        {reports.map(({ tf, report }) => {
          const draw = report.draw[0];
          const conf = getConfidence(report);
          const bias = getBias(report);

          const cardBorder =
            bias === "bullish" ? "border-[hsl(var(--bullish))]/15 bg-[hsl(var(--bullish))]/4" :
            bias === "bearish" ? "border-destructive/15 bg-destructive/4" :
            "border-transparent bg-muted/10";

          const priceColor =
            bias === "bullish" ? "text-[hsl(var(--bullish))]" :
            bias === "bearish" ? "text-destructive" : "text-primary";

          const confBar =
            conf > 65 ? "bg-[hsl(var(--bullish))]" :
            conf > 40 ? "bg-primary" : "bg-destructive";

          return (
            <button
              key={tf}
              onClick={() => onSelect(tf)}
              className={`border ${cardBorder} p-3 text-left hover:brightness-125 active:scale-[0.98]
                          transition-all group/card flex flex-col gap-1.5`}
            >
              {/* TF label + arrow */}
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  {TF_LABELS[tf] ?? tf.toUpperCase()}
                </span>
                <ChevronRight className="w-3 h-3 text-muted-foreground/50 group-hover/card:text-primary transition-colors" />
              </div>

              {/* Price target */}
              {draw ? (
                <p className={`text-sm font-bold font-mono leading-none ${priceColor}`}>
                  {draw.direction === "long" ? "▲" : "▼"} {fmtP(draw.price)}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground italic">—</p>
              )}

              {/* Confidence bar */}
              <div className="space-y-0.5">
                <div className="w-full h-1 bg-muted/50 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${confBar}`} style={{ width: `${conf}%` }} />
                </div>
                <p className="text-[9px] text-muted-foreground">Conf {conf}%</p>
              </div>

              {/* Hint */}
              <p className="text-[9px] text-primary/40 group-hover/card:text-primary/70 transition-colors">
                Tap → Intelligence Sheet
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
