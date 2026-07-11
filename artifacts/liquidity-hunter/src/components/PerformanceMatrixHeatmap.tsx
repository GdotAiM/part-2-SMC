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
import { Target, Play } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { BacktestRunnerUI } from "./BacktestRunnerUI";

interface MatrixRow {
  id: string;
  asset_class: string;
  symbol: string;
  setup_type: string;
  setup_subtype: string;
  timeframe_cascade: string;
  market_regime: string;
  session_context: string;
  win_rate: string;
  sharpe_ratio: string;
  profit_factor: string;
  trials: number;
  is_significant: boolean;
}

function sharpeColor(sharpe: number): string {
  if (sharpe >= 1.5) return "text-[hsl(var(--bullish))]";
  if (sharpe >= 1.0) return "text-green-400";
  if (sharpe >= 0.5) return "text-yellow-500";
  if (sharpe > 0) return "text-orange-400";
  return "text-destructive";
}

function winRateColor(rate: number): string {
  if (rate >= 0.6) return "text-[hsl(var(--bullish))]";
  if (rate >= 0.5) return "text-yellow-500";
  return "text-destructive";
}

export function PerformanceMatrixHeatmap() {
  const [showBacktest, setShowBacktest] = useState(false);
  const [asset, setAsset] = useState("STOCK");
  const [matrix, setMatrix] = useState<MatrixRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/performance-matrix?asset=${asset}&detailed=true`)
      .then((r) => r.json())
      .then((data) => setMatrix(data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [asset]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Multi-Dimensional Performance Matrix</CardTitle>
        <Select value={asset} onValueChange={setAsset}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="STOCK">Stocks</SelectItem>
            <SelectItem value="FOREX">Forex</SelectItem>
            <SelectItem value="CRYPTO">Crypto</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : matrix.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No performance matrix data yet. Run a backtest with at least 5
            trades per combination to populate this view.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Setup</TableHead>
                  <TableHead>Symbol</TableHead>
                  <TableHead>TF Cascade</TableHead>
                  <TableHead>Regime</TableHead>
                  <TableHead>Session</TableHead>
                  <TableHead className="text-right">Sharpe</TableHead>
                  <TableHead className="text-right">Win %</TableHead>
                  <TableHead className="text-right">PF</TableHead>
                  <TableHead className="text-right">Trials</TableHead>
                  <TableHead>Sig.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {matrix.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <Badge variant="secondary" className="font-mono text-xs">
                        {row.setup_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {row.symbol}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {row.timeframe_cascade}
                    </TableCell>
                    <TableCell className="text-xs">{row.market_regime}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {row.session_context}
                    </TableCell>
                    <TableCell
                      className={`text-right font-mono text-sm ${sharpeColor(parseFloat(row.sharpe_ratio))}`}
                    >
                      {parseFloat(row.sharpe_ratio).toFixed(2)}
                    </TableCell>
                    <TableCell
                      className={`text-right font-mono text-sm ${winRateColor(parseFloat(row.win_rate))}`}
                    >
                      {(parseFloat(row.win_rate) * 100).toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {parseFloat(row.profit_factor).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {row.trials}
                    </TableCell>
                    <TableCell>
                      {row.is_significant ? (
                        <Badge
                          variant="default"
                          className="bg-[hsl(var(--bullish))] text-xs"
                        >
                          ✓
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          N={row.trials}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
