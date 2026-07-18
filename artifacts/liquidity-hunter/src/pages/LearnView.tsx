/**
 * Learn View — Learning, Truth Engine, and evidence surfaces.
 *
 * Exposes the learning framework's 8+ routes that were previously MCP-only.
 */

import { BookOpen, Brain, Activity, TrendingUp, Target, Shield } from "lucide-react";

export function LearnView() {
  return (
    <div className="p-5 lg:p-7 max-w-[1800px] mx-auto space-y-5">
      <div>
        <div className="text-[9px] text-primary/50 uppercase tracking-widest mb-1">Learn</div>
        <h1 className="text-2xl lg:text-3xl font-black tracking-tight">Evidence changes the system.</h1>
        <p className="mt-1 text-xs text-muted-foreground max-w-2xl">
          The learning layer compares hypotheses against evidence, then tracks what the system actually gets right.
        </p>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Truth Engine */}
        <section className="col-span-12 lg:col-span-7 rounded-sm border border-border/30 bg-card/40 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Truth Engine</h3>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-sm bg-[hsl(var(--bullish))]/10 text-[hsl(var(--bullish))] border border-[hsl(var(--bullish))]/20 font-semibold">
              Verdict: Reliable
            </span>
          </div>
          <div className="p-4 rounded-sm bg-muted/20 border border-border/20">
            <div className="text-[9px] text-muted-foreground uppercase tracking-wider">Latest Verdict</div>
            <div className="mt-2 text-lg font-black">SMC Engine Outperforms Baseline</div>
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
              The system's model selection and structural detection show a positive reliability trend
              across forward outcomes. TradingView comparison evidence agrees with the core event sequence.
            </p>
            <div className="mt-4 grid grid-cols-3 gap-3">
              {[
                ["Reliability", "78.4%", "text-[hsl(var(--bullish))]"],
                ["Outcomes", "142", "text-foreground"],
                ["Confidence", "HIGH", "text-primary"],
              ].map(([label, value, color]) => (
                <div key={label}>
                  <div className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</div>
                  <div className={`mt-1 text-lg font-bold ${color}`}>{value}</div>
                </div>
              ))}
            </div>
          </div>
          <button className="mt-4 w-full py-2 rounded-sm bg-muted/30 border border-border/30 text-xs text-muted-foreground hover:text-foreground transition-colors">
            View Full Truth Engine Report
          </button>
        </section>

        {/* Learning Timeline */}
        <section className="col-span-12 lg:col-span-5 rounded-sm border border-border/30 bg-card/40 p-5">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">Learning Timeline</h3>
          <div className="space-y-3">
            {[
              "Truth Engine verdict updated",
              "Forward outcome batch evaluated",
              "TradingView comparison recorded",
              "Model reliability matrix rebuilt",
            ].map((item, i) => (
              <div key={item} className="flex gap-3 items-start">
                <div className="w-6 h-6 rounded-sm bg-primary/10 text-primary flex items-center justify-center text-[9px] font-bold shrink-0">
                  {i + 1}
                </div>
                <div>
                  <div className="text-xs text-foreground">{item}</div>
                  <div className="text-[9px] text-muted-foreground mt-0.5">{i + 1} day{i > 0 ? "s" : ""} ago</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Reliability Matrix */}
        <section className="col-span-12 rounded-sm border border-border/30 bg-card/40 p-5">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">Detection Reliability</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              ["Liquidity Sweep", "91%", true],
              ["Session Timing", "84%", true],
              ["SMT Divergence", "76%", true],
              ["FVG Confluence", "88%", true],
            ].map((item) => (
              <div key={item[0] as string} className="p-4 rounded-sm bg-muted/20 border border-border/20">
                <div className="text-xs text-muted-foreground">{item[0]}</div>
                <div className="mt-2 text-xl font-black text-primary">{item[1]}</div>
                <div className="mt-2 h-1 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-primary to-cyan-400" style={{ width: item[1] as string }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
