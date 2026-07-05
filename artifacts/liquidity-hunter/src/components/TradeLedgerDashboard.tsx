import { useState, useEffect, useCallback } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtAssetPrice, formatTimestamp } from "@/lib/format";

// ─── Types ───

interface TradeRecord {
  id: string;
  symbol: string;
  asset_class: string;
  setup_type: string;
  setup_subtype: string;
  confidence_score: number;
  entry_price: string;
  stop_loss: string;
  take_profit: string;
  execution_mode: string;
  outcome: {
    win: boolean;
    pnl: number;
    pnl_percent?: number;
    exit_reason: string;
    bars_to_exit?: number;
    actual_entry_price?: number;
    actual_exit_price?: number;
    closed_at?: string;
  } | null;
  created_at: string;
  signal_timestamp?: string;
  closed_at?: string | null;
  risk_reward_ratio: string;
  analysis_context?: Record<string, unknown>;
  rationale?: Record<string, unknown>;
  structure_confluence?: number;
  liquidity_quality?: number;
  confluence_count?: number;
}

interface Metrics {
  win_rate: number;
  sharpe_ratio: number;
  profit_factor: number;
}

interface SetupRanking {
  setup_type: string;
  symbol: string;
  sharpe_ratio: string;
  win_rate: string;
  profit_factor: string;
  trials: number;
}

// ─── Props ───

interface Props {
  onSelectSignal?: (signal: TradeRecord) => void;
}

// ─── Metric Card ───

function MetricCard({
  title,
  value,
  suffix,
  color,
}: {
  title: string;
  value: string;
  suffix?: string;
  color?: "green" | "red" | "yellow";
}) {
  const colorMap = {
    green: "text-[hsl(var(--bullish))]",
    red: "text-destructive",
    yellow: "text-yellow-500",
  };

  return (
    <Card>
      <CardHeader className="pb-2 px-3 sm:px-6">
        <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 sm:px-6 pb-4">
        <div className={`text-lg sm:text-2xl font-bold ${color ? colorMap[color] : ""}`}>
          {value}
          {suffix && <span className="text-xs sm:text-sm ml-1">{suffix}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Setup Ranking Chart ───

function SetupRankingBars({ data }: { data: SetupRanking[] }) {
  const maxSharpe = Math.max(...data.map((d) => parseFloat(d.sharpe_ratio)), 0.1);

  return (
    <div className="space-y-2">
      {data.map((item, i) => (
        <div key={i} className="flex items-center gap-2 sm:gap-3">
          <span className="text-[10px] sm:text-xs font-mono text-muted-foreground w-16 sm:w-20 shrink-0">
            {item.setup_type}
          </span>
          <div className="flex-1 h-5 bg-muted rounded-sm overflow-hidden relative">
            <div
              className="h-full bg-primary/60 rounded-sm transition-all"
              style={{
                width: `${Math.min(100, (parseFloat(item.sharpe_ratio) / maxSharpe) * 100)}%`,
              }}
            />
            <span className="absolute inset-0 flex items-center px-2 text-[10px] font-mono">
              Sharpe: {parseFloat(item.sharpe_ratio).toFixed(2)}
            </span>
          </div>
          <span className="text-[10px] sm:text-xs text-muted-foreground w-14 sm:w-16 text-right">
            {item.trials} trades
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ───

export function TradeLedgerDashboard({ onSelectSignal }: Props) {
  const [signals, setSignals] = useState<TradeRecord[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [rankings, setRankings] = useState<Record<string, SetupRanking[]>>({});
  const [assetFilter, setAssetFilter] = useState("ALL");
  const [setupFilter, setSetupFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);

  const fetchLedger = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (assetFilter !== "ALL") params.append("asset", assetFilter);
      if (setupFilter !== "ALL") params.append("setup", setupFilter);
      params.append("limit", "200");

      const res = await fetch(`/api/ledger?${params}`);
      const data = await res.json();
      setSignals(data.signals || []);
      setMetrics(data.metrics || null);
    } catch (err) {
      console.error("Failed to fetch ledger:", err);
    } finally {
      setLoading(false);
    }
  }, [assetFilter, setupFilter]);

  const fetchRankings = useCallback(async () => {
    try {
      const assets = ["STOCK", "FOREX", "CRYPTO"];
      const results: Record<string, SetupRanking[]> = {};
      for (const asset of assets) {
        const res = await fetch(`/api/performance-matrix?asset=${asset}`);
        const data = await res.json();
        results[asset] = data;
      }
      setRankings(results);
    } catch (err) {
      console.error("Failed to fetch rankings:", err);
    }
  }, []);

  useEffect(() => {
    fetchLedger();
    fetchRankings();
  }, [fetchLedger, fetchRankings]);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Filters — stack on mobile, row on desktop */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
        <Select value={assetFilter} onValueChange={setAssetFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Filter by Asset" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Assets</SelectItem>
            <SelectItem value="STOCK">Stocks</SelectItem>
            <SelectItem value="FOREX">Forex</SelectItem>
            <SelectItem value="CRYPTO">Crypto</SelectItem>
          </SelectContent>
        </Select>

        <Select value={setupFilter} onValueChange={setSetupFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Filter by Setup" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Setups</SelectItem>
            <SelectItem value="FVG">FVG</SelectItem>
            <SelectItem value="OB">Order Blocks</SelectItem>
            <SelectItem value="CHoCH">CHoCH</SelectItem>
            <SelectItem value="BOS">BOS</SelectItem>
            <SelectItem value="LIQUIDITY_SWEEP">Liquidity Sweep</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Metrics Row */}
      {metrics ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          <MetricCard
            title="Win Rate"
            value={`${(metrics.win_rate * 100).toFixed(1)}`}
            suffix="%"
            color={metrics.win_rate > 0.55 ? "green" : "red"}
          />
          <MetricCard
            title="Sharpe"
            value={metrics.sharpe_ratio.toFixed(2)}
            color={
              metrics.sharpe_ratio > 1.0
                ? "green"
                : metrics.sharpe_ratio > 0
                  ? "yellow"
                  : "red"
            }
          />
          <MetricCard
            title="Profit Factor"
            value={metrics.profit_factor.toFixed(2)}
            color={metrics.profit_factor > 1.5 ? "green" : "yellow"}
          />
          <MetricCard
            title="Trades"
            value={signals.length.toString()}
          />
        </div>
      ) : loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="pt-4 sm:pt-6 px-3">
                <Skeleton className="h-3 sm:h-4 w-16 sm:w-20 mb-2" />
                <Skeleton className="h-6 sm:h-8 w-12 sm:w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {/* Signal Ledger Table */}
      <Card>
        <CardHeader className="px-3 sm:px-6">
          <CardTitle className="text-sm sm:text-base">Signal Ledger</CardTitle>
        </CardHeader>
        <CardContent className="px-0 sm:px-6">
          {loading ? (
            <div className="space-y-2 px-3 sm:px-0">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[10px] sm:text-xs">Symbol</TableHead>
                    <TableHead className="text-[10px] sm:text-xs">Setup</TableHead>
                    <TableHead className="text-[10px] sm:text-xs hidden sm:table-cell">Conf</TableHead>
                    <TableHead className="text-[10px] sm:text-xs">Entry</TableHead>
                    <TableHead className="text-[10px] sm:text-xs hidden md:table-cell">R:R</TableHead>
                    <TableHead className="text-[10px] sm:text-xs">Outcome</TableHead>
                    <TableHead className="text-[10px] sm:text-xs hidden sm:table-cell">Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {signals.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="text-center text-muted-foreground py-8 text-xs sm:text-sm"
                      >
                        No signals yet. Run a backtest or generate signals to see data here.
                      </TableCell>
                    </TableRow>
                  ) : (
                    signals.map((signal) => (
                      <TableRow
                        key={signal.id}
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => onSelectSignal?.(signal)}
                      >
                        {/* Symbol */}
                        <TableCell>
                          <span className="font-mono font-medium text-xs sm:text-sm">
                            {signal.symbol}
                          </span>
                        </TableCell>

                        {/* Setup */}
                        <TableCell>
                          <Badge variant="secondary" className="font-mono text-[10px] sm:text-xs">
                            {signal.setup_type}
                          </Badge>
                        </TableCell>

                        {/* Confidence — hidden on mobile */}
                        <TableCell className="hidden sm:table-cell">
                          <Badge
                            variant={signal.confidence_score > 70 ? "default" : signal.confidence_score > 50 ? "secondary" : "outline"}
                            className="text-[10px]"
                          >
                            {signal.confidence_score}%
                          </Badge>
                        </TableCell>

                        {/* Entry */}
                        <TableCell>
                          <span className="font-mono text-[10px] sm:text-xs tabular-nums">
                            {fmtAssetPrice(signal.entry_price, signal.asset_class)}
                          </span>
                        </TableCell>

                        {/* R:R — hidden on small */}
                        <TableCell className="hidden md:table-cell">
                          <span className="font-mono text-[10px] sm:text-xs">
                            {parseFloat(signal.risk_reward_ratio || "0").toFixed(1)}:1
                          </span>
                        </TableCell>

                        {/* Outcome */}
                        <TableCell>
                          {!signal.outcome ? (
                            <Badge variant="outline" className="text-[10px]">PENDING</Badge>
                          ) : (
                            <Badge
                              variant={signal.outcome.win ? "default" : "destructive"}
                              className={`text-[10px] ${signal.outcome.win ? "bg-[hsl(var(--bullish))]" : ""}`}
                            >
                              {signal.outcome.win ? "WIN" : "LOSS"}
                            </Badge>
                          )}
                        </TableCell>

                        {/* Time */}
                        <TableCell className="hidden sm:table-cell">
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                            {formatTimestamp(signal.signal_timestamp ?? signal.created_at)}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Setup Performance Ranking by Asset */}
      <Card>
        <CardHeader className="px-3 sm:px-6">
          <CardTitle className="text-sm sm:text-base">Setup Performance by Asset</CardTitle>
        </CardHeader>
        <CardContent className="px-3 sm:px-6">
          <Tabs defaultValue="CRYPTO">
            <TabsList className="w-full sm:w-auto">
              <TabsTrigger value="STOCK" className="text-[10px] sm:text-xs flex-1 sm:flex-none">Stocks</TabsTrigger>
              <TabsTrigger value="FOREX" className="text-[10px] sm:text-xs flex-1 sm:flex-none">Forex</TabsTrigger>
              <TabsTrigger value="CRYPTO" className="text-[10px] sm:text-xs flex-1 sm:flex-none">Crypto</TabsTrigger>
            </TabsList>
            {(["STOCK", "FOREX", "CRYPTO"] as const).map((asset) => (
              <TabsContent key={asset} value={asset} className="pt-4">
                {rankings[asset]?.length > 0 ? (
                  <SetupRankingBars data={rankings[asset]} />
                ) : (
                  <p className="text-xs sm:text-sm text-muted-foreground text-center py-8">
                    No performance data yet for {asset.toLowerCase()} setups.
                  </p>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
