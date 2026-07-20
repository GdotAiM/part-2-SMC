/**
 * useSessionCockpitData — wires live market data into the Zustand store.
 *
 * Mirrors what OsDashboard did with useAnalyzeCrypto/useAnalyzeForex/
 * useRealtimeStream/useCascadeStrategy, but feeds results into
 * the narrative-driven market store instead of rendering directly.
 */

import { useEffect, useMemo, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useAnalyzeCrypto,
  useAnalyzeForex,
  getAnalyzeCryptoQueryKey,
  getAnalyzeForexQueryKey,
} from "@workspace/api-client-react";
import { useRealtimeStream } from "@/lib/realtime";
import { useCascadeStrategy } from "@/hooks/useCascadeStrategy";
import { useMarketStore } from "@/state/market-store";
import { useProfileStore } from "@/state/profile-store";
import type { SmcReport } from "@workspace/api-client-react";
import type { Market } from "@/lib/smc-display";

const ALL_TFS = ["1m", "5m", "15m", "1h", "4h", "1d", "1w"] as const;
type Tf = (typeof ALL_TFS)[number];

function useTfQuery(market: Market, symbol: string, tf: Tf, enabled: boolean) {
  const params = { symbol, timeframe: tf };
  const crypto = useAnalyzeCrypto(params, {
    query: {
      enabled: market === "crypto" && !!symbol && enabled,
      queryKey: getAnalyzeCryptoQueryKey(params),
      staleTime: 60_000,
    },
  });
  const forex = useAnalyzeForex(params, {
    query: {
      enabled: market === "forex" && !!symbol && enabled,
      queryKey: getAnalyzeForexQueryKey(params),
      staleTime: 60_000,
    },
  });
  return market === "crypto" ? crypto : forex;
}

export function useSessionCockpitData() {
  const queryClient = useQueryClient();

  // ── Read from stores ──
  const symbol = useMarketStore((s) => s.symbol);
  const marketType = useMarketStore((s) => s.marketType);
  const timeframes = useMarketStore((s) => s.timeframes);
  const setReports = useMarketStore((s) => s.setReports);
  const setLiveData = useMarketStore((s) => s.setLiveData);
  const setStreamConnected = useMarketStore((s) => s.setStreamConnected);
  const pushTimelineEvent = useMarketStore((s) => s.pushTimelineEvent);
  const setStrategies = useMarketStore((s) => s.setStrategies);
  const recomputeStage = useMarketStore((s) => s.recomputeStage);
  const profile = useProfileStore((s) => s.profile);

  // ── Get active TFs ──
  const activeTfs = useMemo(() => {
    // Use profile's preferred TFs, or default to intraday (15m, 1h, 4h)
    if (profile.preferredTimeframes.length > 0) {
      return profile.preferredTimeframes;
    }
    return ["15m", "1h", "4h"];
  }, [profile.preferredTimeframes]);

  const market = marketType as Market;

  // ── Query EVERY active timeframe ──
  const r15m = useTfQuery(market, symbol, "15m", activeTfs.includes("15m"));
  const r1h  = useTfQuery(market, symbol, "1h",  activeTfs.includes("1h"));
  const r4h  = useTfQuery(market, symbol, "4h",  activeTfs.includes("4h"));
  const r1d  = useTfQuery(market, symbol, "1d",  activeTfs.includes("1d"));
  const r5m  = useTfQuery(market, symbol, "5m",  activeTfs.includes("5m"));
  const r1m  = useTfQuery(market, symbol, "1m",  activeTfs.includes("1m"));
  const r1w  = useTfQuery(market, symbol, "1w",  activeTfs.includes("1w"));

  // ― Pool all report data into a single object ──
  const allReports = useMemo<Record<string, SmcReport | null>>(() => {
    const r: Record<string, SmcReport | null> = {};
    for (const [tf, query] of Object.entries({ "1m": r1m, "5m": r5m, "15m": r15m, "1h": r1h, "4h": r4h, "1d": r1d, "1w": r1w })) {
      if (query.data && activeTfs.includes(tf)) {
        r[tf] = query.data;
      }
    }
    return r;
  }, [r1m.data, r5m.data, r15m.data, r1h.data, r4h.data, r1d.data, r1w.data, activeTfs]);

  // ── Push reports into the store whenever they change ──
  useEffect(() => {
    if (Object.keys(allReports).length > 0) {
      setReports(allReports);
    }
  }, [allReports, setReports]);

  // ── Strategy detection via cascade ──
  const cascade = useCascadeStrategy(symbol, market, activeTfs, true);

  useEffect(() => {
    if (cascade.primary || cascade.alternatives.length > 0) {
      setStrategies(cascade.primary, cascade.alternatives, cascade.narrative, cascade.reasoning);

      // Push strategy event to timeline
      if (cascade.primary) {
        pushTimelineEvent({
          type: "signal_generated",
          title: `Strategy detected: ${cascade.primary.strategyName}`,
          description: `Score: ${Math.round((cascade.primary.score ?? 0) * 100)}% · ${cascade.alternatives.length} alternatives`,
          symbol,
          actionable: true,
          actionLabel: "View in Funnel",
        });
      }
    }
  }, [cascade.primary?.strategyId, cascade.alternatives.length]);

  // ── Recompute narrative stage when profile changes ──
  useEffect(() => {
    recomputeStage(profile);
  }, [profile.models.filter(m => m.enabled).map(m => m.id).join(",")]);

  // ── Real-time SSE stream ──
  const onCandleClosed = useCallback(
    (_sym: string, tf: string) => {
      if (!activeTfs.includes(tf)) return;
      const qk = market === "crypto"
        ? getAnalyzeCryptoQueryKey({ symbol, timeframe: tf })
        : getAnalyzeForexQueryKey({ symbol, timeframe: tf });
      queryClient.invalidateQueries({ queryKey: qk });
    },
    [market, symbol, activeTfs, queryClient],
  );

  const onReportUpdate = useCallback(
    (tf: string, report: SmcReport) => {
      setReports({ [tf]: report });
      pushTimelineEvent({
        type: "system",
        title: `${tf.toUpperCase()} report updated`,
        description: `New SMC analysis for ${symbol}`,
        symbol,
        timeframe: tf,
        actionable: false,
      });
    },
    [symbol],
  );

  const { liveData, connected } = useRealtimeStream({
    symbol,
    timeframes: activeTfs,
    onCandleClosed,
    onReportUpdate,
  });

  useEffect(() => { setLiveData(liveData); }, [liveData]);
  useEffect(() => { setStreamConnected(connected); }, [connected]);

  // ── Push initial session event ──
  useEffect(() => {
    if (symbol) {
      pushTimelineEvent({
        type: "session_open",
        title: `Watching ${symbol}`,
        description: `Real-time analysis active on ${activeTfs.length} timeframe(s)`,
        symbol,
        actionable: false,
      });
    }
  }, [symbol]);
}
