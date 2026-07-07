import { useEffect, useRef, useCallback } from "react";
import { X, Loader2 } from "lucide-react";
import { toTradingViewSymbol } from "@/lib/alpaca-url";

type Props = {
  symbol: string;
  onClose: () => void;
};

/**
 * Full-screen TradingView Advanced Chart widget.
 * Dynamically loads the TradingView charting library, renders the chart
 * in dark theme with drawing tools and 100+ indicators, and cleans up
 * the widget + iframe on unmount.
 */
export function TradingViewChart({ symbol, onClose }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<any>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  const tvSymbol = toTradingViewSymbol(symbol);
  const label = tvSymbol ?? symbol;

  const createWidget = useCallback((el: HTMLDivElement) => {
    // Read actual pixel dimensions of the container — the widget
    // requires pixel values; "100%" / "100%" silently collapses to 0px
    const { width, height } = el.getBoundingClientRect();
    if (width === 0 || height === 0) return;

    try {
      widgetRef.current = new (window as any).TradingView.widget({
        container: el,
        symbol: tvSymbol,
        interval: "60",
        theme: "dark",
        style: "1", // candlesticks
        locale: "en",
        toolbar_bg: "#111111",
        enable_publishing: false,
        hide_side_toolbar: false,
        allow_symbol_change: true,
        save_image: true,
        width,
        height,
        studies: [
          "RSI@tv-basicstudies",
          "MASimple@tv-basicstudies",
          "MASimple@tv-basicstudies",
        ],
        loading_screen: { backgroundColor: "#0d0d0d", foregroundColor: "#888" },
        overrides: {
          "paneProperties.background": "#0d0d0d",
          "paneProperties.backgroundType": "solid",
          "paneProperties.vertGridProperties.color": "#1a1a1a",
          "paneProperties.horzGridProperties.color": "#1a1a1a",
          "mainSeriesProperties.candleStyle.upColor": "#26A69A",
          "mainSeriesProperties.candleStyle.downColor": "#EF5350",
          "mainSeriesProperties.candleStyle.wickUpColor": "#26A69A",
          "mainSeriesProperties.candleStyle.wickDownColor": "#EF5350",
          "mainSeriesProperties.candleStyle.borderUpColor": "#26A69A",
          "mainSeriesProperties.candleStyle.borderDownColor": "#EF5350",
          "scalesProperties.textColor": "#888888",
          "scalesProperties.lineColor": "#1f1f1f",
        },
        disabled_features: [
          "header_symbol_search",
          "header_compare",
          "display_market_status",
        ],
        enabled_features: [
          "side_toolbar_in_fullscreen_mode",
          "study_templates",
        ],
      });
    } catch (err) {
      console.error("TradingView widget init failed:", err);
    }
  }, [tvSymbol]);

  useEffect(() => {
    if (!containerRef.current || !tvSymbol) return;

    const el = containerRef.current;

    // Clean up any previous widget
    if (widgetRef.current) {
      try { widgetRef.current.remove(); } catch {}
      widgetRef.current = null;
    }

    // TradingView widget script must be loaded before we can use it
    const existing = document.getElementById("tv-widget-script") as HTMLScriptElement | null;
    const initWidget = () => createWidget(el);

    if ((window as any).TradingView) {
      initWidget();
    } else if (!existing) {
      const script = document.createElement("script");
      script.id = "tv-widget-script";
      script.src = "https://s3.tradingview.com/tv.js";
      script.async = true;
      script.onload = initWidget;
      script.onerror = () => console.error("Failed to load TradingView charting library");
      document.head.appendChild(script);
    } else if (existing.onload) {
      // Script is still loading — wait for it
      const prev = existing.onload;
      existing.onload = (e) => {
        (prev as any)(e);
        initWidget();
      };
    } else {
      // Script already loaded
      initWidget();
    }

    // Keep the chart sized to the container on window resize / layout changes
    resizeObserverRef.current = new ResizeObserver(() => {
      if (!widgetRef.current || !containerRef.current) return;
      const { width, height } = containerRef.current.getBoundingClientRect();
      if (width > 0 && height > 0) {
        try { widgetRef.current.resize(width, height); } catch {}
      }
    });
    resizeObserverRef.current.observe(el);

    return () => {
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      if (widgetRef.current) {
        try { widgetRef.current.remove(); } catch {}
        widgetRef.current = null;
      }
    };
  }, [tvSymbol, createWidget]);

  return (
    <div className="fixed inset-0 z-[60] bg-[#0d0d0d] flex flex-col">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[#1f1f1f] bg-[#111]/95 shrink-0">
        <div className="flex items-center gap-2.5">
          <span className="text-sm font-bold text-foreground tracking-tight">
            {label}
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-sm border border-blue-500/30 bg-blue-500/10 text-blue-400 font-bold uppercase tracking-wider">
            TradingView
          </span>
          <span className="text-[10px] text-muted-foreground hidden sm:inline">
            Indicators · Drawing tools · Multi-TF
          </span>
        </div>

        <button
          onClick={onClose}
          className="ml-auto p-1.5 hover:bg-[#1f1f1f] rounded-sm transition-colors"
          title="Close TradingView chart"
        >
          <X className="w-4 h-4 text-[#555]" />
        </button>
      </div>

      {/* ── Chart container ── */}
      <div className="flex-1 relative">
        {tvSymbol ? (
          <div ref={containerRef} className="absolute inset-0" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
            This symbol is not supported by TradingView.
          </div>
        )}
      </div>
    </div>
  );
}
