import { useState } from "react";
import { ArrowRight, ChevronDown, ChevronRight, ChevronUp, Minus, Play, TrendingDown, TrendingUp, Zap } from "lucide-react";
import type { SmcReport } from "@workspace/api-client-react";
import { getBias, getConfidence, fmtPrice, TF_LABEL_MAP, TF_WEIGHT } from "@/lib/smc-display";

const ROLE_LABELS: Record<string, string> = {
  "BIAS SETTER":    "Bias",
  "CONFIRMATION":   "Confirms",
  "ENTRY TRIGGER":  "Entry",
};

/* ─── Strategy Detection Section ─── */

function StrategySection({
  primary,
  alternatives,
  onExecute,
}: {
  primary: StrategyInfo;
  alternatives: StrategyInfo[];
  onExecute?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const isHighConviction = primary.score >= 0.6;

  return (
    <div className="px-4 pb-2 border-t border-border/20 pt-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <Zap className={`w-3.5 h-3.5 shrink-0 ${isHighConviction ? "text-[hsl(var(--bullish))]" : "text-primary"}`} />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground shrink-0">
            Strategy
          </span>
          <span className={`text-[10px] font-bold truncate ${isHighConviction ? "text-[hsl(var(--bullish))]" : "text-primary"}`}>
            {primary.name}
          </span>
          <span className={`text-[9px] px-1.5 py-0.5 rounded-sm font-bold border ${
            isHighConviction
              ? "bg-[hsl(var(--bullish))]/15 border-[hsl(var(--bullish))]/30 text-[hsl(var(--bullish))]"
              : "bg-primary/10 border-primary/30 text-primary"
          }`}>
            {Math.round(primary.score * 100)}%
          </span>
          {onExecute && (
            <button
              onClick={(e) => { e.stopPropagation(); onExecute(); }}
              className="flex items-center gap-1 px-2 py-0.5 rounded-sm text-[9px] font-bold border
                bg-emerald-500/15 border-emerald-500/30 text-emerald-400
                hover:bg-emerald-500/25 hover:border-emerald-500/50 transition-all shrink-0"
              title="Open Intelligence Sheet on entry TF with strategy context"
            >
              <Play className="w-2.5 h-2.5" />
              Execute Now
            </button>
          )}
        </div>

        {alternatives.length > 0 && (
          <button
            onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
            className="flex items-center gap-1 text-[9px] text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            <span>{open ? "Hide" : `${alternatives.length} alt`}</span>
            {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        )}
      </div>

      {/* Collapsible alternatives */}
      {open && alternatives.length > 0 && (
        <div className="mt-1.5 space-y-1">
          <p className="text-[8px] text-muted-foreground uppercase tracking-wider">Alternatives</p>
          {alternatives.map((alt) => (
            <div key={alt.id} className="flex items-center justify-between text-[10px]">
              <span className="text-muted-foreground truncate mr-2">{alt.name}</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded-sm font-bold bg-muted border border-border text-muted-foreground shrink-0">
                {Math.round(alt.score * 100)}%
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type CascadeInfo = {
  roles: Record<string, string>;
  anchorTf: string;
  anchorBias: string;
};

export interface StrategyInfo {
  id: string;
  name: string;
  score: number;
}

type Props = {
  reports: Array<{ tf: string; report: SmcReport }>;
  cascade: CascadeInfo;
  onSelect: (tf: string) => void;
  onOpenConfluence: () => void;
  /** Optional: matched strategy info from the strategy detection engine. */
  primaryStrategy?: StrategyInfo | null;
  /** Optional: alternative runners-up (shown in a collapsible list). */
  alternativeStrategies?: StrategyInfo[];
  /** Called when user clicks "Execute Now" on the primary strategy. */
  onExecute?: (strategy: StrategyInfo) => void;
};

export function ConfluenceCard({
  reports, cascade, onSelect, onOpenConfluence,
  primaryStrategy, alternativeStrategies, onExecute,
}: Props) {
  if (reports.length === 0) return null;

  /* Sort high → low for cascade display */
  const sortedReports = [...reports].sort(
    (a, b) => (TF_WEIGHT[b.tf] ?? 0) - (TF_WEIGHT[a.tf] ?? 0),
  );

  const { anchorTf, anchorBias } = cascade;
  const market = (sortedReports[0]?.report.market ?? "crypto") as "crypto" | "forex";

  /* Overall confluence: count aligned vs counter */
  let aligned = 0, counter = 0;
  for (const { report } of reports) {
    const b = getBias(report);
    if (b === anchorBias) aligned++;
    else if (b !== "neutral") counter++;
  }

  /* Is the cascade fully aligned top-down? */
  const fullyAligned = counter === 0 && reports.length > 1;

  /* Check where the first break occurs */
  let breakAtTf: string | null = null;
  for (let i = 1; i < sortedReports.length; i++) {
    if (getBias(sortedReports[i].report) !== anchorBias) {
      breakAtTf = sortedReports[i].tf;
      break;
    }
  }

  const anchorBiasObj = { bullish: "bullish", bearish: "bearish" }[anchorBias] as "bullish" | "bearish" | undefined;

  const color =
    anchorBias === "bullish" ? "text-[hsl(var(--bullish))]" :
    anchorBias === "bearish" ? "text-destructive" : "text-primary";
  const border =
    anchorBias === "bullish" ? "border-[hsl(var(--bullish))]/25" :
    anchorBias === "bearish" ? "border-destructive/25" : "border-primary/25";
  const grad =
    anchorBias === "bullish" ? "from-[hsl(var(--bullish))]/8 to-transparent" :
    anchorBias === "bearish" ? "from-destructive/8 to-transparent" : "from-primary/8 to-transparent";

  const Icon = anchorBias === "bullish" ? TrendingUp : anchorBias === "bearish" ? TrendingDown : Minus;

  return (
    <div className={`rounded-sm border ${border} bg-gradient-to-br ${grad} overflow-hidden`}>

      {/* ── Headline ── */}
      <button
        onClick={onOpenConfluence}
        className="w-full text-left px-4 pt-4 pb-3 hover:bg-white/3 active:bg-white/5 transition-colors group"
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Multi-TF Confluence
          </span>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] px-2 py-0.5 rounded-sm font-bold border ${
              fullyAligned
                ? "bg-[hsl(var(--bullish))]/15 border-[hsl(var(--bullish))]/30 text-[hsl(var(--bullish))]"
                : breakAtTf
                  ? "bg-yellow-500/15 border-yellow-500/30 text-yellow-400"
                  : "bg-muted border-border text-muted-foreground"
            }`}>
              {fullyAligned ? "FULL CASCADE ✓" : breakAtTf ? `BREAK AT ${TF_LABEL_MAP[breakAtTf]}` : "LOADING…"}
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
              {anchorBias === "bullish" ? "BULLISH DRAW" :
               anchorBias === "bearish" ? "BEARISH DRAW" : "MIXED CONDITIONS"}
            </p>
            <p className="text-xs text-muted-foreground">
              {aligned} aligned · {counter} counter-trend · anchor {TF_LABEL_MAP[anchorTf]}
            </p>
          </div>
        </div>
      </button>

      {/* ── Strategy Detection ── */}
      {primaryStrategy && (
        <StrategySection
          primary={primaryStrategy}
          alternatives={alternativeStrategies ?? []}
          onExecute={onExecute ? () => onExecute(primaryStrategy) : undefined}
        />
      )}

      {/* ── Cascade Flow ── */}
      {sortedReports.length > 1 && (
        <div className="px-4 pb-3">
          <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-2">
            Top-Down Cascade  ·  {TF_LABEL_MAP[anchorTf]} sets the direction
          </p>
          <div className="flex items-center gap-1 flex-wrap">
            {sortedReports.map(({ tf, report }, i) => {
              const bias       = getBias(report);
              const isAnchor   = tf === anchorTf;
              const isAligned  = bias === anchorBias;
              const role       = cascade.roles[tf] ?? "";
              const nextReport = sortedReports[i + 1];
              const nextBias   = nextReport ? getBias(nextReport.report) : null;
              const arrowAligned = nextBias === anchorBias;

              const boxBg =
                isAnchor        ? "bg-primary/15 border-primary/40 text-primary" :
                isAligned       ? "bg-[hsl(var(--bullish))]/10 border-[hsl(var(--bullish))]/30 text-[hsl(var(--bullish))]" :
                                  "bg-yellow-500/10 border-yellow-500/30 text-yellow-400";

              return (
                <div key={tf} className="flex items-center gap-1">
                  <button
                    onClick={() => onSelect(tf)}
                    className={`rounded-sm border px-2.5 py-1.5 text-left hover:opacity-90 transition-opacity ${boxBg}`}
                  >
                    <div className="flex items-center gap-1">
                      {isAnchor && <span className="text-[8px] font-bold opacity-70">⚓</span>}
                      <span className="text-[10px] font-bold">
                        {TF_LABEL_MAP[tf] ?? tf.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      {bias === "bullish" ? <TrendingUp className="w-2.5 h-2.5" /> :
                       bias === "bearish" ? <TrendingDown className="w-2.5 h-2.5" /> :
                       <Minus className="w-2.5 h-2.5" />}
                      <span className="text-[9px] font-semibold uppercase">{bias}</span>
                    </div>
                    <span className="text-[8px] opacity-60 block mt-0.5">
                      {ROLE_LABELS[role] ?? role}
                    </span>
                  </button>

                  {nextReport && (
                    <ArrowRight className={`w-3.5 h-3.5 shrink-0 ${
                      arrowAligned ? "text-[hsl(var(--bullish))]" : "text-yellow-400"
                    }`} />
                  )}
                </div>
              );
            })}

            {/* Cascade status tail */}
            {fullyAligned && (
              <span className="text-[10px] text-[hsl(var(--bullish))] font-bold ml-1">✓ Full alignment</span>
            )}
            {!fullyAligned && breakAtTf && (
              <span className="text-[10px] text-yellow-400 font-bold ml-1">
                ⚠ Breaks at {TF_LABEL_MAP[breakAtTf]}
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Per-TF mini cards ── */}
      <div className={`grid gap-px border-t border-border/30 ${
        reports.length <= 2 ? "grid-cols-2" :
        reports.length === 3 ? "grid-cols-3" :
        reports.length <= 4 ? "grid-cols-2 sm:grid-cols-4" :
        "grid-cols-2 sm:grid-cols-3 lg:grid-cols-7"
      }`}>
        {sortedReports.map(({ tf, report }) => {
          const draw    = report.draw[0];
          const conf    = getConfidence(report);
          const bias    = getBias(report);
          const isAligned = bias === anchorBias;

          const cardBg =
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
              className={`border ${cardBg} p-3 text-left hover:brightness-125 active:scale-[0.98]
                          transition-all group/card flex flex-col gap-1.5`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    {TF_LABEL_MAP[tf] ?? tf.toUpperCase()}
                  </span>
                  {tf === anchorTf && (
                    <span className="text-[8px] text-primary">⚓</span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {!isAligned && tf !== anchorTf && (
                    <span className="text-[8px] text-yellow-400 font-bold">⚠</span>
                  )}
                  <ChevronRight className="w-3 h-3 text-muted-foreground/50 group-hover/card:text-primary transition-colors" />
                </div>
              </div>

              {draw ? (
                <p className={`text-sm font-bold font-mono leading-none ${priceColor}`}>
                  {draw.direction === "long" ? "▲" : "▼"} {fmtPrice(draw.price, market)}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground italic">—</p>
              )}

              <div className="space-y-0.5">
                <div className="w-full h-1 bg-muted/50 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${confBar}`} style={{ width: `${conf}%` }} />
                </div>
                <p className="text-[9px] text-muted-foreground">Conf {conf}%</p>
              </div>

              {!isAligned && tf !== anchorTf ? (
                <p className="text-[9px] text-yellow-400 font-semibold">⚠ Counter-trend</p>
              ) : (
                <p className="text-[9px] text-primary/40 group-hover/card:text-primary/70 transition-colors">
                  Tap → Intelligence Sheet
                </p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
