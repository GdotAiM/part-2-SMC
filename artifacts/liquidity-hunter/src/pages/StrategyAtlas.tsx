/**
 * Strategy Atlas — Browse all 59 model definitions across 7 ontology layers.
 *
 * Uses the GET /api/strategies endpoint for real model data.
 */

import { useState, useEffect } from "react";
import { Brain, Search, Loader2, AlertTriangle } from "lucide-react";
import { apiUrl } from "@/lib/api";

interface StrategySummary {
  id: string;
  name: string;
  description?: string;
  tags: string[];
  ontology?: string;
  priority?: string;
  prerequisites?: string[];
  requiredTimeframes?: string[];
  invalidation?: Array<{ reason: string }>;
  temporalRules?: { session?: string[] };
}

const ONTOLOGY_FILTERS = [
  { key: "ALL", label: "All", count: 59 },
  { key: "EXECUTION_MODEL", label: "Execution Models", count: 17 },
  { key: "CONCEPT", label: "Concepts", count: 8 },
  { key: "STRUCTURAL_PATTERN", label: "Structural", count: 6 },
  { key: "TEMPORAL_MODEL", label: "Temporal", count: 5 },
  { key: "MARKET_CYCLE", label: "Market Cycle", count: 3 },
  { key: "CURRICULUM", label: "Curriculum", count: 12 },
  { key: "TRADING_HORIZON", label: "Horizons", count: 8 },
];

export function StrategyAtlas() {
  const [strategies, setStrategies] = useState<StrategySummary[]>([]);
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<StrategySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(apiUrl("/strategies"))
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(d => { if (!cancelled) setStrategies(d.strategies ?? []); })
      .catch(e => { if (!cancelled) setError(e.message ?? "Failed to load strategies"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const filtered = strategies.filter(s => {
    if (filter !== "ALL" && s.ontology !== filter) return false;
    return !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.id.toLowerCase().includes(search.toLowerCase());
  });

  const content = !loading && !error ? (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-muted/50 border border-border/40">
          <Search className="w-3 h-3 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search models..."
            className="bg-transparent outline-none text-xs font-mono w-40"
          />
        </div>
        {ONTOLOGY_FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-2.5 py-1.5 rounded-sm text-[10px] font-semibold border transition-colors ${
              filter === f.key
                ? "bg-primary/10 border-primary/30 text-primary"
                : "bg-muted/30 border-border/40 text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
        {filtered.map(s => {
          const isSelected = selected?.id === s.id;
          return (
            <button
              key={s.id}
              onClick={() => setSelected(isSelected ? null : s)}
              className={`text-left p-3 rounded-sm border transition-colors ${
                isSelected
                  ? "border-primary/40 bg-primary/5"
                  : "border-border/20 bg-card/30 hover:border-primary/30 hover:bg-muted/20"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium truncate">{s.name || s.id}</span>
                <span className="text-[9px] text-muted-foreground font-mono shrink-0 ml-2">{s.id}</span>
              </div>
              {s.tags && s.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {s.tags.slice(0, 3).map(t => (
                    <span key={t} className="text-[8px] px-1 py-0.5 rounded bg-muted/50 text-muted-foreground/70">{t}</span>
                  ))}
                </div>
              )}
            </button>
          );
        })}
        {filtered.length === 0 && (
          <div className="col-span-full flex items-center justify-center h-24 text-xs text-muted-foreground italic font-mono">
            No models match your search
          </div>
        )}
      </div>

      {selected && (
        <section className="rounded-sm border border-primary/30 bg-primary/5 p-5 grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2"><Brain className="w-4 h-4 text-primary" /><h2 className="text-lg font-bold">{selected.name}</h2></div>
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{selected.description || "No description has been provided for this definition yet."}</p>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <Detail label="Prerequisites" value={selected.prerequisites?.join(", ") || "None declared"} />
              <Detail label="Timeframes" value={selected.requiredTimeframes?.join(", ") || "Context dependent"} />
              <Detail label="Sessions" value={selected.temporalRules?.session?.join(", ") || "No session constraint"} />
              <Detail label="Invalidation" value={selected.invalidation?.map(i => i.reason).join("; ") || "No explicit invalidation"} />
            </div>
          </div>
          <div className="rounded-sm border border-border/30 bg-background/30 p-4">
            <div className="text-[9px] uppercase tracking-widest text-muted-foreground">Ontology</div>
            <div className="mt-1 text-sm font-semibold text-primary">{selected.ontology || "UNCLASSIFIED"}</div>
            <div className="mt-4 text-[9px] uppercase tracking-widest text-muted-foreground">Priority</div>
            <div className="mt-1 text-sm font-semibold">{selected.priority || "INFORMATIONAL"}</div>
          </div>
        </section>
      )}
    </>
  ) : null;

  return (
    <div className="p-5 lg:p-7 max-w-[1800px] mx-auto space-y-5">
      <div>
        <div className="text-[9px] text-primary/50 uppercase tracking-widest mb-1">Analyze</div>
        <h1 className="text-2xl lg:text-3xl font-black tracking-tight">Strategy Atlas</h1>
        <p className="mt-1 text-xs text-muted-foreground max-w-2xl">
          59 model definitions across 7 ontology layers. One navigable intelligence surface.
        </p>
      </div>

      {loading && (
        <div className="flex items-center gap-3 justify-center py-20 text-xs text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading strategies…
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 justify-center py-20 text-xs text-destructive">
          <AlertTriangle className="w-4 h-4" />
          {error}
        </div>
      )}

      {content}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="rounded-sm border border-border/20 bg-muted/10 p-3"><div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div><div className="mt-1 text-xs text-foreground leading-relaxed">{value}</div></div>;
}
