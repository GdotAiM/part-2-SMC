import { TrendingUp, TrendingDown, Minus, ChevronRight } from "lucide-react";
import type { SmcReport } from "@workspace/api-client-react";

type Props = {
  reports: Array<{ tf: string; report: SmcReport }>;
  onSelect: (tf: string) => void;
};

function getDominant(reports: Array<{ tf: string; report: SmcReport }>) {
  let bull = 0, bear = 0;
  for (const { report: r } of reports) {
    const bias = r.structure.bias !== "neutral" ? r.structure.bias : r.dailyBias.bias;
    if (bias === "bullish") bull++;
    else if (bias === "bearish") bear++;
  }
  if (bull > bear) return { dominant: "bullish", bull, bear };
  if (bear > bull) return { dominant: "bearish", bull, bear };
  return { dominant: "mixed", bull, bear };
}

function getTopDraw(report: SmcReport): { price: number; direction: "long" | "short" } | null {
  return report.draw[0] ? { price: report.draw[0].price, direction: report.draw[0].direction } : null;
}

function getConfidence(report: SmcReport): number {
  const sc = report.structure.confidence;
  const dc = report.dailyBias.strength;
  return Math.round(((sc + dc) / 2) * 100);
}

export function ConfluenceCard({ reports, onSelect }: Props) {
  if (reports.length === 0) return null;
  const { dominant, bull, bear } = getDominant(reports);
  const total = reports.length;

  const color =
    dominant === "bullish" ? "text-[hsl(var(--bullish))]" :
    dominant === "bearish" ? "text-destructive" :
    "text-primary";

  const bg =
    dominant === "bullish" ? "from-[hsl(var(--bullish))]/10 to-transparent border-[hsl(var(--bullish))]/25" :
    dominant === "bearish" ? "from-destructive/10 to-transparent border-destructive/25" :
    "from-primary/10 to-transparent border-primary/25";

  const Icon = dominant === "bullish" ? TrendingUp : dominant === "bearish" ? TrendingDown : Minus;

  return (
    <div className={`rounded-sm border bg-gradient-to-br ${bg} p-4 space-y-3`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Multi-TF Confluence</span>
        <span className="text-[10px] bg-muted px-2 py-0.5 rounded-sm text-muted-foreground">{total} timeframes</span>
      </div>

      <div className="flex items-center gap-3">
        <Icon className={`w-6 h-6 ${color}`} />
        <div>
          <p className={`text-xl font-bold tracking-tight ${color}`}>
            {dominant === "bullish" ? "BULLISH DRAW" : dominant === "bearish" ? "BEARISH DRAW" : "MIXED CONDITIONS"}
          </p>
          <p className="text-xs text-muted-foreground">
            {bull}↑ / {bear}↓ timeframes aligned
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {reports.map(({ tf, report }) => {
          const draw = getTopDraw(report);
          const conf = getConfidence(report);
          const bias = report.structure.bias !== "neutral" ? report.structure.bias : report.dailyBias.bias;
          const tfColor = bias === "bullish" ? "border-[hsl(var(--bullish))]/30 bg-[hsl(var(--bullish))]/5" : bias === "bearish" ? "border-destructive/30 bg-destructive/5" : "border-border bg-muted/30";

          return (
            <button
              key={tf}
              onClick={() => onSelect(tf)}
              className={`rounded-sm border ${tfColor} p-2.5 text-left hover:opacity-90 transition-opacity group`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">{tf}</span>
                <ChevronRight className="w-3 h-3 text-muted-foreground group-hover:text-foreground transition-colors" />
              </div>
              {draw && (
                <p className={`text-sm font-bold font-mono ${bias === "bullish" ? "text-[hsl(var(--bullish))]" : bias === "bearish" ? "text-destructive" : "text-primary"}`}>
                  {draw.direction === "long" ? "▲" : "▼"} {draw.price.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                </p>
              )}
              <p className="text-[10px] text-muted-foreground mt-0.5">Conf {conf}%</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
