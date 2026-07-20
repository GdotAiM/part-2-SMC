/**
 * QuickTools — collapsible utility panel in the right column.
 *
 * FunnelStage-style sections for killzone timer, silver bullet timer,
 * breaker blocks, displacement gauge, range expansion, OTE zone,
 * risk calculator, daily trade counter, and luxalgo comparison.
 */

import { useState, useMemo } from "react";
import { useMarketStore } from "@/state/market-store";
import { useProfileStore } from "@/state/profile-store";
import { fmtPrice, TF_LABEL_MAP } from "@/lib/smc-display";
import { detectSession } from "@/state/narrative";
import type { SmcReport } from "@workspace/api-client-react";
import type { Market } from "@/lib/smc-display";

// ── Collapsible tool section ─────────────────────────────────────────────────

function ToolSection({
  title,
  icon,
  status = "info",
  children,
  defaultOpen = false,
}: {
  title: string;
  icon: string;
  status?: "pass" | "pending" | "fail" | "info";
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  const statusColors = {
    pass: "border-emerald-500/30 bg-emerald-500/5",
    pending: "border-amber-500/30 bg-amber-500/5",
    fail: "border-destructive/30 bg-destructive/5",
    info: "border-border/30 bg-muted/10",
  };

  const statusDots = {
    pass: "bg-emerald-500",
    pending: "bg-amber-400",
    fail: "bg-destructive",
    info: "bg-muted-foreground",
  };

  return (
    <div className={`rounded-sm border ${statusColors[status]} overflow-hidden`}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-white/3 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs shrink-0">{icon}</span>
          <span className="text-[9px] font-semibold text-foreground truncate">{title}</span>
        </div>
        <span className="text-[9px] text-muted-foreground shrink-0 ml-1">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="px-3 pb-3 text-[10px] text-muted-foreground leading-relaxed">
          {children}
        </div>
      )}
    </div>
  );
}

// ── Killzone Timer ──────────────────────────────────────────────────────────

const KILLZONES = [
  { name: "London Killzone", startUtcH: 7, endUtcH: 9, icon: "🇬🇧" },
  { name: "NY AM Killzone", startUtcH: 12, endUtcH: 14, icon: "🇺🇸" },
  { name: "NY PM Killzone", startUtcH: 15, endUtcH: 16, icon: "🗽" },
];

function KillzoneTimer() {
  const now = new Date();
  const utcH = now.getUTCHours();
  const utcM = now.getUTCMinutes();
  const totalMin = utcH * 60 + utcM;

  const zones = KILLZONES.map((kz) => {
    const startMin = kz.startUtcH * 60;
    const endMin = kz.endUtcH * 60;
    const active = totalMin >= startMin && totalMin < endMin;
    const remainingMin = active ? endMin - totalMin : startMin > totalMin ? startMin - totalMin : startMin + 1440 - totalMin;
    const progress = active ? ((totalMin - startMin) / (endMin - startMin)) * 100 : 0;
    return { ...kz, active, remainingMin, progress };
  });

  return (
    <div className="space-y-2">
      {zones.map((kz) => (
        <div key={kz.name} className={`rounded-sm border p-2 ${kz.active ? "bg-primary/5 border-primary/20" : "bg-muted/20 border-border/20"}`}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] font-semibold text-foreground">
              {kz.icon} {kz.name}
            </span>
            <span className={`text-[8px] font-bold font-mono ${kz.active ? "text-primary" : "text-muted-foreground"}`}>
              {kz.active ? `${Math.floor(kz.remainingMin)}m left` : `in ${kz.remainingMin}m`}
            </span>
          </div>
          {kz.active && (
            <div className="h-1 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-cyan-400 transition-all"
                style={{ width: `${Math.min(kz.progress, 100)}%` }}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Silver Bullet Timer ─────────────────────────────────────────────────────

const SILVER_BULLETS: Array<{ name: string; startUtcH: number; endUtcH: number; session: "LONDON" | "NY_AM" | "NY_PM" }> = [
  { name: "London SB", startUtcH: 8, endUtcH: 9, session: "LONDON" },
  { name: "NY AM SB", startUtcH: 13, endUtcH: 14, session: "NY_AM" },
  { name: "NY PM SB", startUtcH: 15, endUtcH: 16, session: "NY_PM" },
];

function SilverBulletTimer() {
  const profile = useProfileStore((s) => s.profile);
  const enabledSB = profile.models.filter((m) => m.id.startsWith("temporal-silver-bullet") && m.enabled).map((m) => {
    if (m.id.includes("london")) return "LONDON" as const;
    if (m.id.includes("nyam")) return "NY_AM" as const;
    if (m.id.includes("nypm")) return "NY_PM" as const;
    return null;
  }).filter((s): s is "LONDON" | "NY_AM" | "NY_PM" => s !== null);

  const now = new Date();
  const utcH = now.getUTCHours();
  const utcM = now.getUTCMinutes();
  const totalMin = utcH * 60 + utcM;

  const bullets = SILVER_BULLETS.map((sb) => {
    const startMin = sb.startUtcH * 60;
    const endMin = sb.endUtcH * 60;
    const active = totalMin >= startMin && totalMin < endMin;
    const remainingMin = active ? endMin - totalMin : startMin > totalMin ? startMin - totalMin : startMin + 1440 - totalMin;
    const enabled = enabledSB.includes(sb.session) || enabledSB.length === 0;
    const progress = active ? ((totalMin - startMin) / (endMin - startMin)) * 100 : 0;
    return { ...sb, active, remainingMin, progress, enabled };
  });

  return (
    <div className="space-y-1.5">
      {bullets.map((sb) => (
        <div key={sb.name} className={`rounded-sm border p-2 ${sb.active && sb.enabled ? "bg-emerald-500/5 border-emerald-500/20" : sb.enabled ? "bg-muted/20 border-border/20" : "bg-muted/10 border-border/10 opacity-50"}`}>
          <div className="flex items-center justify-between">
            <span className="text-[8px] font-semibold text-foreground">🔫 {sb.name}</span>
            <span className={`text-[7px] font-bold font-mono ${sb.active && sb.enabled ? "text-emerald-500" : "text-muted-foreground"}`}>
              {sb.active ? `${Math.floor(sb.remainingMin)}m` : `${sb.remainingMin}m`}
            </span>
          </div>
          {sb.active && sb.enabled && (
            <div className="mt-1 h-0.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(sb.progress, 100)}%` }} />
            </div>
          )}
        </div>
      ))}
      {enabledSB.length === 0 && (
        <p className="text-[8px] text-muted-foreground italic">Enable Silver Bullet models in profile to see targeted timers.</p>
      )}
    </div>
  );
}

// ── Breaker Blocks Viewer ────────────────────────────────────────────────────

function BreakerBlocks() {
  const reports = useMarketStore((s) => s.reports);

  const breakers = useMemo(() => {
    const result: Array<{ tf: string; type: string; price: number; proximal: number; distal: number }> = [];
    for (const [tf, report] of Object.entries(reports)) {
      if (!report) continue;
      for (const ob of report.orderBlocks) {
        if (ob.isBreaker) {
          result.push({ tf, type: ob.type, price: (ob.proximal + ob.distal) / 2, proximal: ob.proximal, distal: ob.distal });
        }
      }
    }
    return result.slice(0, 10);
  }, [reports]);

  if (breakers.length === 0) {
    return <p className="text-[9px] text-muted-foreground italic">No breaker blocks detected in current data.</p>;
  }

  return (
    <div className="space-y-1">
      {breakers.map((b, i) => (
        <div key={i} className="flex items-center justify-between py-1 px-2 rounded-sm bg-amber-400/5 border border-amber-400/20">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[8px] font-mono text-muted-foreground">{TF_LABEL_MAP[b.tf] ?? b.tf}</span>
            <span className={`text-[9px] font-semibold ${b.type === "bullish" ? "text-emerald-500" : "text-destructive"}`}>
              {b.type === "bullish" ? "▲" : "▼"}
            </span>
          </div>
          <span className="text-[9px] font-mono text-amber-400 font-bold">
            {b.price.toFixed(b.price < 1 ? 5 : 2)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Displacement Gauge ───────────────────────────────────────────────────────

function DisplacementGauge() {
  const reports = useMarketStore((s) => s.reports);
  const marketType = useMarketStore((s) => s.marketType) as Market;

  const measurements = useMemo(() => {
    const result: Array<{ tf: string; gapSize: number; fvgCount: number; ratio: number }> = [];
    for (const [tf, report] of Object.entries(reports)) {
      if (!report) continue;
      const unfilled = report.fvg.filter((f) => f.fillFraction < 0.3 && !f.isInversion);
      if (unfilled.length === 0) continue;
      const totalGap = unfilled.reduce((s, f) => s + Math.abs(f.top - f.bottom), 0);
      // Estimate ATR from average candle range
      const avgRange = report.candles?.length
        ? report.candles.reduce((s, c) => s + Math.abs(c.high - c.low), 0) / report.candles.length
        : 1;
      const ratio = totalGap / (avgRange || 1);
      result.push({ tf, gapSize: totalGap, fvgCount: unfilled.length, ratio });
    }
    return result.sort((a, b) => b.ratio - a.ratio).slice(0, 5);
  }, [reports]);

  if (measurements.length === 0) {
    return <p className="text-[9px] text-muted-foreground italic">No unfilled FVGs to measure.</p>;
  }

  return (
    <div className="space-y-1.5">
      {measurements.map((m, i) => (
        <div key={i} className="space-y-0.5">
          <div className="flex items-center justify-between">
            <span className="text-[8px] font-mono text-muted-foreground">{TF_LABEL_MAP[m.tf] ?? m.tf}</span>
            <span className={`text-[8px] font-bold ${m.ratio >= 2 ? "text-emerald-500" : m.ratio >= 1 ? "text-primary" : "text-amber-400"}`}>
              {m.ratio.toFixed(1)}× ATR
            </span>
          </div>
          <div className="h-1 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full ${m.ratio >= 2 ? "bg-emerald-500" : m.ratio >= 1 ? "bg-primary" : "bg-amber-400"}`}
              style={{ width: `${Math.min(m.ratio * 25, 100)}%` }}
            />
          </div>
          <div className="text-[7px] text-muted-foreground">
            {m.fvgCount} FVG{m.fvgCount !== 1 ? "s" : ""} · Gap: {fmtPrice(m.gapSize, marketType)}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Range Expansion ──────────────────────────────────────────────────────────

function RangeExpansion() {
  const reports = useMarketStore((s) => s.reports);

  const expansions = useMemo(() => {
    const result: Array<{ tf: string; lastRange: number; avgRange: number; ratio: number }> = [];
    for (const [tf, report] of Object.entries(reports)) {
      if (!report || !report.candles || report.candles.length < 14) continue;
      const candles = report.candles;
      const last = candles[candles.length - 1];
      const lastRange = Math.abs(last.high - last.low);
      const avgRange = candles.slice(-14).reduce((s, c) => s + Math.abs(c.high - c.low), 0) / 14;
      const ratio = lastRange / (avgRange || 1);
      if (ratio >= 1.2) result.push({ tf, lastRange, avgRange, ratio });
    }
    return result.sort((a, b) => b.ratio - a.ratio).slice(0, 5);
  }, [reports]);

  if (expansions.length === 0) {
    return <p className="text-[9px] text-muted-foreground italic">No expansion candles detected (all within 1.2× ATR).</p>;
  }

  return (
    <div className="space-y-1.5">
      {expansions.map((e, i) => (
        <div key={i} className="flex items-center justify-between py-1">
          <span className="text-[8px] font-mono text-muted-foreground">{TF_LABEL_MAP[e.tf] ?? e.tf}</span>
          <span className="text-[8px] font-mono text-foreground">{e.lastRange.toFixed(e.lastRange < 1 ? 5 : 2)}</span>
          <span className={`text-[8px] font-bold ${e.ratio >= 2.5 ? "text-emerald-500" : "text-primary"}`}>
            {e.ratio.toFixed(1)}× ATR
          </span>
        </div>
      ))}
    </div>
  );
}

// ── OTE Zone Calculator ─────────────────────────────────────────────────────

function OteZoneCalc() {
  const reports = useMarketStore((s) => s.reports);
  const marketType = useMarketStore((s) => s.marketType) as Market;

  const [selectedLow, setSelectedLow] = useState<number | null>(null);
  const [selectedHigh, setSelectedHigh] = useState<number | null>(null);

  const pivots = useMemo(() => {
    const sorted = Object.entries(reports)
      .filter(([, r]) => r !== null)
      .sort(([a], [b]) =>
        ({ "1w":7,"1d":6,"4h":5,"1h":4,"15m":3,"5m":2,"1m":1 }[b] ?? 0) -
        ({ "1w":7,"1d":6,"4h":5,"1h":4,"15m":3,"5m":2,"1m":1 }[a] ?? 0),
      ) as [string, SmcReport][];
    const anchor = sorted[0]?.[1];
    if (!anchor) return [];
    return anchor.structure.pivots.slice(-12).map((p) => ({ type: p.type, price: p.price }));
  }, [reports]);

  const oteZone = useMemo(() => {
    if (selectedLow == null || selectedHigh == null || selectedHigh === selectedLow) return null;
    const low = Math.min(selectedLow, selectedHigh);
    const high = Math.max(selectedLow, selectedHigh);
    const range = high - low;
    const oteLow = high - range * 0.79;
    const oteHigh = high - range * 0.62;
    return { low: oteLow, high: oteHigh, range };
  }, [selectedLow, selectedHigh]);

  return (
    <div className="space-y-2">
      <div className="flex gap-1.5">
        <select
          value={selectedLow ?? ""}
          onChange={(e) => setSelectedLow(e.target.value ? Number(e.target.value) : null)}
          className="flex-1 rounded-sm bg-muted/20 border border-border/20 px-1.5 py-1 text-[8px] font-mono text-foreground"
        >
          <option value="">Swing Low</option>
          {pivots.filter((p) => p.type === "LL" || p.type === "HL").slice(0, 6).map((p, i) => (
            <option key={i} value={p.price}>{p.type} {fmtPrice(p.price, marketType)}</option>
          ))}
        </select>
        <select
          value={selectedHigh ?? ""}
          onChange={(e) => setSelectedHigh(e.target.value ? Number(e.target.value) : null)}
          className="flex-1 rounded-sm bg-muted/20 border border-border/20 px-1.5 py-1 text-[8px] font-mono text-foreground"
        >
          <option value="">Swing High</option>
          {pivots.filter((p) => p.type === "HH" || p.type === "LH").slice(0, 6).map((p, i) => (
            <option key={i} value={p.price}>{p.type} {fmtPrice(p.price, marketType)}</option>
          ))}
        </select>
      </div>
      {oteZone && (
        <div className="rounded-sm bg-emerald-500/5 border border-emerald-500/20 p-2 text-center">
          <div className="text-[7px] uppercase tracking-wider text-muted-foreground">OTE Zone (62-79%)</div>
          <div className="text-[10px] font-bold font-mono text-emerald-500">
            {fmtPrice(oteZone.low, marketType)} – {fmtPrice(oteZone.high, marketType)}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Risk Calculator ──────────────────────────────────────────────────────────

function RiskCalculator() {
  const reports = useMarketStore((s) => s.reports);
  const marketType = useMarketStore((s) => s.marketType) as Market;
  const profile = useProfileStore((s) => s.profile);
  const entryPrice = useMarketStore((s) => s.currentEntryPrice);
  const stopLoss = useMarketStore((s) => s.currentStopLoss);

  const [accountBalance, setAccountBalance] = useState<number>(10000);

  const risk = useMemo(() => {
    if (!entryPrice || !stopLoss || entryPrice === stopLoss) return null;
    const riskPerUnit = Math.abs(entryPrice - stopLoss);
    const riskPercent = profile.risk.positionSizePercent / 100;
    const maxLoss = accountBalance * riskPercent;
    const positionSize = maxLoss / riskPerUnit;
    const positionValue = positionSize * entryPrice;
    const positionPct = (positionValue / accountBalance) * 100;
    return { riskPerUnit, maxLoss, positionSize, positionValue, positionPct };
  }, [entryPrice, stopLoss, accountBalance, profile.risk.positionSizePercent]);

  const currentPrice = useMemo(() => {
    for (const [, report] of Object.entries(reports)) {
      if (report?.currentPrice) return report.currentPrice;
    }
    return null;
  }, [reports]);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <label className="text-[8px] text-muted-foreground shrink-0">Account $</label>
        <input
          type="number"
          value={accountBalance}
          onChange={(e) => setAccountBalance(Number(e.target.value) || 0)}
          className="flex-1 rounded-sm bg-muted/20 border border-border/20 px-1.5 py-0.5 text-[9px] font-mono text-foreground w-20"
        />
      </div>
      <div className="grid grid-cols-2 gap-1 text-[8px]">
        <div className="text-muted-foreground">Entry</div>
        <div className="font-mono text-foreground text-right">{entryPrice ? fmtPrice(entryPrice, marketType) : "—"}</div>
        <div className="text-muted-foreground">Stop Loss</div>
        <div className="font-mono text-destructive text-right">{stopLoss ? fmtPrice(stopLoss, marketType) : "—"}</div>
        {risk && (
          <>
            <div className="text-muted-foreground">Risk/Unit</div>
            <div className="font-mono text-foreground text-right">{fmtPrice(risk.riskPerUnit, marketType)}</div>
            <div className="text-muted-foreground">Max Loss</div>
            <div className="font-mono text-destructive text-right">${risk.maxLoss.toFixed(2)}</div>
            <div className="text-muted-foreground">Position</div>
            <div className="font-mono text-foreground text-right">{risk.positionSize.toFixed(4)} units</div>
            <div className="text-muted-foreground">Size %</div>
            <div className={`font-mono text-right font-bold ${risk.positionPct > 100 ? "text-destructive" : "text-foreground"}`}>
              {risk.positionPct.toFixed(1)}%
            </div>
          </>
        )}
      </div>
      <p className="text-[7px] text-muted-foreground">Risk: {profile.risk.positionSizePercent}% · Min R:R: 1:{profile.risk.minRR}</p>
    </div>
  );
}

// ── Daily Trade Counter ──────────────────────────────────────────────────────

function DailyTradeCounter() {
  const timeline = useMarketStore((s) => s.timeline);
  const profile = useProfileStore((s) => s.profile);

  const todayCount = useMemo(() => {
    const today = new Date().toDateString();
    return timeline.filter((e) => e.type === "trade_opened" && new Date(e.timestamp).toDateString() === today).length;
  }, [timeline]);

  const max = profile.risk.maxDailyTrades;
  const remaining = Math.max(0, max - todayCount);
  const pct = Math.min((todayCount / max) * 100, 100);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-bold text-foreground">{todayCount} / {max}</span>
        <span className={`text-[8px] ${remaining > 0 ? "text-emerald-500" : "text-destructive"}`}>
          {remaining > 0 ? `${remaining} remaining` : "LIMIT REACHED"}
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${pct >= 100 ? "bg-destructive" : pct >= 66 ? "bg-amber-400" : "bg-emerald-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ── LuxAlgo Comparison ───────────────────────────────────────────────────────

function LuxAlgoComparison() {
  const symbol = useMarketStore((s) => s.symbol);
  const marketType = useMarketStore((s) => s.marketType);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ agreementRate?: number; comparisonsCount?: number; error?: string } | null>(null);

  async function runComparison() {
    setLoading(true);
    setResult(null);
    try {
      const resp = await fetch(`/api/learning/comparisons/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, timeframe: "1h", market: marketType }),
      });
      const data = await resp.json();
      if (resp.ok) {
        setResult({
          agreementRate: data.metrics?.agreementRate,
          comparisonsCount: data.comparisonsCount,
        });
      } else {
        setResult({ error: data.error || `HTTP ${resp.status}` });
      }
    } catch (e: any) {
      setResult({ error: e.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        onClick={runComparison}
        disabled={loading}
        className="w-full py-1.5 rounded-sm bg-primary/10 border border-primary/20 text-[9px] text-primary font-semibold hover:bg-primary/15 transition-colors disabled:opacity-50"
      >
        {loading ? "Comparing..." : "⚖️ Compare SMC Engine vs TV LuxAlgo"}
      </button>
      {result?.error && (
        <p className="text-[8px] text-destructive">{result.error}</p>
      )}
      {result?.agreementRate != null && (
        <div className="rounded-sm bg-emerald-500/5 border border-emerald-500/20 p-2 text-center">
          <div className="text-[7px] uppercase tracking-wider text-muted-foreground">Agreement Rate</div>
          <div className="text-sm font-bold font-mono text-emerald-500">{(result.agreementRate * 100).toFixed(0)}%</div>
          <div className="text-[7px] text-muted-foreground">{result.comparisonsCount} points compared</div>
        </div>
      )}
    </div>
  );
}

// ── Main QuickTools export ───────────────────────────────────────────────────

export function QuickTools() {
  return (
    <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
      <ToolSection title="Killzone Timers" icon="⏱" defaultOpen>
        <KillzoneTimer />
      </ToolSection>

      <ToolSection title="Silver Bullet Timers" icon="🔫">
        <SilverBulletTimer />
      </ToolSection>

      <ToolSection title="Breaker Blocks" icon="🔨">
        <BreakerBlocks />
      </ToolSection>

      <ToolSection title="Displacement Gauge" icon="📏">
        <DisplacementGauge />
      </ToolSection>

      <ToolSection title="Range Expansion" icon="📈">
        <RangeExpansion />
      </ToolSection>

      <ToolSection title="OTE Zone Calculator" icon="🎯">
        <OteZoneCalc />
      </ToolSection>

      <ToolSection title="Risk Calculator" icon="🛡">
        <RiskCalculator />
      </ToolSection>

      <ToolSection title="Daily Trade Counter" icon="📊" defaultOpen>
        <DailyTradeCounter />
      </ToolSection>

      <ToolSection title="LuxAlgo Comparison" icon="⚖️">
        <LuxAlgoComparison />
      </ToolSection>
    </div>
  );
}

export default QuickTools;
