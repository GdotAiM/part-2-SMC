/**
 * Learning Dashboard — Phase 9
 *
 * Displays the Learning & Validation Framework's accumulated data:
 *   - Agreement % / Disagreement %
 *   - Engine Accuracy / TradingView Accuracy
 *   - Reliability by Detection Type
 *   - Parameter Suggestions
 *   - Recent Learning Events
 *   - Top Failure/Success Patterns
 *   - Improvement Trend
 *   - Knowledge Growth indicators
 *
 * The dashboard makes the system feel alive and continuously improving.
 */

import { useState, useEffect } from "react";

interface DashboardData {
  reliability: {
    overall: number;
    byType: Record<string, number>;
    bySource: { tv: number; engine: number };
    byTypeBySource: Record<string, { tv: number; engine: number }>;
    sampleSizes: Record<string, number>;
    trend: string;
    recommendedFocus: string[];
  };
  comparisons: {
    total: number;
    bothDetected: number;
    tvOnly: number;
    engineOnly: number;
    neither: number;
  };
  outcomes: {
    total: number;
    respected: number;
    swept: number;
    ignored: number;
    filled: number;
    reversal: number;
  };
  derivedMetrics: {
    agreementRate: number;
    engineAccuracy: number;
    tvAccuracy: number;
    bothWrongRate: number;
    bothCorrectRate: number;
  };
  recentEvents: Array<{
    id: string;
    event_type: string;
    title: string;
    description: string;
    significance: string;
    detected_at: string;
  }>;
  recentSuggestions: Array<{
    id: string;
    parameter_name: string;
    component: string;
    current_value: string;
    suggested_value: string;
    status: string;
  }>;
  patterns: Array<{
    id: string;
    pattern_name: string;
    pattern_type: string;
    occurrence_count: number;
    win_rate_when_present: string;
  }>;
}

function StatCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{
      background: "var(--card-bg, #1a1a2e)",
      borderRadius: 12,
      padding: "16px 20px",
      border: "1px solid var(--border, #2a2a4e)",
      flex: "1 1 180px",
    }}>
      <div style={{ fontSize: 12, color: "#888", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: color || "var(--accent, #22c55e)" }}>
        {typeof value === "number" ? `${value.toFixed(1)}%` : value}
      </div>
    </div>
  );
}

function ReliabilityBar({ label, score, maxScore = 100 }: { label: string; score: number; maxScore?: number }) {
  const pct = Math.min(100, Math.max(0, (score / maxScore) * 100));
  const color = pct >= 80 ? "#22c55e" : pct >= 60 ? "#eab308" : "#ef4444";
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 2 }}>
        <span>{label}</span>
        <span style={{ color, fontWeight: 600 }}>{score.toFixed(1)}%</span>
      </div>
      <div style={{ height: 6, background: "#2a2a4e", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 3, transition: "width 0.5s" }} />
      </div>
    </div>
  );
}

export default function LearningDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/learning/dashboard")
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#888" }}>Loading learning dashboard...</div>;
  if (error) return <div style={{ padding: 40, textAlign: "center", color: "#ef4444" }}>Error: {error}</div>;
  if (!data) return <div style={{ padding: 40, textAlign: "center", color: "#888" }}>No data available.</div>;

  const { reliability, comparisons, outcomes, derivedMetrics, recentEvents, recentSuggestions, patterns } = data;

  return (
    <div style={{ padding: "24px 32px", maxWidth: 1400, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>Learning Dashboard</h1>
        <p style={{ color: "#888", margin: "8px 0 0 0" }}>
          Evidence-driven feedback system — tracking {comparisons.total} comparisons across {Object.keys(reliability.byType).length} detection types.
          Trend: <strong>{reliability.trend}</strong>
        </p>
      </div>

      {/* Top-level stats */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 32 }}>
        <StatCard label="Agreement Rate" value={derivedMetrics.agreementRate} color="#22c55e" />
        <StatCard label="Engine Accuracy" value={derivedMetrics.engineAccuracy} color={derivedMetrics.engineAccuracy > 50 ? "#22c55e" : "#eab308"} />
        <StatCard label="TV Accuracy" value={derivedMetrics.tvAccuracy} color={derivedMetrics.tvAccuracy > 50 ? "#22c55e" : "#eab308"} />
        <StatCard label="Both Wrong" value={derivedMetrics.bothWrongRate} color="#ef4444" />
        <StatCard label="Both Correct" value={derivedMetrics.bothCorrectRate} color="#22c55e" />
        <StatCard label="Total Comparisons" value={comparisons.total} color="#a855f7" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 32 }}>
        {/* Reliability by Type */}
        <div style={{ background: "var(--card-bg, #1a1a2e)", borderRadius: 12, padding: 20, border: "1px solid var(--border, #2a2a4e)" }}>
          <h3 style={{ margin: "0 0 16px 0", fontSize: 16 }}>Reliability by Detection Type</h3>
          <div>
            {Object.entries(reliability.byType)
              .sort(([, a], [, b]) => b - a)
              .map(([type, score]) => (
                <ReliabilityBar key={type} label={type} score={score} />
              ))}
          </div>
          {reliability.recommendedFocus.length > 0 && (
            <div style={{ marginTop: 16, padding: 12, background: "#2a1a1a", borderRadius: 8, border: "1px solid #4a2a2a" }}>
              <strong style={{ color: "#ef4444", fontSize: 13 }}>⚠ Needs Improvement:</strong>
              <span style={{ color: "#888", fontSize: 13, marginLeft: 8 }}>{reliability.recommendedFocus.join(", ")}</span>
            </div>
          )}
        </div>

        {/* Agreement Breakdown */}
        <div style={{ background: "var(--card-bg, #1a1a2e)", borderRadius: 12, padding: 20, border: "1px solid var(--border, #2a2a4e)" }}>
          <h3 style={{ margin: "0 0 16px 0", fontSize: 16 }}>Comparison Agreement Breakdown</h3>
          <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
            <div style={{ flex: 1, textAlign: "center", padding: 12, background: "#0a2a1a", borderRadius: 8 }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: "#22c55e" }}>{comparisons.bothDetected}</div>
              <div style={{ fontSize: 11, color: "#888" }}>Both</div>
            </div>
            <div style={{ flex: 1, textAlign: "center", padding: 12, background: "#1a1a2a", borderRadius: 8 }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: "#3b82f6" }}>{comparisons.tvOnly}</div>
              <div style={{ fontSize: 11, color: "#888" }}>TV Only</div>
            </div>
            <div style={{ flex: 1, textAlign: "center", padding: 12, background: "#2a1a1a", borderRadius: 8 }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: "#a855f7" }}>{comparisons.engineOnly}</div>
              <div style={{ fontSize: 11, color: "#888" }}>Engine Only</div>
            </div>
            <div style={{ flex: 1, textAlign: "center", padding: 12, background: "#2a2a2a", borderRadius: 8 }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: "#666" }}>{comparisons.neither}</div>
              <div style={{ fontSize: 11, color: "#888" }}>Neither</div>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#888" }}>
            <span>Engine: {reliability.bySource?.engine?.toFixed(1) ?? "?"}%</span>
            <span>TV: {reliability.bySource?.tv?.toFixed(1) ?? "?"}%</span>
          </div>
        </div>
      </div>

      {/* Two-column: Suggestions + Patterns */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 32 }}>
        {/* Parameter Suggestions */}
        <div style={{ background: "var(--card-bg, #1a1a2e)", borderRadius: 12, padding: 20, border: "1px solid var(--border, #2a2a4e)" }}>
          <h3 style={{ margin: "0 0 16px 0", fontSize: 16 }}>
            Parameter Suggestions <span style={{ fontSize: 12, color: "#888", fontWeight: 400 }}>({recentSuggestions.length} pending)</span>
          </h3>
          {recentSuggestions.length === 0 ? (
            <div style={{ color: "#888", fontSize: 13 }}>No suggestions yet. Accumulate more comparisons.</div>
          ) : (
            recentSuggestions.slice(0, 5).map(s => (
              <div key={s.id} style={{ padding: "8px 0", borderBottom: "1px solid #2a2a4e", fontSize: 13 }}>
                <strong>{s.component}.{s.parameter_name}</strong>: {s.current_value} →{" "}
                <strong style={{ color: "#22c55e" }}>{s.suggested_value}</strong>
                <span style={{ color: "#888", marginLeft: 8 }}>[{s.status}]</span>
              </div>
            ))
          )}
        </div>

        {/* Pattern Statistics */}
        <div style={{ background: "var(--card-bg, #1a1a2e)", borderRadius: 12, padding: 20, border: "1px solid var(--border, #2a2a4e)" }}>
          <h3 style={{ margin: "0 0 16px 0", fontSize: 16 }}>Pattern Statistics</h3>
          {patterns.length === 0 ? (
            <div style={{ color: "#888", fontSize: 13 }}>No patterns identified yet.</div>
          ) : (
            patterns.slice(0, 5).map(p => (
              <div key={p.id} style={{ padding: "8px 0", borderBottom: "1px solid #2a2a4e", fontSize: 13 }}>
                <strong>{p.pattern_name}</strong>
                <span style={{ marginLeft: 8, color: "#888" }}>{p.pattern_type}</span>
                <div style={{ color: "#666", fontSize: 11, marginTop: 2 }}>
                  {p.occurrence_count} occurrences · Win rate: {p.win_rate_when_present ? `${(parseFloat(p.win_rate_when_present) * 100).toFixed(0)}%` : "N/A"}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Learning Events */}
      <div style={{ background: "var(--card-bg, #1a1a2e)", borderRadius: 12, padding: 20, border: "1px solid var(--border, #2a2a4e)", marginBottom: 32 }}>
        <h3 style={{ margin: "0 0 16px 0", fontSize: 16 }}>Recent Learning Events</h3>
        {recentEvents.length === 0 ? (
          <div style={{ color: "#888", fontSize: 13 }}>No events yet. Learning accumulates over time.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {recentEvents.slice(0, 10).map(e => (
              <div key={e.id} style={{
                padding: 12, borderRadius: 8,
                background: parseFloat(e.significance) > 0.7 ? "#2a1a1a" : "#1a1a2a",
                border: "1px solid #2a2a4e", fontSize: 13,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <strong style={{ color: parseFloat(e.significance) > 0.7 ? "#eab308" : "#22c55e" }}>
                    {e.event_type}
                  </strong>
                  <span style={{ color: "#666", fontSize: 11 }}>
                    {new Date(e.detected_at).toLocaleDateString()}
                  </span>
                </div>
                <div style={{ color: "#ccc" }}>{e.title}</div>
                <div style={{ color: "#888", fontSize: 12, marginTop: 4 }}>{e.description.slice(0, 200)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ textAlign: "center", color: "#555", fontSize: 12, padding: 20 }}>
        Learning Framework v1.0 · {comparisons.total} comparisons · {outcomes.total} outcomes evaluated
        · Last updated: {new Date().toLocaleString()}
      </div>
    </div>
  );
}
