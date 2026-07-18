import { useState } from "react";
import { BrainCircuit, ChevronDown, ChevronUp, AlertTriangle, CheckCircle, Minus, TrendingDown, TrendingUp } from "lucide-react";

interface OsOutputPanelProps {
  /** Deterministic narrative string from the strategy engine. */
  narrative?: string;
  /** LLM reasoning assessment. */
  reasoning?: {
    reasoning: string;
    confidenceScore: number;
  };
}

function confidenceLabel(score: number): { label: string; color: string; Icon: typeof AlertTriangle } {
  if (score >= 71) return { label: "Strong", color: "text-[hsl(var(--bullish))] border-[hsl(var(--bullish))]/30 bg-[hsl(var(--bullish))]/10", Icon: TrendingUp };
  if (score >= 51) return { label: "Moderate", color: "text-primary border-primary/30 bg-primary/10", Icon: TrendingUp };
  if (score >= 31) return { label: "Marginal", color: "text-yellow-400 border-yellow-500/30 bg-yellow-500/10", Icon: Minus };
  return { label: "Weak", color: "text-destructive border-destructive/30 bg-destructive/10", Icon: TrendingDown };
}

export function OSOutputPanel({ narrative, reasoning }: OsOutputPanelProps) {
  const [open, setOpen] = useState(true);

  if (!narrative && !reasoning) return null;

  const hasReasoning = reasoning && reasoning.reasoning.length > 0;
  const conf = reasoning?.confidenceScore;
  const { label, color, Icon } = conf !== undefined ? confidenceLabel(conf) : { label: "", color: "", Icon: Minus };

  return (
    <div className="border border-border/50 rounded-sm overflow-hidden">
      {/* Header — always visible */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <BrainCircuit className="w-3.5 h-3.5 text-primary" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">OS Output</span>
          {conf !== undefined && (
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-[9px] font-bold border ${color}`}>
              <Icon className="w-2.5 h-2.5" />
              {label} · {conf}/100
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!hasReasoning && narrative && (
            <span className="text-[9px] text-muted-foreground">Narrative only</span>
          )}
          {open ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
        </div>
      </button>

      {/* Collapsible content */}
      {open && (
        <div className="px-3 py-3 space-y-3 border-t border-border/30">

          {/* Narrative */}
          {narrative && (
            <div className="space-y-1">
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Market Narrative</p>
              <div className="text-[11px] text-foreground/85 leading-relaxed space-y-1">
                {narrative.split("\n\n").filter(Boolean).map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
              </div>
            </div>
          )}

          {/* Reasoning */}
          {hasReasoning && (
            <div className="space-y-1.5">
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Reasoning Assessment</p>
              <div className="rounded-sm border border-primary/15 bg-primary/5 px-3 py-2.5">
                <p className="text-[11px] text-foreground/85 leading-relaxed whitespace-pre-wrap">
                  {reasoning.reasoning}
                </p>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Score:</span>
                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-[10px] font-bold border ${color}`}>
                  <Icon className="w-3 h-3" />
                  {label} · {conf}/100
                </span>
                <span className="text-[9px] text-muted-foreground ml-auto">
                  {conf !== undefined && conf >= 51
                    ? "Setup meets confidence threshold"
                    : "Below confidence threshold — exercise caution"}
                </span>
              </div>
            </div>
          )}

          {/* No reasoning fallback */}
          {narrative && !hasReasoning && (
            <p className="text-[10px] text-muted-foreground italic">
              LLM reasoning not available. Enable ?reason=true or check LLM configuration.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
