import { useState, useEffect } from "react";
import {
  Newspaper, Database, Brain, Loader2, Target, Search,
  ChevronDown, ChevronUp, TrendingUp, TrendingDown,
  ExternalLink, Zap, AlertCircle, Clock, RefreshCw,
} from "lucide-react";
import {
  fetchNews, fetchMacroEvents, findSimilarSetups,
  getQdrantStatus, getNewsContext,
} from "@/lib/api";

type View = "news" | "similar" | "rag";

type Props = {
  symbol: string;
  timeframe?: string;
  market?: "crypto" | "forex";
  setupType?: string;
};

export function MarketIntelligence({ symbol, timeframe, market, setupType }: Props) {
  const [view, setView] = useState<View>("news");

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 border-b border-border/60 pb-2">
        <Brain className="w-3.5 h-3.5 text-primary" />
        <span className="text-xs font-semibold uppercase tracking-wider">Market Intelligence</span>
        <div className="flex-1" />
        <div className="flex gap-1">
          {(["news", "similar", "rag"] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`text-[10px] px-2 py-0.5 rounded-sm font-medium transition-colors ${
                view === v
                  ? "bg-primary/20 text-primary border border-primary/30"
                  : "text-muted-foreground hover:text-foreground border border-transparent"
              }`}
            >
              {v === "news" ? "News" : v === "similar" ? "Similar" : "RAG"}
            </button>
          ))}
        </div>
      </div>

      {view === "news" && <NewsPanel symbol={symbol} />}
      {view === "similar" && <SimilarSetupsPanel symbol={symbol} setupType={setupType} />}
      {view === "rag" && <RagPanel symbol={symbol} />}
    </div>
  );
}

// ── News Panel ──────────────────────────────────────────────────────────

function NewsPanel({ symbol }: { symbol: string }) {
  const [articles, setArticles] = useState<any[]>([]);
  const [macroEvents, setMacroEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [newsRes, macroRes] = await Promise.all([
        fetchNews(symbol, 5),
        fetchMacroEvents(),
      ]);
      setArticles(newsRes.articles || []);
      setMacroEvents(macroRes.events || []);
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, [symbol]);

  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse border border-border rounded-sm p-3 space-y-2">
            <div className="h-3 w-3/4 bg-muted rounded-sm" />
            <div className="h-2 w-full bg-muted rounded-sm" />
            <div className="h-2 w-1/2 bg-muted rounded-sm" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/30 rounded-sm p-2.5 text-xs text-destructive">
        <AlertCircle className="w-3 h-3 shrink-0" />
        {error}
        <button onClick={load} className="ml-auto underline">Retry</button>
      </div>
    );
  }

  // Determine if news is enabled (empty with no error means feature is disabled)
  const newsEnabled = articles.length > 0 || macroEvents.length > 0;

  if (!newsEnabled) {
    return (
      <div className="text-center py-6 space-y-2">
        <Newspaper className="w-5 h-5 text-muted-foreground/40 mx-auto" />
        <p className="text-xs text-muted-foreground">News integration is disabled.</p>
        <p className="text-[10px] text-muted-foreground/60">Set NEWS_ENABLED=true in the server .env to fetch live financial news.</p>
        <div className="flex flex-wrap gap-1.5 justify-center mt-2">
          {["FOMC", "CPI", "NFP", "Bitcoin ETF"].map((kw) => (
            <span key={kw} className="text-[10px] px-1.5 py-0.5 rounded-sm bg-muted text-muted-foreground">{kw}</span>
          ))}
        </div>
      </div>
    );
  }

  // Impact color
  const impactColor = (impact: string) => {
    switch (impact) {
      case "high": return "bg-rose-500/20 text-rose-400 border-rose-500/30";
      case "medium": return "bg-amber-500/20 text-amber-400 border-amber-500/30";
      case "low": return "bg-muted text-muted-foreground border-border";
      default: return "bg-muted text-muted-foreground border-border";
    }
  };

  return (
    <div className="space-y-2">
      {/* Macro events banner */}
      {macroEvents.length > 0 && (
        <div className="border border-border rounded-sm overflow-hidden">
          <div className="px-3 py-1.5 bg-muted/30 border-b border-border/60 flex items-center gap-1.5">
            <Clock className="w-3 h-3 text-amber-400" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Upcoming Events</span>
          </div>
          <div className="divide-y divide-border/60">
            {macroEvents.map((e, i) => (
              <div key={i} className="px-3 py-2 flex items-center gap-2 text-[11px]">
                <span className={`text-[9px] px-1 py-0.5 rounded-sm font-bold border ${impactColor(e.expectedImpact)}`}>
                  {e.expectedImpact}
                </span>
                <span className="flex-1 font-medium truncate">{e.title}</span>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {new Date(e.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* News articles */}
      {articles.length > 0 && (
        <div className="space-y-1">
          {articles.map((a, i) => (
            <div key={i} className="border border-border rounded-sm overflow-hidden">
              <button
                onClick={() => setExpanded((e) => ({ ...e, [i]: !e[i] }))}
                className="w-full flex items-start gap-2 px-3 py-2 text-left hover:bg-muted/20 transition-colors"
              >
                <span className={`mt-0.5 w-1.5 h-1.5 rounded-full shrink-0 ${
                  a.impact === "high" ? "bg-rose-400" :
                  a.impact === "medium" ? "bg-amber-400" : "bg-muted-foreground"
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-medium truncate">{a.title}</span>
                    <span className={`text-[9px] px-1 py-0.5 rounded-sm font-semibold border shrink-0 ${impactColor(a.impact)}`}>
                      {a.impact}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[9px] text-muted-foreground">{a.source}</span>
                    <span className="text-[9px] text-muted-foreground">
                      {new Date(a.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>
                {expanded[i] ? <ChevronUp className="w-3 h-3 text-muted-foreground shrink-0" /> : <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />}
              </button>
              {expanded[i] && (
                <div className="px-3 pb-2.5 space-y-1.5">
                  {a.summary && (
                    <p className="text-[11px] text-muted-foreground leading-relaxed">{a.summary}</p>
                  )}
                  {a.url && (
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline"
                    >
                      <ExternalLink className="w-2.5 h-2.5" /> Read full article
                    </a>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Similar Setups Panel ────────────────────────────────────────────────

function SimilarSetupsPanel({ symbol, setupType }: { symbol: string; setupType?: string }) {
  const [results, setResults] = useState<any[]>([]);
  const [qdrantStatus, setQdrantStatus] = useState<{ connected: boolean; collections: string[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchSetup, setSearchSetup] = useState(setupType || "");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [status, setups] = await Promise.all([
        getQdrantStatus(),
        findSimilarSetups({ symbol, setupType: searchSetup || undefined, limit: 8 }),
      ]);
      setQdrantStatus(status);
      setResults(setups.results || []);
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, [symbol]);

  async function handleSearch() {
    setLoading(true);
    try {
      const setups = await findSimilarSetups({ symbol, setupType: searchSetup || undefined, limit: 8 });
      setResults(setups.results || []);
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  }

  if (loading && !qdrantStatus) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse border border-border rounded-sm p-3 space-y-2">
            <div className="h-3 w-1/2 bg-muted rounded-sm" />
            <div className="h-2 w-full bg-muted rounded-sm" />
          </div>
        ))}
      </div>
    );
  }

  // Qdrant not connected
  if (qdrantStatus && !qdrantStatus.connected) {
    return (
      <div className="space-y-3">
        <div className="text-center py-6 space-y-2">
          <Database className="w-5 h-5 text-muted-foreground/40 mx-auto" />
          <p className="text-xs text-muted-foreground">Vector memory not available.</p>
          <p className="text-[10px] text-muted-foreground/60">Start Qdrant with: docker compose --profile vector-memory up -d qdrant</p>
        </div>

        {/* Still show empty state for UX */}
        <div className="border border-dashed border-border/50 rounded-sm p-4 text-center">
          <Search className="w-4 h-4 text-muted-foreground/40 mx-auto mb-1" />
          <p className="text-[10px] text-muted-foreground/60">Find similar past trade setups once Qdrant is running.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Setup type filter */}
      <div className="flex gap-2">
        <select
          value={searchSetup}
          onChange={(e) => setSearchSetup(e.target.value)}
          className="flex-1 bg-muted border border-border rounded-sm px-2 py-1.5 text-[11px] text-foreground"
        >
          <option value="">All setup types</option>
          <option value="OB">Order Block</option>
          <option value="FVG">Fair Value Gap</option>
          <option value="MSS">Market Structure Shift</option>
          <option value="CHoCH">Change of Character</option>
          <option value="BOS">Break of Structure</option>
          <option value="LIQUIDITY_SWEEP">Liquidity Sweep</option>
          <option value="SESSION_BREAKOUT">Session Breakout</option>
        </select>
        <button
          onClick={handleSearch}
          disabled={loading}
          className="flex items-center gap-1 bg-primary/10 text-primary border border-primary/30 rounded-sm px-2.5 py-1.5 text-[10px] font-semibold"
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
          Search
        </button>
        <button
          onClick={load}
          disabled={loading}
          className="p-1.5 border border-border rounded-sm hover:bg-muted/30"
        >
          <RefreshCw className={`w-3 h-3 text-muted-foreground ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-1.5">
          {[1, 2].map((i) => (
            <div key={i} className="animate-pulse border border-border rounded-sm p-2.5 space-y-1.5">
              <div className="h-3 w-2/3 bg-muted rounded-sm" />
              <div className="h-2 w-full bg-muted rounded-sm" />
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/30 rounded-sm p-2.5 text-xs text-destructive">
          <AlertCircle className="w-3 h-3 shrink-0" />
          {error}
        </div>
      )}

      {/* Empty results (connected but no data) */}
      {!loading && !error && results.length === 0 && (
        <div className="border border-dashed border-border/50 rounded-sm p-4 text-center space-y-1">
          <Target className="w-4 h-4 text-muted-foreground/40 mx-auto" />
          <p className="text-[10px] text-muted-foreground/60">
            No similar setups found. Run the Agent Loop to generate signals and store them in vector memory.
          </p>
        </div>
      )}

      {/* Results */}
      {!loading && results.length > 0 && (
        <div className="space-y-1 max-h-72 overflow-y-auto">
          {results.map((r, i) => (
            <div key={i} className="border border-border rounded-sm px-3 py-2.5 hover:bg-muted/20 transition-colors">
              <div className="flex items-center gap-2 mb-1">
                {r.direction === "long" ? (
                  <TrendingUp className="w-3 h-3 text-emerald-400" />
                ) : (
                  <TrendingDown className="w-3 h-3 text-destructive" />
                )}
                <span className="text-xs font-semibold">{r.symbol}</span>
                <span className="text-[10px] font-mono text-muted-foreground">{r.setupType}</span>
                <span className={`text-[10px] px-1 py-0.5 rounded-sm font-semibold ${
                  r.win === true ? "bg-emerald-500/20 text-emerald-400" :
                  r.win === false ? "bg-destructive/20 text-destructive" :
                  "bg-muted text-muted-foreground"
                }`}>
                  {r.win === true ? "WIN" : r.win === false ? "LOSS" : "PENDING"}
                </span>
                <span className="text-[10px] text-muted-foreground ml-auto">
                  {(r.similarity * 100).toFixed(0)}% match
                </span>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <span>Conf: {r.confidence}</span>
                {r.pnl != null && (
                  <span className={r.pnl >= 0 ? "text-emerald-400" : "text-destructive"}>
                    P&L: {r.pnl.toFixed(2)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Qdrant connection status */}
      {qdrantStatus && (
        <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground/50 mt-1">
          <div className={`w-1.5 h-1.5 rounded-full ${qdrantStatus.connected ? "bg-emerald-400" : "bg-muted-foreground"}`} />
          Qdrant {qdrantStatus.connected ? "connected" : "disconnected"}
          {qdrantStatus.collections.length > 0 && (
            <> · {qdrantStatus.collections.join(", ")}</>
          )}
        </div>
      )}
    </div>
  );
}

// ── RAG Panel ──────────────────────────────────────────────────────────

function RagPanel({ symbol }: { symbol: string }) {
  const [context, setContext] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  async function loadContext() {
    setLoading(true);
    setError(null);
    try {
      const res = await getNewsContext(symbol);
      setContext(res.context || "No context available.");
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground bg-muted/30 rounded-sm px-3 py-2.5 border border-border">
        <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        <span>The Agent Loop already includes news context in its reasoning step automatically. This panel shows the formatted context that would be injected into the LLM prompt.</span>
      </div>

      <button
        onClick={loadContext}
        disabled={loading}
        className="flex items-center gap-1.5 bg-primary/10 text-primary border border-primary/30 rounded-sm px-3 py-1.5 text-xs font-semibold hover:bg-primary/20 transition-colors"
      >
        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Brain className="w-3 h-3" />}
        {loading ? "Loading..." : "Generate News Context"}
      </button>

      {error && (
        <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/30 rounded-sm p-2.5 text-xs text-destructive">
          <AlertCircle className="w-3 h-3 shrink-0" />
          {error}
        </div>
      )}

      {context && (
        <div className="border border-border rounded-sm overflow-hidden">
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center justify-between px-3 py-2 bg-muted/30 text-[11px] font-semibold"
          >
            <span>Formatted LLM Context ({context.length} chars)</span>
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          {expanded && (
            <pre className="px-3 py-2.5 text-[11px] text-muted-foreground leading-relaxed whitespace-pre-wrap font-mono max-h-64 overflow-y-auto">
              {context}
            </pre>
          )}
        </div>
      )}

      {!context && !loading && !error && (
        <div className="text-center py-4">
          <Brain className="w-5 h-5 text-muted-foreground/40 mx-auto mb-1" />
          <p className="text-[10px] text-muted-foreground/60">Click above to see the news context that feeds into agent reasoning.</p>
        </div>
      )}
    </div>
  );
}
