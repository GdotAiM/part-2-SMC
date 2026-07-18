/**
 * SMC Pulse OS — Main Dashboard
 *
 * OS shell wrapping all views: Overview, Market, Analyze, Trade,
 * Learn, Evaluate, Agent. Existing pages (Analytics, Broker,
 * AgentLoop) remain accessible via their routes.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import type { SmcReport } from "@workspace/api-client-react";
import {
  getAnalyzeCryptoQueryKey,
  getAnalyzeForexQueryKey,
  useAnalyzeCrypto,
  useAnalyzeForex,
  useListSymbols,
} from "@workspace/api-client-react";
import { useRealtimeStream } from "@/lib/realtime";
import { refreshEconomicCalendar } from "@/lib/api";
import { AppShell, type OsView } from "@/components/layout/AppShell";
import { Overview } from "@/pages/Overview";
import { MarketView } from "@/pages/MarketView";
import { StrategyAtlas } from "@/pages/StrategyAtlas";
import { TradeView } from "@/pages/TradeView";
import { LearnView } from "@/pages/LearnView";
import { SmcEvalLab } from "@/pages/SmcEvalLab";
import { AgentWorkspace } from "@/pages/AgentWorkspace";
import { ConfluenceCard } from "@/components/ConfluenceCard";
import { ConfluenceSheet } from "@/components/ConfluenceSheet";
import { IntelligenceSheet } from "@/components/IntelligenceSheet";
import { ChartView } from "@/components/ChartView";
import { MarketBriefing } from "@/components/MarketBriefing";
import { useCascadeStrategy } from "@/hooks/useCascadeStrategy";
import { fmtPrice, getBias, getConfidence, TF_LABEL_MAP, TF_WEIGHT, type Market } from "@/lib/smc-display";

const ALL_TFS = ["1m", "5m", "15m", "1h", "4h", "1d", "1w"] as const;
type Tf = (typeof ALL_TFS)[number];

const TRADING_STYLES: Array<{ label: string; desc: string; timeframes: Tf[] }> = [
  { label: "Scalp",    desc: "1m · 5m · 15m",  timeframes: ["1m",  "5m",  "15m"] },
  { label: "Intraday", desc: "15m · 1h · 4h",  timeframes: ["15m", "1h",  "4h"]  },
  { label: "Swing",    desc: "4h · 1D · 1W",   timeframes: ["4h",  "1d",  "1w"]  },
  { label: "All",      desc: "Full TF stack",  timeframes: ["1m", "5m", "15m", "1h", "4h", "1d", "1w"] },
];

function getRoles(tfs: Tf[]): Record<Tf, string> {
  const sorted = [...tfs].sort((a, b) => TF_WEIGHT[b] - TF_WEIGHT[a]);
  const roles: Partial<Record<Tf, string>> = {};
  sorted.forEach((tf, i) => {
    if (i === 0) roles[tf] = "BIAS SETTER";
    else if (i === sorted.length - 1) roles[tf] = "ENTRY TRIGGER";
    else roles[tf] = "CONFIRMATION";
  });
  return roles as Record<Tf, string>;
}

function useTfData(market: Market, symbol: string, tf: Tf, corrSym: string | undefined, enabled: boolean) {
  const params = { symbol, timeframe: tf, correlatedSymbol: corrSym };
  const crypto = useAnalyzeCrypto(params, { query: { enabled: market === "crypto" && !!symbol && enabled, queryKey: getAnalyzeCryptoQueryKey(params), staleTime: 60_000 } });
  const forex = useAnalyzeForex(params, { query: { enabled: market === "forex" && !!symbol && enabled, queryKey: getAnalyzeForexQueryKey(params), staleTime: 60_000 } });
  return market === "crypto" ? crypto : forex;
}

const OS_VIEWS: OsView[] = ["overview", "market", "analyze", "trade", "learn", "evaluate", "agent"];

export default function OsDashboard() {
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [view, setView] = useState<OsView>(() => {
    // Derive initial view from URL path for deep-link support
    const path = location.replace(/^\//, "");
    return (OS_VIEWS as readonly string[]).includes(path) ? (path as OsView) : "overview";
  });

  // Sync view from URL when location changes (browser back/forward)
  useEffect(() => {
    const path = location.replace(/^\//, "");
    if ((OS_VIEWS as readonly string[]).includes(path) && path !== view) {
      setView(path as OsView);
    }
  }, [location]);

  // When the user changes view via sidebar or command palette, update the URL
  function handleViewChange(newView: OsView) {
    setView(newView);
    const path = newView === "overview" ? "/" : `/${newView}`;
    setLocation(path);
  }
  const [market, setMarket] = useState<Market>("crypto");
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [corrSym, setCorrSym] = useState("ETHUSDT");
  const [smtOn, setSmtOn] = useState(true);
  const [styleIdx, setStyleIdx] = useState(1);
  const [sheet, setSheet] = useState<{ tf: Tf; report: SmcReport } | null>(null);
  const [confluenceSheetOpen, setConfluenceSheetOpen] = useState(false);
  const [chartOpen, setChartOpen] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [refreshing, setRefreshing] = useState(false);
  const [calLoading, setCalLoading] = useState(false);
  const [calResult, setCalResult] = useState<{ ok: boolean; detail: string } | null>(null);

  const { data: symbols } = useListSymbols();
  const activeStyle = TRADING_STYLES[styleIdx];
  const corrParam = smtOn ? corrSym : undefined;
  const symbolOptions = useMemo(() => (market === "crypto" ? symbols?.crypto ?? [] : symbols?.forex ?? []), [market, symbols]);
  const corrOptions = useMemo(() => symbolOptions.filter(s => s.symbol !== symbol), [symbolOptions, symbol]);

  function handleMarketSwitch(m: Market) {
    setMarket(m); setSheet(null);
    if (m === "crypto") { setSymbol("BTCUSDT"); setCorrSym("ETHUSDT"); }
    else { setSymbol("EURUSD=X"); setCorrSym("GBPUSD=X"); }
  }

  // TF data hooks
  const r1m  = useTfData(market, symbol, "1m",  corrParam, activeStyle.timeframes.includes("1m"));
  const r5m  = useTfData(market, symbol, "5m",  corrParam, activeStyle.timeframes.includes("5m"));
  const r15m = useTfData(market, symbol, "15m", corrParam, activeStyle.timeframes.includes("15m"));
  const r1h  = useTfData(market, symbol, "1h",  corrParam, activeStyle.timeframes.includes("1h"));
  const r4h  = useTfData(market, symbol, "4h",  corrParam, activeStyle.timeframes.includes("4h"));
  const r1d  = useTfData(market, symbol, "1d",  corrParam, activeStyle.timeframes.includes("1d"));
  const r1w  = useTfData(market, symbol, "1w",  corrParam, activeStyle.timeframes.includes("1w"));

  const tfMap: Record<Tf, typeof r1h> = { "1m": r1m, "5m": r5m, "15m": r15m, "1h": r1h, "4h": r4h, "1d": r1d, "1w": r1w };

  const cascade = useMemo(() => {
    const roles = getRoles(activeStyle.timeframes);
    const sortedByWeight = [...activeStyle.timeframes].sort((a, b) => TF_WEIGHT[b] - TF_WEIGHT[a]);
    const anchorTf = sortedByWeight.find(tf => tfMap[tf].data) ?? sortedByWeight[0];
    const anchorReport = tfMap[anchorTf].data;
    const anchorBias = anchorReport ? getBias(anchorReport) : "neutral";
    return { roles, anchorTf, anchorBias };
  // eslint-disable-next-line
  }, [r1m.data, r5m.data, r15m.data, r1h.data, r4h.data, r1d.data, r1w.data, activeStyle]);

  const confluenceReports = useMemo(() =>
    activeStyle.timeframes.map(tf => ({ tf, report: tfMap[tf].data })).filter((x): x is { tf: Tf; report: SmcReport } => !!x.report),
  // eslint-disable-next-line
  [r1m.data, r5m.data, r15m.data, r1h.data, r4h.data, r1d.data, r1w.data, activeStyle]);

  const primaryReport = r4h.data ?? r1h.data ?? r1d.data ?? r15m.data;

  // Strategy detection
  const cascadeStrategy = useCascadeStrategy(symbol, market, activeStyle.timeframes, true);
  const strategyProps = useMemo(() => {
    if (!cascadeStrategy.primary) return { primary: null as null, alternatives: [] };
    return {
      primary: { id: cascadeStrategy.primary.strategyId, name: cascadeStrategy.primary.strategyName, score: cascadeStrategy.primary.score },
      alternatives: cascadeStrategy.alternatives.map(a => ({ id: a.strategyId, name: a.strategyName, score: a.score })),
    };
  }, [cascadeStrategy.primary, cascadeStrategy.alternatives]);

  const doRefresh = useCallback(async () => {
    setRefreshing(true); setCountdown(60);
    await queryClient.refetchQueries({ type: "active" });
    setRefreshing(false);
  }, [queryClient]);

  const doCalendarRefresh = useCallback(async () => {
    setCalLoading(true); setCalResult(null);
    try {
      const r = await refreshEconomicCalendar();
      setCalResult({ ok: !r.error, detail: r.error ?? `${r.upserted} upserted, ${r.structured} structured in ${r.durationMs}ms` });
    } catch (err: any) { setCalResult({ ok: false, detail: err.message ?? "Unknown error" }); }
    setCalLoading(false);
    setTimeout(() => setCalResult(null), 8000);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setCountdown(prev => { if (prev <= 1) { doRefresh(); return 60; } return prev - 1; });
    }, 1000);
    return () => clearInterval(id);
  }, [doRefresh]);

  const { liveData, connected: wsConnected, candles: liveCandles } = useRealtimeStream({
    symbol, timeframes: activeStyle.timeframes,
    onCandleClosed: useCallback((_sym: string, tf: string) => {
      const qk = market === "crypto"
        ? getAnalyzeCryptoQueryKey({ symbol, timeframe: tf, correlatedSymbol: corrParam })
        : getAnalyzeForexQueryKey({ symbol, timeframe: tf, correlatedSymbol: corrParam });
      queryClient.invalidateQueries({ queryKey: qk });
    }, [market, symbol, corrParam, queryClient]),
    onReportUpdate: useCallback((tf: string, report: SmcReport) => {
      const qk = market === "crypto"
        ? getAnalyzeCryptoQueryKey({ symbol, timeframe: tf, correlatedSymbol: corrParam })
        : getAnalyzeForexQueryKey({ symbol, timeframe: tf, correlatedSymbol: corrParam });
      queryClient.setQueryData(qk, report);
    }, [market, symbol, corrParam, queryClient]),
  });

  const tfIsLoading = activeStyle.timeframes.some(tf => tfMap[tf as Tf].isLoading);
  const livePrice = liveData[activeStyle.timeframes[activeStyle.timeframes.length - 1]]?.currentPrice;
  const effectivePrice = livePrice ?? primaryReport?.currentPrice;

  const matchedStrategies = cascadeStrategy.primary
    ? [{
        id: cascadeStrategy.primary.strategyId,
        name: cascadeStrategy.primary.strategyName,
        score: cascadeStrategy.primary.score,
      }, ...cascadeStrategy.alternatives.map(a => ({
        id: a.strategyId,
        name: a.strategyName,
        score: a.score,
      }))]
    : [];

  // Render the current view
  function renderView() {
    switch (view) {
      case "overview":
        return (
          <Overview
            reports={confluenceReports}
            symbol={symbol}
            market={market}
            matchedStrategies={matchedStrategies}
            cascade={cascade}
            onViewChange={handleViewChange}
            onSelectTf={(tf) => {
              const r = tfMap[tf as Tf].data;
              if (r) setSheet({ tf: tf as Tf, report: r });
            }}
            onOpenConfluence={() => setConfluenceSheetOpen(true)}
            strategyProps={strategyProps}
          />
        );

      case "market":
        return (
          <MarketView
            symbol={symbol}
            market={market}
            onSymbolChange={setSymbol}
            onMarketChange={handleMarketSwitch}
            report={primaryReport}
            isLoading={tfIsLoading}
          />
        );

      case "analyze":
        return <StrategyAtlas />;

      case "trade":
        return <TradeView symbol={symbol} market={market} />;

      case "learn":
        return <LearnView />;

      case "evaluate":
        return <SmcEvalLab />;

      case "agent":
        return (
          <AgentWorkspace
            report={primaryReport}
            symbol={symbol}
            timeframe={cascade.anchorTf}
            market={market}
          />
        );
    }
  }

  return (
    <AppShell
      currentView={view}
      onViewChange={handleViewChange}
      symbol={symbol}
      market={market}
    >
      {renderView()}

      {/* Overlays (shared across all views) */}
      {confluenceSheetOpen && confluenceReports.length > 0 && (
        <ConfluenceSheet
          reports={confluenceReports}
          cascade={cascade}
          market={market}
          onClose={() => setConfluenceSheetOpen(false)}
        />
      )}

      {sheet && (
        <IntelligenceSheet
          report={sheet.report}
          market={market}
          anchorTf={cascade.anchorTf}
          anchorBias={cascade.anchorBias}
          role={cascade.roles[sheet.tf]}
          narrative={cascadeStrategy.narrative}
          reasoning={cascadeStrategy.reasoning}
          onClose={() => setSheet(null)}
        />
      )}

      {chartOpen && confluenceReports.length > 0 && (
        <ChartView
          reports={confluenceReports}
          market={market}
          initialTf={cascade.anchorTf}
          onClose={() => setChartOpen(false)}
          liveCandles={liveCandles as Record<string, any[]>}
        />
      )}
    </AppShell>
  );
}
