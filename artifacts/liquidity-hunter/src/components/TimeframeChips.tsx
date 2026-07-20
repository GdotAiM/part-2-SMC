/**
 * TimeframeChips — clickable timeframe filter buttons.
 *
 * Drop into any stage view header. When a TF is selected, the view
 * should filter its data to only that TF. "All" resets the filter.
 */

import { useMemo } from "react";
import { useMarketStore } from "@/state/market-store";
import { TF_LABEL_MAP } from "@/lib/smc-display";
import type { SmcReport } from "@workspace/api-client-react";

export function TimeframeChips() {
  const reports = useMarketStore((s) => s.reports);
  const selectedTf = useMarketStore((s) => s.selectedTf);
  const setSelectedTf = useMarketStore((s) => s.setSelectedTf);

  const availableTfs = useMemo(() => {
    return Object.entries(reports)
      .filter(([, r]) => r !== null)
      .sort(([a], [b]) =>
        ({ "1w":7,"1d":6,"4h":5,"1h":4,"15m":3,"5m":2,"1m":1 }[b] ?? 0) -
        ({ "1w":7,"1d":6,"4h":5,"1h":4,"15m":3,"5m":2,"1m":1 }[a] ?? 0),
      )
      .map(([tf]) => tf);
  }, [reports]);

  if (availableTfs.length <= 1) return null;

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => setSelectedTf(null)}
        className={`px-1.5 py-0.5 rounded-sm text-[9px] font-bold transition-colors ${
          selectedTf === null
            ? "bg-primary text-primary-foreground"
            : "bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted"
        }`}
      >
        All
      </button>
      {availableTfs.map((tf) => {
        const report = reports[tf];
        const bias = report?.structure?.bias;
        const dot = bias === "bullish" ? "🟢" : bias === "bearish" ? "🔴" : "⚪";
        return (
          <button
            key={tf}
            onClick={() => setSelectedTf(tf === selectedTf ? null : tf)}
            title={`${TF_LABEL_MAP[tf] ?? tf} — ${bias ?? "no data"} · ${report ? Math.round((report.structure.confidence + report.dailyBias.strength) / 2 * 100) + "%" : ""}`}
            className={`px-1.5 py-0.5 rounded-sm text-[9px] font-bold font-mono transition-colors flex items-center gap-1 ${
              selectedTf === tf
                ? "bg-primary text-primary-foreground"
                : "bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <span className="text-[7px]">{dot}</span>
            {TF_LABEL_MAP[tf] ?? tf}
          </button>
        );
      })}
    </div>
  );
}
