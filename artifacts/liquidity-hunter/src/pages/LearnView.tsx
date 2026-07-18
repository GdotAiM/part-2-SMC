/**
 * Learn View — Learning, Truth Engine, and evidence surfaces.
 *
 * Fetches live data from GET /api/learning/dashboard to display
 * reliability, outcomes, events, and pattern statistics.
 */

import { useEffect, useState } from "react";
import { Shield, Activity, TrendingUp, AlertTriangle, Loader2 } from "lucide-react";
import { apiUrl } from "@/lib/api";

interface DashboardData {
  reliability?: {
    overall: number;
    byType: Record<string, number>;
    bySource: { tv: number; engine: number };
    byTypeBySource: Record<string, { tv: number; engine: number }>;
    sampleSizes: Record<string, number>;
    trend: string;
    recommendedFocus: string[];
  };
  comparisons?: {
    total: number;
    bothDetected: number;
    tvOnly: number;
    engineOnly: number;
    neither: number;
  };
  outcomes?: {
    total: number;
    respected: number;
    swept: number;
    ignored: number;
    filled: number;
    reversal: number;
  };
  derivedMetrics?: {
    agreementRate: number;
    engineAccuracy: number;
    tvAccuracy: number;
    bothWrongRate: number;
    bothCorrectRate: number;
  };
  recentEvents?: Array<{
    id: string;
    event_type: string;
    title: string;
    description: string;
    significance: number;
    detected_at: string;
  }>;
  patterns?: Array<{
    id: string;
    pattern_name: string;
    pattern_type: string;
    occurrence_count: number;
    win_rate_when_present: number;
  }>;
  recentSuggestions?: Array<{
    id: string;
    parameter_name: string;
    component: string;
    current_value: string;
    suggested_value: string;
    status: string;
  }>;
}

export function LearnView() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(apiUrl("/learning/dashboard"))
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(d => { if (!cancelled) setData(d); })
      .catch(e => { if (!cancelled) setError(e.message ?? "Failed to load learning dashboard"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Backend returns reliability and derivedMetrics as percentages (0-100).
  // No multiplication needed — use the values directly.
  const reliabilityEntries = data?.reliability?.byType
    ? Object.entries(data.reliability.byType).map(([key, val]) => ({ key, label: key.replace(/_/g, " "), score: Math.round(val) }))
    : [];

  const latestEvents = data?.recentEvents?.slice(0, 8) ?? [];

  const reliabilityScore = data?.reliability?.overall != null ? Math.round(data.reliability.overall) : null;
  const outcomeCount = data?.outcomes?.total ?? data?.comparisons?.total ?? null;
  const engineAcc = data?.derivedMetrics?.engineAccuracy != null ? Math.round(data.derivedMetrics.engineAccuracy) : null;

  return (
    <div className="p-5 lg:p-7 max-w-[1800px] mx-auto space-y-5">
      <div>
        <div className="text-[9px] text-primary/50 uppercase tracking-widest mb-1">Learn</div>
        <h1 className="text-2xl lg:text-3xl font-black tracking-tight">Evidence changes the system.</h1>
        <p className="mt-1 text-xs text-muted-foreground max-w-2xl">
          The learning layer compares hypotheses against evidence, then tracks what the system actually gets right.
        </p>
      </div>

      {loading && (
        <div className="flex items-center gap-3 justify-center py-20 text-xs text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading learning dashboard…
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 justify-center py-20 text-xs text-destructive">
          <AlertTriangle className="w-4 h-4" />
          {error}
        </div>
      )}

      {!loading && !error && !data && (
        <div className="flex items-center justify-center py-20 text-xs text-muted-foreground italic font-mono">
          No learning data yet — run analysis to build the evidence base.
        </div>
      )}

      {!loading && !error && data && (
        <div className="grid grid-cols-12 gap-4">
          {/* Truth Engine */}
          <section className="col-span-12 lg:col-span-7 rounded-sm border border-border/30 bg-card/40 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" />
                <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Truth Engine</h3>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-sm font-semibold ${
                reliabilityScore != null && reliabilityScore >= 70
                  ? "bg-[hsl(var(--bullish))]/10 text-[hsl(var(--bullish))] border border-[hsl(var(--bullish))]/20"
                  : reliabilityScore != null && reliabilityScore >= 50
                  ? "bg-primary/10 text-primary border border-primary/20"
                  : "bg-amber-400/10 text-amber-400 border border-amber-500/20"
              }`}>
                Verdict: {reliabilityScore != null && reliabilityScore >= 70 ? "Reliable" : reliabilityScore != null && reliabilityScore >= 50 ? "Developing" : "Insufficient Data"}
              </span>
            </div>
            <div className="p-4 rounded-sm bg-muted/20 border border-border/20">
              <div className="text-[9px] text-muted-foreground uppercase tracking-wider">Latest Verdict</div>
              <div className="mt-2 text-lg font-black">
                {engineAcc != null ? `Engine ${engineAcc}% Accuracy` : "Building evidence base"}
              </div>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                {data.reliability?.trend
                  ? data.reliability.trend
                  : "The system is accumulating comparison data to establish a reliability baseline across detection types."}
              </p>
              <div className="mt-4 grid grid-cols-3 gap-3">
                {[
                  ["Reliability", reliabilityScore != null ? `${reliabilityScore}%` : "—",
                   reliabilityScore != null && reliabilityScore >= 70 ? "text-[hsl(var(--bullish))]" : "text-foreground"],
                  ["Outcomes", outcomeCount != null ? String(outcomeCount) : "—", "text-foreground"],
                  ["Confidence", engineAcc != null && engineAcc >= 70 ? "HIGH" : engineAcc != null && engineAcc >= 50 ? "MEDIUM" : "—",
                   engineAcc != null && engineAcc >= 70 ? "text-primary" : "text-muted-foreground"],
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
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
              Learning Timeline
              {latestEvents.length > 0 && (
                <span className="ml-2 text-[9px] text-muted-foreground/50 font-normal">({latestEvents.length} events)</span>
              )}
            </h3>
            <div className="space-y-2 max-h-[320px] overflow-y-auto">
              {latestEvents.length === 0 && (
                <p className="text-xs text-muted-foreground italic font-mono">No learning events recorded yet.</p>
              )}
              {latestEvents.map((ev, i) => (
                <div key={ev.id} className="flex gap-3 items-start">
                  <div className={`w-6 h-6 rounded-sm flex items-center justify-center text-[9px] font-bold shrink-0 ${
                    ev.significance > 0.7 ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
                  }`}>
                    <Activity className="w-3 h-3" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs text-foreground truncate">{ev.title}</div>
                    <div className="flex gap-2 text-[9px] text-muted-foreground mt-0.5">
                      <span className="uppercase tracking-wider">{ev.event_type}</span>
                      {ev.detected_at && (
                        <span>{new Date(ev.detected_at).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Reliability Matrix */}
          <section className="col-span-12 rounded-sm border border-border/30 bg-card/40 p-5">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">Detection Reliability</h3>
            {reliabilityEntries.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {reliabilityEntries.map(({ key, label, score }) => (
                  <div key={key} className="p-4 rounded-sm bg-muted/20 border border-border/20">
                    <div className="text-xs text-muted-foreground truncate" title={label}>{label}</div>
                    <div className="mt-2 text-xl font-black text-primary">{score}%</div>
                    <div className="mt-2 h-1 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-primary to-cyan-400"
                        style={{ width: `${score}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic font-mono">No reliability data available yet.</p>
            )}
          </section>

          {/* Derived Metrics */}
          {data.derivedMetrics && (
            <section className="col-span-12 rounded-sm border border-border/30 bg-card/40 p-5">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">Comparison Metrics</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                  ["Agreement Rate", data.derivedMetrics.agreementRate, "%"],
                  ["Engine Accuracy", data.derivedMetrics.engineAccuracy, "%"],
                  ["TV Accuracy", data.derivedMetrics.tvAccuracy, "%"],
                  ["Both Wrong", data.derivedMetrics.bothWrongRate, "%"],
                  ["Both Correct", data.derivedMetrics.bothCorrectRate, "%"],
                ].map(([label, val, unit]) => (
                  <div key={label as string} className="p-3 rounded-sm bg-muted/20 border border-border/20">
                    <div className="text-[9px] text-muted-foreground uppercase tracking-wider">{label as string}</div>
                    <div className="mt-1 text-lg font-black text-primary">
                      {val != null ? `${Math.round(val as number)}${unit}` : "—"}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
