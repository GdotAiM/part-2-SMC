/**
 * LiveTimeline — scrolling event feed showing market events as they happen.
 * Each event card has action buttons for relevant capabilities.
 *
 * Left sidebar. Persists across stage changes.
 */

import { useCallback, useRef, useEffect, useState } from "react";
import { useMarketStore, type TimelineEntry } from "@/state/market-store";
import { useProfileStore } from "@/state/profile-store";
import { detectSession, SESSION_LABELS } from "@/state/narrative";
import { fmtPrice } from "@/lib/smc-display";

const EVENT_ICONS: Record<string, string> = {
  session_open: "🕐",
  liquidity_sweep: "⚡",
  structure_break: "💥",
  fvg_formed: "🕳",
  displacement: "📏",
  mss_confirmed: "✅",
  entry_ready: "🎯",
  signal_generated: "📡",
  trade_opened: "🟢",
  trade_closed: "🔴",
  alert: "🔔",
  system: "⚙️",
};

function EventIcon({ type }: { type: string }) {
  return <span className="text-xs shrink-0">{EVENT_ICONS[type] ?? "●"}</span>;
}

function EventCard({ event }: { event: TimelineEntry }) {
  const time = new Date(event.timestamp);
  const timeStr = time.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  return (
    <div className="group flex items-start gap-2.5 px-3 py-2 rounded-sm hover:bg-muted/20 transition-colors">
      {/* Timeline line */}
      <div className="flex flex-col items-center shrink-0">
        <EventIcon type={event.type} />
        <div className="w-px h-full min-h-[8px] bg-border/40 mt-1" />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-semibold text-foreground truncate">{event.title}</span>
          <span className="text-[8px] text-muted-foreground font-mono shrink-0">{timeStr}</span>
        </div>
        {event.description && (
          <p className="text-[9px] text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">{event.description}</p>
        )}
        {event.price && (
          <span className="text-[9px] font-mono text-primary mt-0.5 block">
            @ {event.price.toLocaleString("en-US", { maximumFractionDigits: 2 })}
          </span>
        )}
        {event.actionable && event.actionLabel && (
          <button
            onClick={event.actionFn}
            className="mt-1 px-2 py-0.5 rounded-sm text-[8px] font-semibold bg-primary/10 border border-primary/20 text-primary hover:bg-primary/15 transition-colors"
          >
            {event.actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}

export function LiveTimeline() {
  const timeline = useMarketStore((s) => s.timeline);
  const timelineFilter = useMarketStore((s) => s.timelineFilter);
  const setTimelineFilter = useMarketStore((s) => s.setTimelineFilter);
  const scrollRef = useRef<HTMLDivElement>(null);

  const filtered = timelineFilter
    ? timeline.filter((e) => e.type === timelineFilter)
    : timeline;

  const session = detectSession();

  const filterOptions = [
    { key: null, label: "All" },
    { key: "liquidity_sweep", label: "Sweeps" },
    { key: "structure_break", label: "Structure" },
    { key: "fvg_formed", label: "FVGs" },
    { key: "entry_ready", label: "Entries" },
  ];

  // Auto-scroll to top on new events
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [timeline.length]);

  return (
    <aside className="w-[260px] hidden lg:flex flex-col border-r border-border/30 bg-card/20 shrink-0">
      {/* Header */}
      <div className="px-3 pt-3 pb-2 border-b border-border/20">
        <div className="flex items-center justify-between">
          <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Session Timeline
          </h3>
          <span className="text-[8px] text-muted-foreground font-mono">{SESSION_LABELS[session.name]}</span>
        </div>

        {/* Filters */}
        <div className="flex gap-1 mt-2 overflow-x-auto">
          {filterOptions.map((opt) => (
            <button
              key={opt.key ?? "all"}
              onClick={() => setTimelineFilter(opt.key)}
              className={`px-1.5 py-0.5 rounded-sm text-[8px] font-medium whitespace-nowrap transition-colors ${
                timelineFilter === opt.key
                  ? "bg-primary/10 text-primary border border-primary/20"
                  : "bg-muted/30 text-muted-foreground hover:text-foreground border border-transparent"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Events */}
      {/* Sweep Scanner — watchlist sweep detection */}
      <SweepScanner />

      <div ref={scrollRef} className="flex-1 overflow-y-auto py-1 space-y-0">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-[10px] text-muted-foreground italic font-mono px-3 text-center">
            No events yet. Select a symbol to begin.
          </div>
        ) : (
          filtered.map((event) => (
            <EventCard key={event.id} event={event} />
          ))
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-border/20">
        <div className="flex items-center justify-between text-[8px] text-muted-foreground">
          <span>{filtered.length} events</span>
          <span className="text-primary/50">{timelineFilter ? "filtered" : "all"}</span>
        </div>
      </div>
    </aside>
  );
}

// ── Sweep Scanner — polls watchlist for recent liquidity sweeps ────────────

function SweepScanner() {
  const watchlist = useProfileStore((s) => s.profile.watchlist);
  const setSymbol = useMarketStore((s) => s.setSymbol);
  const symbol = useMarketStore((s) => s.symbol);
  const marketType = useMarketStore((s) => s.marketType);
  const [results, setResults] = useState<Array<{ sym: string; swept: boolean; type?: string; bias?: string; price?: number }>>([]);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    let active = true;
    async function scan() {
      const r: typeof results = [];
      for (const sym of watchlist.slice(0, 6)) {
        try {
          const resp = await fetch(`/api/analysis/crypto?symbol=${sym}&timeframe=15m`);
          if (!resp.ok) continue;
          const data = await resp.json();
          const swept = data.liquidity?.pools?.some((p: any) => p.wasSwept);
          const sweptPool = swept ? data.liquidity.pools.find((p: any) => p.wasSwept) : null;
          r.push({
            sym,
            swept: !!swept,
            type: sweptPool?.type,
            bias: data.structure?.bias,
            price: data.currentPrice,
          });
        } catch {}
      }
      if (active) setResults(r);
    }
    scan();
    const interval = setInterval(scan, 120_000); // every 2 min
    return () => { active = false; clearInterval(interval); };
  }, [watchlist.join(",")]);

  const sweptCount = results.filter((r) => r.swept).length;

  return (
    <div className="border-b border-border/20">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-white/3 transition-colors">
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Sweep Scanner</span>
          {sweptCount > 0 && (
            <span className="text-[8px] px-1 py-0.5 rounded-sm bg-emerald-500/10 text-emerald-500 font-bold">{sweptCount}</span>
          )}
        </div>
        <span className="text-[9px] text-muted-foreground">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="px-3 pb-2 space-y-0.5">
          {results.map((r) => (
            <button
              key={r.sym}
              onClick={() => setSymbol(r.sym, marketType)}
              className={`w-full flex items-center justify-between py-1 px-2 rounded-sm text-left transition-colors ${
                r.sym === symbol ? "bg-primary/10 border border-primary/20" : "hover:bg-muted/20"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${r.swept ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/30"}`} />
                <span className="text-[9px] font-semibold text-foreground">{r.sym}</span>
              </div>
              <div className="flex items-center gap-2">
                {r.swept && r.type && <span className="text-[7px] text-emerald-500 font-bold">{r.type}</span>}
                {r.bias && <span className={`text-[7px] ${r.bias === "bullish" ? "text-emerald-500" : r.bias === "bearish" ? "text-destructive" : "text-muted-foreground"}`}>{r.bias.slice(0,4).toUpperCase()}</span>}
                {r.price && <span className="text-[7px] text-muted-foreground font-mono">{fmtPrice(r.price, "crypto")}</span>}
              </div>
            </button>
          ))}
          {results.length === 0 && <p className="text-[8px] text-muted-foreground italic px-2">Scanning watchlist…</p>}
        </div>
      )}
    </div>
  );
}
