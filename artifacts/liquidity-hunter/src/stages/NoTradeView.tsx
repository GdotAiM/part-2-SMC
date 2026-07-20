/**
 * NoTradeView — calm explanation of why no trade is available.
 *
 * Turns "no data" into capability discovery: shows what's missing
 * and what the user can do about it.
 */

import { useMarketStore } from "@/state/market-store";
import { useNarrativeStage } from "@/hooks/useNarrativeStage";
import { STAGE_LABELS } from "@/state/narrative";
import { getCapabilitiesForStage } from "@/state/capabilities";
import { SessionFlowIndicator } from "@/panels/SessionFlowIndicator";

export function NoTradeView() {
  const reasoning = useMarketStore((s) => s.stageInfo.reasoning);
  const session = useMarketStore((s) => s.stageInfo.session);
  const toggleDecisionFunnel = useMarketStore((s) => s.toggleDecisionFunnel);
  const toggleCapabilityExplorer = useMarketStore((s) => s.toggleCapabilityExplorer);
  const { stage } = useNarrativeStage();

  const availableCaps = getCapabilitiesForStage(stage);

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-lg text-center space-y-6">
        {/* Calm icon */}
        <div className="text-4xl opacity-50">🧘</div>

        {/* Stage badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-sm bg-amber-400/10 border border-amber-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider">
            {STAGE_LABELS[stage]}
          </span>
        </div>

        {/* Session + flow */}
        <div className="flex items-center justify-center">
          <SessionFlowIndicator />
        </div>

        {/* Reasoning */}
        <p className="text-sm text-muted-foreground leading-relaxed">
          {reasoning}
        </p>

        {/* What's missing — capability discovery */}
        <div className="rounded-sm border border-border/30 bg-card/40 p-5">
          <h4 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
            What you can do while waiting
          </h4>
          <div className="flex flex-wrap justify-center gap-2">
            {availableCaps.slice(0, 6).map((cap) => (
              <button
                key={cap.id}
                onClick={toggleCapabilityExplorer}
                className="flex items-center gap-1.5 px-3 py-2 rounded-sm bg-muted/20 border border-border/30 text-[10px] text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
              >
                <span>{cap.icon}</span>
                <span>{cap.name}</span>
              </button>
            ))}
          </div>
          <button
            onClick={toggleCapabilityExplorer}
            className="mt-3 text-[9px] text-primary hover:text-primary/80 transition-colors"
          >
            See all {availableCaps.length} available capabilities →
          </button>
        </div>

        {/* Quick action */}
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={toggleDecisionFunnel}
            className="px-4 py-2 rounded-sm bg-primary/10 border border-primary/20 text-xs text-primary font-semibold hover:bg-primary/15 transition-colors"
          >
            Open Decision Funnel
          </button>
          <button
            onClick={toggleCapabilityExplorer}
            className="px-4 py-2 rounded-sm bg-muted/30 border border-border/30 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Browse Capabilities
          </button>
        </div>
      </div>
    </div>
  );
}
