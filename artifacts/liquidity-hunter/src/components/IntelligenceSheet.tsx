import { X, TrendingUp, TrendingDown, Minus, Layers, BarChart2, Activity, Zap, ChevronUp, ChevronDown } from "lucide-react";
import type { SmcReport } from "@workspace/api-client-react";
import { AgentPipeline } from "./AgentPipeline";
import { AgentChat } from "./AgentChat";

type Props = {
  report: SmcReport;
  market: "crypto" | "forex";
  onClose: () => void;
};

function fmtPrice(p: number, market: "crypto" | "forex"): string {
  if (market === "forex") return p.toFixed(5);
  if (p >= 10000) return p.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (p >= 1) return p.toFixed(4);
  return p.toFixed(6);
}

function BiasChip({ bias }: { bias: string }) {
  const [color, bg] =
    bias === "bullish" ? ["text-[hsl(var(--bullish))]", "bg-[hsl(var(--bullish))]/15 border-[hsl(var(--bullish))]/30"] :
    bias === "bearish" ? ["text-destructive", "bg-destructive/15 border-destructive/30"] :
    ["text-primary", "bg-primary/15 border-primary/30"];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-sm border text-[10px] font-bold uppercase tracking-wider ${color} ${bg}`}>
      {bias === "bullish" ? <TrendingUp className="w-2.5 h-2.5" /> : bias === "bearish" ? <TrendingDown className="w-2.5 h-2.5" /> : <Minus className="w-2.5 h-2.5" />}
      {bias}
    </span>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 pb-1 border-b border-border/60">
        <Icon className="w-3.5 h-3.5 text-primary" />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</span>
      </div>
      {children}
    </div>
  );
}

function ConfBar({ value, label }: { value: number; label?: string }) {
  const pct = Math.round(value * 100);
  const color = pct > 65 ? "bg-[hsl(var(--bullish))]" : pct > 40 ? "bg-primary" : "bg-destructive";
  return (
    <div className="flex items-center gap-2">
      {label && <span className="text-[10px] text-muted-foreground w-16 shrink-0">{label}</span>}
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-muted-foreground w-7 text-right">{pct}%</span>
    </div>
  );
}

export function IntelligenceSheet({ report, market, onClose }: Props) {
  const bias = report.structure.bias !== "neutral" ? report.structure.bias : report.dailyBias.bias;
  const lastBreak = report.structure.breaks.slice(-1)[0];
  const liveOBs = report.orderBlocks.filter(ob => ob.valid && !ob.isMitigated);
  const unfilledFVGs = report.fvg.filter(g => g.fillFraction < 0.5);
  const bslPools = report.liquidity.pools.filter(p => (p.type === "BSL" || p.type === "EQH") && !p.wasSwept);
  const sslPools = report.liquidity.pools.filter(p => (p.type === "SSL" || p.type === "EQL") && !p.wasSwept);

  const confidenceDrivers: string[] = [];
  if (report.structure.confidence > 0.7) confidenceDrivers.push("Strong structure alignment");
  if (report.liquidity.nearestBSL || report.liquidity.nearestSSL) confidenceDrivers.push("Nearby liquidity pool identified");
  if (liveOBs.some(ob => ob.hasFvg)) confidenceDrivers.push("OB + FVG confluence detected");
  if (report.structure.breaks.length > 0) confidenceDrivers.push("Recent BOS/MSS displacement");
  if (report.dailyBias.consecutiveDays >= 3) confidenceDrivers.push(`${report.dailyBias.consecutiveDays}-day consecutive bias`);
  if (report.smt.detected) confidenceDrivers.push(`SMT divergence: ${report.smt.type?.replace("_", " ")}`);
  if (report.pdArray.currentBias !== "equilibrium") confidenceDrivers.push(`Price in ${report.pdArray.currentBias} zone`);
  if (confidenceDrivers.length === 0) confidenceDrivers.push("Insufficient confluence — wait for clearer setup");

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end" onClick={onClose}>
      <div
        className="relative h-full w-full max-w-2xl bg-background border-l border-border flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/80 shrink-0">
          <div className="flex items-center gap-3">
            <div>
              <p className="text-sm font-bold">{report.symbol} · {report.timeframe}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <BiasChip bias={bias} />
                <span className="text-xs text-muted-foreground font-mono">{fmtPrice(report.currentPrice, market)}</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-sm transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-5">

            {/* 1. Structure */}
            <Section title="Structure" icon={Activity}>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-muted/40 rounded-sm p-2.5">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Current Bias</p>
                  <BiasChip bias={bias} />
                </div>
                <div className="bg-muted/40 rounded-sm p-2.5">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Trend</p>
                  <span className="text-xs font-bold uppercase">{report.structure.trend}</span>
                </div>
              </div>
              {lastBreak && (
                <div className="bg-muted/40 rounded-sm p-2.5">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Last {lastBreak.type}</p>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded-sm ${lastBreak.type === "BOS" ? "bg-primary/20 text-primary" : "bg-yellow-500/20 text-yellow-400"}`}>{lastBreak.type}</span>
                    <span className="text-xs font-mono text-muted-foreground">@ {fmtPrice(lastBreak.price, market)}</span>
                    <BiasChip bias={lastBreak.direction} />
                  </div>
                </div>
              )}
              <ConfBar value={report.structure.confidence} label="Confidence" />
            </Section>

            {/* 2. Liquidity Map */}
            <Section title="Liquidity Map" icon={Layers}>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[10px] text-[hsl(var(--bullish))] font-semibold uppercase tracking-wider mb-1.5">BSL Above</p>
                  <div className="space-y-1">
                    {bslPools.slice(0, 4).map((p, i) => (
                      <div key={i} className="flex items-center justify-between text-[11px]">
                        <span className="font-mono">{fmtPrice(p.price, market)}</span>
                        <div className="flex items-center gap-1">
                          <span className="text-muted-foreground">{p.touches}x</span>
                          {p.session && <span className="text-[10px] text-muted-foreground">{p.session}</span>}
                        </div>
                      </div>
                    ))}
                    {bslPools.length === 0 && <p className="text-[10px] text-muted-foreground italic">None identified</p>}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] text-destructive font-semibold uppercase tracking-wider mb-1.5">SSL Below</p>
                  <div className="space-y-1">
                    {sslPools.slice(0, 4).map((p, i) => (
                      <div key={i} className="flex items-center justify-between text-[11px]">
                        <span className="font-mono">{fmtPrice(p.price, market)}</span>
                        <div className="flex items-center gap-1">
                          <span className="text-muted-foreground">{p.touches}x</span>
                          {p.session && <span className="text-[10px] text-muted-foreground">{p.session}</span>}
                        </div>
                      </div>
                    ))}
                    {sslPools.length === 0 && <p className="text-[10px] text-muted-foreground italic">None identified</p>}
                  </div>
                </div>
              </div>

              {/* Equal Highs/Lows */}
              {report.liquidity.pools.filter(p => p.type === "EQH" || p.type === "EQL").slice(0, 4).map((p, i) => (
                <div key={i} className="flex items-center justify-between text-[11px] bg-yellow-500/10 border border-yellow-500/20 rounded-sm px-2.5 py-1.5">
                  <span className="text-yellow-400 font-semibold">{p.type === "EQH" ? "Equal Highs" : "Equal Lows"}</span>
                  <span className="font-mono text-muted-foreground">{fmtPrice(p.price, market)}</span>
                  <span className="text-[10px] text-muted-foreground">Engineered target</span>
                </div>
              ))}
            </Section>

            {/* 3. Imbalance Zones */}
            <Section title="Imbalance Zones" icon={BarChart2}>
              {unfilledFVGs.length === 0 && <p className="text-xs text-muted-foreground italic">No significant unfilled FVGs</p>}
              <div className="space-y-1.5">
                {unfilledFVGs.slice(-6).reverse().map((g, i) => (
                  <div key={i} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-sm border text-[11px] ${g.type === "bullish" ? "border-[hsl(var(--bullish))]/20 bg-[hsl(var(--bullish))]/5" : "border-destructive/20 bg-destructive/5"}`}>
                    <span className={`font-bold text-[10px] ${g.type === "bullish" ? "text-[hsl(var(--bullish))]" : "text-destructive"}`}>{g.type.toUpperCase()} FVG</span>
                    <span className="font-mono text-muted-foreground flex-1">{fmtPrice(g.bottom, market)} – {fmtPrice(g.top, market)}</span>
                    <div className="w-12 h-1 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${Math.round(g.fillFraction * 100)}%` }} />
                    </div>
                    {g.isInversion && <span className="text-[10px] bg-yellow-500/20 text-yellow-400 px-1 rounded-sm">INV</span>}
                  </div>
                ))}
              </div>
            </Section>

            {/* 4. Order Flow */}
            <Section title="Order Flow" icon={Activity}>
              <div className="space-y-1.5">
                {report.structure.breaks.slice(-5).reverse().map((b, i) => (
                  <div key={i} className="flex items-center gap-2 text-[11px]">
                    <span className={`px-1.5 py-0.5 rounded-sm text-[10px] font-bold ${b.type === "BOS" ? "bg-primary/20 text-primary" : "bg-yellow-500/20 text-yellow-400"}`}>{b.type}</span>
                    <span className={`font-bold ${b.direction === "bullish" ? "text-[hsl(var(--bullish))]" : "text-destructive"}`}>{b.direction}</span>
                    <span className="font-mono text-muted-foreground">@ {fmtPrice(b.price, market)}</span>
                  </div>
                ))}
                {report.structure.breaks.length === 0 && <p className="text-xs text-muted-foreground italic">No recent structure breaks</p>}
              </div>

              {/* Live OBs */}
              {liveOBs.length > 0 && (
                <div className="mt-2 space-y-1">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Live Order Blocks</p>
                  {liveOBs.slice(0, 5).map((ob, i) => (
                    <div key={i} className="flex items-center gap-2 text-[11px]">
                      <span className={`text-[10px] font-bold ${ob.type === "bullish" ? "text-[hsl(var(--bullish))]" : "text-destructive"}`}>{ob.type === "bullish" ? "BULL" : "BEAR"}</span>
                      <span className="font-mono text-muted-foreground">{fmtPrice(ob.proximal, market)} → {fmtPrice(ob.distal, market)}</span>
                      {ob.hasFvg && <span className="text-[10px] bg-primary/20 text-primary px-1 rounded-sm">FVG</span>}
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* 5. Confidence Drivers */}
            <Section title="Confidence Drivers" icon={Zap}>
              <div className="space-y-1.5">
                {confidenceDrivers.map((driver, i) => (
                  <div key={i} className="flex items-center gap-2 text-[11px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                    <span className="text-foreground/80">{driver}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 space-y-1.5">
                <ConfBar value={report.structure.confidence} label="Structure" />
                <ConfBar value={report.dailyBias.strength} label="Daily Bias" />
                {report.smt.detected && <ConfBar value={report.smt.confidence} label="SMT" />}
              </div>

              {/* Draw targets */}
              <div className="mt-3 space-y-1">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Draw on Liquidity</p>
                {report.draw.slice(0, 3).map((d, i) => (
                  <div key={i} className="flex items-center gap-2 text-[11px]">
                    {d.direction === "long" ? <ChevronUp className="w-3 h-3 text-[hsl(var(--bullish))] shrink-0" /> : <ChevronDown className="w-3 h-3 text-destructive shrink-0" />}
                    <span className="flex-1 truncate text-muted-foreground">{d.label}</span>
                    <span className="text-[10px] bg-muted px-1.5 rounded-sm">{d.score.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </Section>

            {/* 6. Agent Pipeline */}
            <Section title="Agent Pipeline" icon={Zap}>
              <AgentPipeline report={report} />
            </Section>
          </div>
        </div>

        {/* Chat — fixed at bottom */}
        <div className="border-t border-border shrink-0 h-72 flex flex-col">
          <AgentChat report={report} />
        </div>
      </div>
    </div>
  );
}
