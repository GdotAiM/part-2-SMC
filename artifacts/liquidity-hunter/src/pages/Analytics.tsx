import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft,
  Zap,
  Target,
  Loader2,
  TrendingUp,
  TrendingDown,
  Shield,
  Flag,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { TradeLedgerDashboard } from "@/components/TradeLedgerDashboard";
import { PerformanceMatrixHeatmap } from "@/components/PerformanceMatrixHeatmap";
import { SignalDetailSheet, type SignalDetail } from "@/components/SignalDetailSheet";
import { apiUrl } from "@/lib/api";
import { fmtAssetPrice, formatTimestamp } from "@/lib/format";

// ─── Types ───

interface SymbolInfo {
  symbol: string;
  label: string;
  market: "crypto" | "forex";
  correlatedSymbol?: string;
}

interface GeneratedSignal {
  symbol: string;
  setup_type: string;
  setup_subtype: string;
  entry_price: number;
  stop_loss: number;
  take_profit: number;
  risk_reward_ratio: number;
  confidence_score: number;
  asset_class: string;
  direction?: "long" | "short";
  analysis_context?: Record<string, unknown>;
}

// ─── Generate Signal Tab ───

function GenerateSignalTab() {
  const [symbols, setSymbols] = useState<SymbolInfo[]>([]);
  const [market, setMarket] = useState<"crypto" | "forex">("crypto");
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [timeframe, setTimeframe] = useState("1h");
  const [loading, setLoading] = useState(false);
  const [signal, setSignal] = useState<GeneratedSignal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [noSignal, setNoSignal] = useState(false);

  useEffect(() => {
    fetch(apiUrl("/symbols"))
      .then((r) => r.json())
      .then((data) => {
        const list = market === "crypto" ? data.crypto ?? [] : data.forex ?? [];
        setSymbols(list);
        if (list.length > 0 && !list.find((s: SymbolInfo) => s.symbol === symbol)) {
          setSymbol(list[0].symbol);
        }
      })
      .catch(() => {});
  }, [market]);

  const doGenerate = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSignal(null);
    setNoSignal(false);
    try {
      const res = await fetch(apiUrl("/signals/generate"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, market, timeframe }),
      });
      const data = await res.json();
      if (data.signals && data.signals.length > 0) {
        const s = data.signals[0];
        const direction = s.take_profit > s.entry_price ? "long" : "short";
        setSignal({ ...s, direction });
      } else {
        setNoSignal(true);
      }
    } catch (err: any) {
      setError(err.message || "Failed to generate signal");
    } finally {
      setLoading(false);
    }
  }, [symbol, market, timeframe]);

  const timeframes = ["1m", "5m", "15m", "1h", "4h", "1d", "1w"];
  const isLong = signal?.direction === "long";
  const borderColor = signal ? (isLong ? "border-[hsl(var(--bullish))]/30" : "border-destructive/30") : "";
  const bgColor = signal ? (isLong ? "bg-[hsl(var(--bullish))]/5" : "bg-destructive/5") : "";
  const dirColor = signal ? (isLong ? "text-[hsl(var(--bullish))]" : "text-destructive") : "";
  const confBarColor =
    signal
      ? signal.confidence_score > 65
        ? "bg-[hsl(var(--bullish))]"
        : signal.confidence_score > 40
          ? "bg-primary"
          : "bg-destructive"
      : "";

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Controls */}
      <Card>
        <CardHeader className="px-3 sm:px-6">
          <CardTitle className="text-xs sm:text-sm font-bold uppercase tracking-wider">
            Generate Trade Signal
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 sm:px-6">
          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-end gap-2 sm:gap-3">
            {/* Market toggle */}
            <div className="flex rounded-sm overflow-hidden border border-border w-fit">
              {(["crypto", "forex"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMarket(m)}
                  className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors ${
                    market === m
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-2 sm:gap-3">
              <Select value={symbol} onValueChange={setSymbol}>
                <SelectTrigger className="w-full sm:w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {symbols.map((s) => (
                    <SelectItem key={s.symbol} value={s.symbol}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={timeframe} onValueChange={setTimeframe}>
                <SelectTrigger className="w-full sm:w-[90px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {timeframes.map((tf) => (
                    <SelectItem key={tf} value={tf}>
                      {tf}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                onClick={doGenerate}
                disabled={loading}
                size="sm"
                className="flex items-center gap-1.5"
              >
                {loading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Target className="w-3.5 h-3.5" />
                )}
                {loading ? "Analyzing..." : "Generate"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Loading */}
      {loading && (
        <Card>
          <CardContent className="pt-6 space-y-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </CardContent>
        </Card>
      )}

      {/* Error */}
      {error && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* No signal */}
      {noSignal && (
        <Card className="border-border bg-muted/30">
          <CardContent className="pt-6 text-center">
            <p className="text-xs sm:text-sm text-muted-foreground">
              No valid trade setup detected for {symbol} on {timeframe}.
            </p>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
              Try a different timeframe or asset — the SMC engine requires
              clear structure, OB/FVG confluence, and liquidity targets.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Signal result — same design as SignalDetailSheet */}
      {signal && (
        <Card className={`${borderColor} ${bgColor}`}>
          <CardHeader className="px-3 sm:px-6">
            <CardTitle className="flex items-center gap-2 text-xs sm:text-sm font-bold uppercase tracking-wider">
              {isLong ? (
                <TrendingUp className="w-4 h-4 text-[hsl(var(--bullish))]" />
              ) : (
                <TrendingDown className="w-4 h-4 text-destructive" />
              )}
              <span className={dirColor}>
                {signal.direction?.toUpperCase()} — {signal.setup_type}
              </span>
              <Badge variant="secondary" className="font-mono text-[10px]">
                {signal.setup_subtype}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            {/* Price grid */}
            <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-3">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Entry</p>
                <p className="text-sm sm:text-lg font-bold font-mono tabular-nums">
                  {fmtAssetPrice(signal.entry_price, signal.asset_class)}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  <Shield className="w-3 h-3 inline mr-0.5" />Stop Loss
                </p>
                <p className="text-sm sm:text-lg font-bold font-mono tabular-nums text-destructive">
                  {fmtAssetPrice(signal.stop_loss, signal.asset_class)}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  <Flag className="w-3 h-3 inline mr-0.5" />Target
                </p>
                <p className="text-sm sm:text-lg font-bold font-mono tabular-nums text-[hsl(var(--bullish))]">
                  {fmtAssetPrice(signal.take_profit, signal.asset_class)}
                </p>
              </div>
            </div>

            {/* R:R + Confidence */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
              <div>
                <span className="text-[10px] text-muted-foreground uppercase">R:R</span>
                <span className="ml-1.5 text-sm font-bold">
                  {signal.risk_reward_ratio.toFixed(1)}:1
                </span>
              </div>
              <div className="flex-1 w-full">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[10px] text-muted-foreground uppercase">Confidence</span>
                  <span className="text-[10px] font-bold">{signal.confidence_score}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${confBarColor}`}
                    style={{ width: `${signal.confidence_score}%` }}
                  />
                </div>
              </div>
            </div>

            <p className="mt-3 text-[10px] text-muted-foreground">
              Generated {formatTimestamp(new Date().toISOString())} · Symbol: {signal.symbol} · Logged to ledger
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Analytics Page ───

export default function Analytics() {
  const [, setLocation] = useLocation();
  const [selectedSignal, setSelectedSignal] = useState<SignalDetail | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const handleSelectSignal = useCallback((raw: any) => {
    setSelectedSignal(raw as SignalDetail);
    setSheetOpen(true);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground font-mono">
      {/* Header */}
      <header className="border-b border-border bg-card/60 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-screen-xl mx-auto px-3 sm:px-4 py-2.5 flex items-center gap-2.5">
          <button
            onClick={() => setLocation("/")}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-sm border border-border bg-muted text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors text-xs font-bold"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">BACK</span>
          </button>
          <Zap className="w-4 h-4 text-primary" />
          <span className="font-bold text-sm text-primary tracking-tight">
            ANALYTICS
          </span>
        </div>
      </header>

      {/* Tabs */}
      <main className="max-w-screen-xl mx-auto px-3 sm:px-4 py-4 sm:py-5">
        <Tabs defaultValue="ledger" className="space-y-4 sm:space-y-5">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="ledger" className="text-[10px] sm:text-xs flex-1 sm:flex-none">
              Ledger
            </TabsTrigger>
            <TabsTrigger value="matrix" className="text-[10px] sm:text-xs flex-1 sm:flex-none">
              Matrix
            </TabsTrigger>
            <TabsTrigger value="generate" className="text-[10px] sm:text-xs flex-1 sm:flex-none">
              Generate
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ledger">
            <TradeLedgerDashboard onSelectSignal={handleSelectSignal} />
          </TabsContent>

          <TabsContent value="matrix">
            <PerformanceMatrixHeatmap />
          </TabsContent>

          <TabsContent value="generate">
            <GenerateSignalTab />
          </TabsContent>
        </Tabs>
      </main>

      {/* Signal Detail Sheet */}
      <SignalDetailSheet
        signal={selectedSignal}
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
      />
    </div>
  );
}
