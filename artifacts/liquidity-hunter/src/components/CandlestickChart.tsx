import {
  useEffect,
  useRef,
  useCallback,
  useImperativeHandle,
  forwardRef,
} from "react";
import {
  createChart,
  CandlestickSeries,
  ColorType,
  CrosshairMode,
} from "lightweight-charts";
import type {
  IChartApi,
  ISeriesApi,
  Time,
  LogicalRange,
} from "lightweight-charts";
import { cn } from "@/lib/utils";
import { Loader2, AlertTriangle, BarChart3 } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CandleData {
  time: number; // Unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface SessionZone {
  /** Label shown at top of the zone band, e.g. "Asian", "London" */
  label: string;
  /** Background fill colour (rgba recommended) */
  fillColor: string;
  /** Label text colour */
  labelColor: string;
  /** Array of [startTime, endTime] pairs in Unix seconds */
  segments: Array<{ start: number; end: number }>;
}

/** Overlay drawing callback — called on every redraw (scroll, zoom, resize). */
export type OverlayDrawFn = (ctx: {
  canvas: HTMLCanvasElement;
  chart: IChartApi;
  series: ISeriesApi<"Candlestick">;
  candleData: readonly CandleData[];
  width: number;
  height: number;
  dpr: number;
  /** Convert a time to an x pixel coordinate (null if off-screen). */
  timeToX: (time: number) => number | null;
  /** Convert a price to a y pixel coordinate (null if off-screen). */
  priceToY: (price: number) => number | null;
}) => void;

export interface CandlestickChartProps {
  /** OHLCV candle data, sorted by time ascending. */
  data: CandleData[];
  /** Ticker label shown in the header. */
  symbol: string;
  /** Current timeframe, e.g. "1m", "5m", "1h", "4h". */
  timeframe: string;
  /**
   * Session killzones / backgrounds rendered as coloured semi-transparent
   * vertical bands with labels at the top.
   */
  sessionZones?: SessionZone[];
  /**
   * Custom overlay drawing function.
   * Called on every redraw so overlays stay pinned during zoom/scroll.
   */
  overlayDraw?: OverlayDrawFn;
  /** Fires when the visible time range changes (zoom or scroll). */
  onRangeChange?: (range: { from: number; to: number } | null) => void;
  /** Fires on crosshair move — returns the candle under the cursor. */
  onCrosshairMove?: (candle: CandleData | null) => void;
  /** Current loading state. */
  loading?: boolean;
  /** Error message to display when data failed to load. */
  error?: string | null;
  /** Called to retry loading on error. */
  onRetry?: () => void;
  /** Additional class for the root container. */
  className?: string;
  /** Chart height; defaults to 100% via flex. */
  height?: number;
  /** Up / bull candle colour. */
  upColor?: string;
  /** Down / bear candle colour. */
  downColor?: string;
  /** Background colour of the chart area. */
  backgroundColor?: string;
  /** Show a header bar with symbol + timeframe. */
  showHeader?: boolean;
}

// ─── Session killzone config (UTC hours) ─────────────────────────────────────

const DEFAULT_SESSION_ZONES: SessionZone[] = [
  {
    label: "Asian",
    fillColor: "rgba(100,160,255,0.04)",
    labelColor: "rgba(140,190,255,0.75)",
    segments: [],
  },
  {
    label: "London",
    fillColor: "rgba(255,165,80,0.04)",
    labelColor: "rgba(255,185,110,0.75)",
    segments: [],
  },
  {
    label: "New York AM",
    fillColor: "rgba(100,220,160,0.04)",
    labelColor: "rgba(120,220,160,0.75)",
    segments: [],
  },
  {
    label: "New York PM",
    fillColor: "rgba(200,100,220,0.03)",
    labelColor: "rgba(210,130,225,0.75)",
    segments: [],
  },
];

/**
 * Map a UTC hour to a session name.
 *  0-5   Asian
 *  6-11  London
 * 12-16  New York AM
 * 17-19  New York PM
 */
function getSessionName(unixSec: number): string | null {
  const h = new Date(unixSec * 1000).getUTCHours();
  if (h >= 0 && h < 6) return "Asian";
  if (h >= 6 && h < 12) return "London";
  if (h >= 12 && h < 17) return "New York AM";
  if (h >= 17 && h < 20) return "New York PM";
  return null;
}

/** Build contiguous session segments from candle timestamps. */
export function buildSessionSegments(
  candles: readonly { time: number }[],
): SessionZone[] {
  const map = new Map<string, Array<{ start: number; end: number }>>();
  let cur: { name: string; start: number; end: number } | null = null;

  for (const c of candles) {
    const name = getSessionName(c.time);
    if (!name) {
      cur = null;
      continue;
    }
    if (cur && cur.name === name) {
      cur.end = c.time;
    } else {
      cur = { name, start: c.time, end: c.time };
      const list = map.get(name) ?? [];
      list.push({ start: cur.start, end: cur.end });
      map.set(name, list);
    }
  }

  return DEFAULT_SESSION_ZONES.map((template) => ({
    ...template,
    segments: map.get(template.label) ?? [],
  }));
}

// ─── Drawing helpers ─────────────────────────────────────────────────────────

/** Draw session-zone semi-transparent bands + labels across the full chart. */
function drawSessionZones(
  ctx: CanvasRenderingContext2D,
  zones: SessionZone[],
  timeToX: (t: number) => number | null,
  width: number,
  height: number,
) {
  let lastLabel: string | null = null;

  for (const zone of zones) {
    for (const seg of zone.segments) {
      const x1 = timeToX(seg.start);
      const x2 = timeToX(seg.end);
      if (x1 === null || x2 === null) continue;

      const rx1 = Math.max(0, x1);
      const rx2 = Math.min(width, x2 + 24);
      if (rx2 <= rx1) continue;

      // Fill the vertical band
      ctx.fillStyle = zone.fillColor;
      ctx.fillRect(rx1, 0, rx2 - rx1, height);

      // Label only the first segment per zone
      if (zone.label !== lastLabel) {
        ctx.fillStyle = zone.labelColor;
        ctx.font = "10px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
        ctx.fillText(zone.label, rx1 + 4, 14);
        lastLabel = zone.label;
      }
    }
  }
}

// ─── Ref API ─────────────────────────────────────────────────────────────────

export interface CandlestickChartHandle {
  /** Get the underlying lightweight-charts IChartApi instance. */
  getChart: () => IChartApi | null;
  /** Get the candlestick series. */
  getSeries: () => ISeriesApi<"Candlestick"> | null;
  /** Fit all data into view. */
  fitContent: () => void;
  /** Force a redraw of the overlay canvas. */
  redraw: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export const CandlestickChart = forwardRef<
  CandlestickChartHandle,
  CandlestickChartProps
>(function CandlestickChart(
  {
    data,
    symbol,
    timeframe,
    sessionZones,
    overlayDraw,
    onRangeChange,
    onCrosshairMove,
    loading = false,
    error = null,
    onRetry,
    className,
    height,
    upColor = "#26a69a",
    downColor = "#ef5350",
    backgroundColor = "#0d0d0d",
    showHeader = true,
  },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const dataRef = useRef<readonly CandleData[]>(data);
  const overlayDrawRef = useRef(overlayDraw);
  const sessionZonesRef = useRef(sessionZones);
  const onRangeChangeRef = useRef(onRangeChange);
  const onCrosshairMoveRef = useRef(onCrosshairMove);

  dataRef.current = data;
  overlayDrawRef.current = overlayDraw;
  sessionZonesRef.current = sessionZones;
  onRangeChangeRef.current = onRangeChange;
  onCrosshairMoveRef.current = onCrosshairMove;

  // ── Refs for external access ──────────────────────────────────────────────
  const chartApiRef = useRef<IChartApi | null>(null);
  const seriesApiRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  // ── Redraw overlay canvas ─────────────────────────────────────────────────
  const redrawOverlay = useCallback(() => {
    const canvas = canvasRef.current;
    const chart = chartApiRef.current;
    const series = seriesApiRef.current;
    if (!canvas || !chart || !series) return;

    const dpr = window.devicePixelRatio || 1;
    const W = canvas.width / dpr;
    const H = canvas.height / dpr;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(dpr, dpr);

    const ts = chart.timeScale();
    const timeToX = (t: number): number | null =>
      ts.timeToCoordinate(t as never);
    const priceToY = (p: number): number | null =>
      series.priceToCoordinate(p);

    // Draw session zones
    const zones =
      sessionZonesRef.current ??
      buildSessionSegments(dataRef.current);
    drawSessionZones(ctx, zones, timeToX, W, H);

    // Call custom overlay draw
    overlayDrawRef.current?.({
      canvas,
      chart,
      series,
      candleData: dataRef.current,
      width: W,
      height: H,
      dpr,
      timeToX,
      priceToY,
    });

    ctx.restore();
  }, []);

  // ── Main chart creation effect ────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !container.isConnected) return;
    // Don't create chart if loading or errored
    if (!data.length && !loading && !error) return;

    const dpr = window.devicePixelRatio || 1;
    const W = container.clientWidth;
    const H = height ?? container.clientHeight;

    // Size canvas
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
    }

    // Create chart
    const chart = createChart(container, {
      width: W,
      height: H,
      layout: {
        background: { type: ColorType.Solid, color: backgroundColor },
        textColor: "#888888",
        fontSize: 10,
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'JetBrains Mono', monospace",
      },
      grid: {
        vertLines: { color: "#191919" },
        horzLines: { color: "#191919" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: "#555555",
          labelBackgroundColor: "#1f1f1f",
          style: 0,
        },
        horzLine: {
          color: "#555555",
          labelBackgroundColor: "#1f1f1f",
          style: 0,
        },
      },
      rightPriceScale: {
        borderColor: "#2a2a2a",
        textColor: "#777777",
        autoScale: true,
      },
      timeScale: {
        borderColor: "#2a2a2a",
        timeVisible: true,
        secondsVisible: false,
      } as never,
      handleScroll: { vertTouchDrag: false },
      handleScale: {
        axisPressedMouseMove: true,
        pinch: true,
        mouseWheel: true,
      },
    });

    chartRef.current = chart;
    chartApiRef.current = chart;

    // Candlestick series
    const series = chart.addSeries(CandlestickSeries, {
      upColor,
      downColor,
      borderVisible: false,
      wickUpColor: upColor,
      wickDownColor: downColor,
    });
    seriesRef.current = series;
    seriesApiRef.current = series;

    // Set data
    if (data.length > 0) {
      const sorted = [...data].sort((a, b) => a.time - b.time);
      series.setData(
        sorted.map((c) => ({
          time: c.time as Time,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        })),
      );
    }

    // Subscribe to visible range changes
    const rangeHandler = (range: LogicalRange | null) => {
      onRangeChangeRef.current?.(
        range
          ? {
              from: (range.from as number) ?? 0,
              to: (range.to as number) ?? 0,
            }
          : null,
      );
      // Redraw overlay on range change via RAF to debounce
      requestAnimationFrame(redrawOverlay);
    };
    chart.timeScale().subscribeVisibleLogicalRangeChange(rangeHandler);

    // Subscribe to crosshair moves
    const crosshairHandler = (param: {
      time?: Time;
      point?: { x: number; y: number };
      seriesData?: Map<unknown, unknown>;
    }) => {
      if (!param.time || !param.point) {
        onCrosshairMoveRef.current?.(null);
        return;
      }
      // Find matching candle
      const candle = dataRef.current.find((c) => c.time === (param.time as number));
      onCrosshairMoveRef.current?.(candle ?? null);
    };
    chart.subscribeCrosshairMove(crosshairHandler);

    // Initial overlay draw
    setTimeout(redrawOverlay, 80);

    // ResizeObserver
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: w, height: h } = entry.contentRect;
        if (w === 0 || h === 0) continue;
        try {
          chart.resize(w, h);
        } catch {
          /* chart removed */
        }
        if (canvasRef.current) {
          canvasRef.current.width = w * dpr;
          canvasRef.current.height = h * dpr;
          canvasRef.current.style.width = `${w}px`;
          canvasRef.current.style.height = `${h}px`;
        }
        redrawOverlay();
      }
    });
    ro.observe(container);

    return () => {
      ro.disconnect();
      chart
        .timeScale()
        .unsubscribeVisibleLogicalRangeChange(rangeHandler);
      chart.unsubscribeCrosshairMove(crosshairHandler);
      try {
        chart.remove();
      } catch {
        /* already detached */
      }
      chartRef.current = null;
      chartApiRef.current = null;
      seriesRef.current = null;
      seriesApiRef.current = null;
    };
    // Only recreate when data identity changes (switching symbol/TF)
    // or when error clears
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data === dataRef.current ? null : data, error, backgroundColor, upColor, downColor]);

  // ── Update data in-place (live updates) ────────────────────────────────────
  useEffect(() => {
    const series = seriesApiRef.current;
    if (!series || data.length === 0) return;

    try {
      const sorted = [...data].sort((a, b) => a.time - b.time);
      series.setData(
        sorted.map((c) => ({
          time: c.time as Time,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        })),
      );
      requestAnimationFrame(redrawOverlay);
    } catch {
      /* chart may have been torn down */
    }
  }, [data, redrawOverlay]);

  // ── Imperative handle ─────────────────────────────────────────────────────
  useImperativeHandle(
    ref,
    () => ({
      getChart: () => chartRef.current,
      getSeries: () => seriesRef.current as ISeriesApi<"Candlestick"> | null,
      fitContent: () => {
        chartRef.current?.timeScale().fitContent();
      },
      redraw: redrawOverlay,
    }),
    [redrawOverlay],
  );

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div
        className={cn(
          "relative flex flex-col rounded-sm border border-border bg-card overflow-hidden",
          className,
        )}
        style={{ height: height ?? 480 }}
      >
        {showHeader && (
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-card/80 shrink-0">
            <span className="text-xs font-bold text-foreground">{symbol}</span>
            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-sm font-bold uppercase">
              {timeframe}
            </span>
          </div>
        )}
        <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-[#0d0d0d]">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
          <span className="text-sm text-muted-foreground">
            Loading {timeframe} data for {symbol}…
          </span>
        </div>
      </div>
    );
  }

  // ── Error state ───────────────────────────────────────────────────────────
  if (error) {
    return (
      <div
        className={cn(
          "relative flex flex-col rounded-sm border border-destructive/30 bg-card overflow-hidden",
          className,
        )}
        style={{ height: height ?? 480 }}
      >
        {showHeader && (
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-card/80 shrink-0">
            <span className="text-xs font-bold text-foreground">{symbol}</span>
            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-sm font-bold uppercase">
              {timeframe}
            </span>
          </div>
        )}
        <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-[#0d0d0d] px-6">
          <AlertTriangle className="w-8 h-8 text-amber-500" />
          <p className="text-sm text-muted-foreground text-center max-w-sm leading-relaxed">
            {error}
          </p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="flex items-center gap-2 px-4 py-2 rounded-sm border border-[#2a2a2a] bg-[#181818] text-[#888] hover:text-primary hover:border-primary/50 transition-colors text-xs font-bold uppercase tracking-wider"
            >
              <Loader2 className="w-3.5 h-3.5" />
              Retry
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Empty state ───────────────────────────────────────────────────────────
  if (!data.length) {
    return (
      <div
        className={cn(
          "relative flex flex-col rounded-sm border border-border bg-card overflow-hidden",
          className,
        )}
        style={{ height: height ?? 480 }}
      >
        {showHeader && (
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-card/80 shrink-0">
            <span className="text-xs font-bold text-foreground">{symbol}</span>
            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-sm font-bold uppercase">
              {timeframe}
            </span>
          </div>
        )}
        <div className="flex-1 flex flex-col items-center justify-center gap-2 bg-[#0d0d0d]">
          <BarChart3 className="w-8 h-8 text-muted-foreground/40" />
          <span className="text-sm text-muted-foreground">
            No data available for {symbol} on {timeframe}
          </span>
        </div>
      </div>
    );
  }

  // ── Normal state ──────────────────────────────────────────────────────────
  return (
    <div
      className={cn(
        "relative flex flex-col rounded-sm border border-[#2a2a2a] overflow-hidden bg-[#0d0d0d]",
        className,
      )}
      style={{ height: height ?? 480 }}
    >
      {/* Header */}
      {showHeader && (
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[#1f1f1f] bg-[#111]/95 shrink-0">
          <span className="text-xs font-bold text-foreground tracking-tight">
            {symbol}
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-[#1a1a1a] text-[#888] border border-[#2a2a2a] font-bold uppercase tracking-wider">
            {timeframe}
          </span>
          <span className="text-[10px] text-[#555] ml-auto">
            {data.length.toLocaleString()} candles
          </span>
        </div>
      )}

      {/* Chart body */}
      <div className="flex-1 relative min-h-0">
        <div ref={containerRef} className="absolute inset-0" />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 pointer-events-none"
        />
      </div>
    </div>
  );
});

export default CandlestickChart;
