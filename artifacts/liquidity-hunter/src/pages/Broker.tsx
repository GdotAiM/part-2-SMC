import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Landmark, Radio, RefreshCw, AlertTriangle } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtAssetPrice, formatTimestamp } from "@/lib/format";

// ─── Types ────────────────────────────────────────────────────────────────────

interface BrokerStatus {
  broker_name: string;
  is_ready: boolean;
  mode: "REVIEW" | "LIVE";
  is_paper: boolean;
}

interface AccountData {
  balance: {
    total_value: number;
    cash: number;
    positions_value: number;
    buying_power: number;
    updated_at?: string;
  };
  open_orders: BrokerOrder[];
}

interface BrokerOrder {
  id: string;
  symbol: string;
  side: "BUY" | "SELL";
  qty: number;
  price: number;
  status: "PENDING" | "FILLED" | "CANCELLED" | "REJECTED";
  created_at: string;
}

interface LedgerEntry {
  id: string;
  symbol: string;
  setup_type: string;
  execution_mode: string;
  confidence_score: number;
  outcome: { win: boolean; pnl: number; exit_reason: string } | null;
  created_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDollar(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function orderStatusColor(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "FILLED": return "default";
    case "PENDING": return "secondary";
    case "REJECTED": return "destructive";
    case "CANCELLED": return "outline";
    default: return "secondary";
  }
}

function orderStatusClass(status: string): string {
  switch (status) {
    case "FILLED": return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
    case "PENDING": return "bg-amber-500/15 text-amber-400 border-amber-500/30";
    case "REJECTED": return "bg-destructive/15 text-destructive border-destructive/30";
    case "CANCELLED": return "bg-muted text-muted-foreground border-border";
    default: return "";
  }
}

// ─── Broker Page ──────────────────────────────────────────────────────────────

export default function Broker() {
  const [, setLocation] = useLocation();

  // ── State ─────────────────────────────────────────────────────────────────
  const [status, setStatus] = useState<BrokerStatus | null>(null);
  const [account, setAccount] = useState<AccountData | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [switchingToLive, setSwitchingToLive] = useState(false);
  const [liveConfirm, setLiveConfirm] = useState("");
  const [liveDialogOpen, setLiveDialogOpen] = useState(false);
  const [switchDisabled, setSwitchDisabled] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Polling — 15s interval matching dashboard pattern ─────────────────────
  const fetchData = useCallback(async () => {
    try {
      const [statusRes, accountRes, ledgerRes] = await Promise.all([
        fetch("/api/broker/status"),
        fetch("/api/account"),
        fetch("/api/ledger?limit=30"),
      ]);

      if (statusRes.ok) setStatus(await statusRes.json());
      if (accountRes.ok) setAccount(await accountRes.json());
      if (ledgerRes.ok) {
        const data = await ledgerRes.json();
        setLedger(data.signals || []);
      }
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 15000);
    return () => clearInterval(id);
  }, [fetchData]);

  // ── Mode switch handlers ─────────────────────────────────────────────────
  const handleModeToggle = async (checked: boolean) => {
    const targetMode = checked ? "LIVE" : "REVIEW";

    if (targetMode === "LIVE") {
      setLiveConfirm("");
      setLiveDialogOpen(true);
      return;
    }

    // REVIEW — immediate (kill switch)
    await switchMode("REVIEW");
  };

  const switchMode = async (mode: "REVIEW" | "LIVE", confirm?: string) => {
    setSwitchDisabled(true);
    setError(null);
    try {
      const body: Record<string, string> = { mode };
      if (confirm) body.confirm = confirm;

      const res = await fetch("/api/broker/mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      // Read body as text first to debug empty-response issues
      const text = await res.text();
      let data: { mode?: string; error?: string };
      try {
        data = JSON.parse(text);
      } catch {
        setError(`Broker mode switch returned invalid response (HTTP ${res.status}): "${text.slice(0, 100)}"`);
        return;
      }

      if (!res.ok || data.error) {
        setError(data.error || `Failed to switch mode (HTTP ${res.status})`);
        return;
      }

      // Refresh status immediately
      const statusRes = await fetch("/api/broker/status");
      if (statusRes.ok) setStatus(await statusRes.json());
    } catch (err: any) {
      setError(err.message || "Network error switching broker mode");
    } finally {
      setSwitchDisabled(false);
    }
  };

  const confirmLiveSwitch = async () => {
    setLiveDialogOpen(false);
    await switchMode("LIVE", liveConfirm);
  };

  // ── Loading skeleton ─────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground font-mono">
        <header className="border-b border-border bg-card/60 backdrop-blur-sm sticky top-0 z-40">
          <div className="max-w-screen-xl mx-auto px-4 py-2.5 flex items-center gap-3">
            <button onClick={() => setLocation("/")}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-sm border border-border bg-muted text-muted-foreground hover:text-primary transition-colors text-xs font-bold">
              <ArrowLeft className="w-3.5 h-3.5" /> BACK
            </button>
            <Landmark className="w-4 h-4 text-primary" />
            <span className="font-bold text-sm text-primary tracking-tight">BROKER</span>
          </div>
        </header>
        <main className="max-w-screen-xl mx-auto px-4 py-5 space-y-4">
          {[1, 2, 3].map(i => (
            <Card key={i}><CardContent className="pt-6"><Skeleton className="h-24 w-full" /></CardContent></Card>
          ))}
        </main>
      </div>
    );
  }

  // ── Not-connected empty state ────────────────────────────────────────────
  if (status && !status.is_ready) {
    return (
      <div className="min-h-screen bg-background text-foreground font-mono">
        <header className="border-b border-border bg-card/60 backdrop-blur-sm sticky top-0 z-40">
          <div className="max-w-screen-xl mx-auto px-4 py-2.5 flex items-center gap-3">
            <button onClick={() => setLocation("/")}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-sm border border-border bg-muted text-muted-foreground hover:text-primary transition-colors text-xs font-bold">
              <ArrowLeft className="w-3.5 h-3.5" /> BACK
            </button>
            <Landmark className="w-4 h-4 text-primary" />
            <span className="font-bold text-sm text-primary tracking-tight">BROKER</span>
          </div>
        </header>
        <main className="max-w-screen-xl mx-auto px-4 py-10 flex items-center justify-center">
          <Card className="max-w-lg w-full border-destructive/20 bg-destructive/5">
            <CardContent className="pt-8 pb-8 text-center space-y-4">
              <AlertTriangle className="w-10 h-10 text-destructive mx-auto" />
              <div>
                <h2 className="text-lg font-bold text-destructive">Broker Not Connected</h2>
                <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
                  The server does not have broker credentials configured.
                  Set <code className="bg-muted px-1 rounded text-xs">ALPACA_API_KEY_ID</code> and{" "}
                  <code className="bg-muted px-1 rounded text-xs">ALPACA_API_SECRET_KEY</code>{" "}
                  in the server's <code className="bg-muted px-1 rounded text-xs">.env</code> file,
                  then restart the server.
                </p>
              </div>
              <button onClick={() => setLocation("/")}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-sm border border-border bg-muted text-muted-foreground hover:text-primary transition-colors text-xs font-bold mt-2">
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
              </button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  // ── Main page ────────────────────────────────────────────────────────────
  const liveMode = status?.mode === "LIVE";
  const ledgerEntries = ledger.filter(e =>
    e.execution_mode === "REVIEW" || e.execution_mode === "LIVE"
  );

  return (
    <div className="min-h-screen bg-background text-foreground font-mono">
      {/* Header */}
      <header className="border-b border-border bg-card/60 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-screen-xl mx-auto px-4 py-2.5 flex items-center gap-3">
          <button onClick={() => setLocation("/")}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-sm border border-border bg-muted text-muted-foreground hover:text-primary transition-colors text-xs font-bold">
            <ArrowLeft className="w-3.5 h-3.5" /> BACK
          </button>
          <Landmark className="w-4 h-4 text-primary" />
          <span className="font-bold text-sm text-primary tracking-tight">BROKER</span>

          {error && (
            <span className="text-[10px] text-destructive ml-2 truncate max-w-[300px]">{error}</span>
          )}

          <div className="ml-auto flex items-center gap-3">
            <button onClick={fetchData}
              className="relative flex items-center justify-center w-8 h-8 rounded-full border border-border hover:border-primary/60 transition-colors">
              <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto px-4 py-5 space-y-4">
        {/* ── Connection + Mode card (most prominent) ──────────────────────── */}
        <Card className={liveMode ? "border-destructive/30" : "border-border"}>
          <CardContent className="pt-5 pb-5">
            <div className="flex flex-wrap items-center gap-4">
              {/* Broker name + connected badge */}
              <div className="flex items-center gap-2.5">
                <span className="text-sm font-bold text-foreground">
                  {status?.broker_name ?? "BROKER"}
                </span>
                <Badge variant="default"
                  className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px]">
                  ● Connected
                </Badge>
              </div>

              {/* Paper badge */}
              <Badge variant="outline" className="text-[10px] border-blue-500/30 text-blue-400 bg-blue-500/10">
                PAPER
              </Badge>

              {/* Mode badge — the most visually dominant element */}
              <div className="flex items-center gap-2 ml-auto">
                {liveMode && (
                  <Radio className="w-3 h-3 text-destructive animate-pulse" />
                )}
                <span
                  className={`text-lg font-black tracking-widest uppercase px-3 py-1 rounded-sm border ${
                    liveMode
                      ? "text-destructive border-destructive/40 bg-destructive/10"
                      : "text-muted-foreground border-border bg-muted"
                  }`}
                >
                  {status?.mode ?? "REVIEW"}
                </span>

                {/* Mode switch */}
                <div className="flex items-center gap-2 ml-3 pl-3 border-l border-border">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">REVIEW</span>
                  <Switch
                    checked={liveMode}
                    onCheckedChange={handleModeToggle}
                    disabled={switchDisabled}
                  />
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">LIVE</span>
                </div>
              </div>
            </div>

            {!liveMode && (
              <p className="text-[10px] text-muted-foreground mt-3 border-t border-border/50 pt-3">
                Orders execute as dry-run previews in REVIEW mode — nothing is sent to the broker.
                Flip the switch to enable live paper trading.
              </p>
            )}
          </CardContent>
        </Card>

        {/* ── Account overview ─────────────────────────────────────────────── */}
        {account && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            <Card>
              <CardHeader className="pb-1 px-3 sm:px-4 pt-3">
                <CardTitle className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Total Value
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 sm:px-4 pb-3">
                <div className="text-lg sm:text-xl font-bold tabular-nums">
                  {fmtDollar(account.balance.total_value)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1 px-3 sm:px-4 pt-3">
                <CardTitle className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Cash
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 sm:px-4 pb-3">
                <div className="text-lg sm:text-xl font-bold text-emerald-400 tabular-nums">
                  {fmtDollar(account.balance.cash)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1 px-3 sm:px-4 pt-3">
                <CardTitle className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Buying Power
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 sm:px-4 pb-3">
                <div className="text-lg sm:text-xl font-bold text-blue-400 tabular-nums">
                  {fmtDollar(account.balance.buying_power)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1 px-3 sm:px-4 pt-3">
                <CardTitle className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Positions
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 sm:px-4 pb-3">
                <div className="text-lg sm:text-xl font-bold tabular-nums">
                  {fmtDollar(account.balance.positions_value)}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── Open orders table ────────────────────────────────────────────── */}
        <Card>
          <CardHeader className="px-3 sm:px-6">
            <CardTitle className="text-sm sm:text-base">Open Orders</CardTitle>
          </CardHeader>
          <CardContent className="px-0 sm:px-6">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[10px] sm:text-xs">Order ID</TableHead>
                    <TableHead className="text-[10px] sm:text-xs">Symbol</TableHead>
                    <TableHead className="text-[10px] sm:text-xs">Side</TableHead>
                    <TableHead className="text-[10px] sm:text-xs">Qty</TableHead>
                    <TableHead className="text-[10px] sm:text-xs hidden sm:table-cell">Price</TableHead>
                    <TableHead className="text-[10px] sm:text-xs">Status</TableHead>
                    <TableHead className="text-[10px] sm:text-xs hidden md:table-cell">Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(account?.open_orders ?? []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8 text-xs">
                        No open orders
                      </TableCell>
                    </TableRow>
                  ) : (
                    account!.open_orders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell>
                          <span className="font-mono text-[10px] sm:text-xs text-muted-foreground">
                            {order.id.slice(0, 12)}…
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono font-medium text-xs sm:text-sm">{order.symbol}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={order.side === "BUY" ? "default" : "destructive"}
                            className={`text-[10px] ${order.side === "BUY" ? "bg-emerald-500/15 text-emerald-400" : ""}`}>
                            {order.side}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-[10px] sm:text-xs tabular-nums">{order.qty}</span>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <span className="font-mono text-[10px] sm:text-xs tabular-nums">
                            {order.price > 0 ? fmtDollar(order.price) : "—"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={orderStatusColor(order.status)}
                            className={`text-[10px] ${orderStatusClass(order.status)}`}>
                            {order.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                            {formatTimestamp(order.created_at)}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* ── Execution log ────────────────────────────────────────────────── */}
        <Card>
          <CardHeader className="px-3 sm:px-6">
            <CardTitle className="text-sm sm:text-base">Execution Log</CardTitle>
          </CardHeader>
          <CardContent className="px-0 sm:px-6">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[10px] sm:text-xs">Signal</TableHead>
                    <TableHead className="text-[10px] sm:text-xs">Symbol</TableHead>
                    <TableHead className="text-[10px] sm:text-xs">Setup</TableHead>
                    <TableHead className="text-[10px] sm:text-xs hidden sm:table-cell">Mode</TableHead>
                    <TableHead className="text-[10px] sm:text-xs">Outcome</TableHead>
                    <TableHead className="text-[10px] sm:text-xs hidden sm:table-cell">Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledgerEntries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8 text-xs">
                        No execution history yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    ledgerEntries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>
                          <span className="font-mono text-[10px] sm:text-xs text-muted-foreground">
                            {entry.id.slice(0, 8)}…
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono font-medium text-xs sm:text-sm">{entry.symbol}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="font-mono text-[10px] sm:text-xs">
                            {entry.setup_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <Badge variant="outline"
                            className={`text-[10px] ${
                              entry.execution_mode === "LIVE"
                                ? "border-destructive/30 text-destructive bg-destructive/5"
                                : "border-muted-foreground/30 text-muted-foreground"
                            }`}>
                            {entry.execution_mode === "LIVE" && (
                              <Radio className="w-2 h-2 inline mr-1" />
                            )}
                            {entry.execution_mode}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {!entry.outcome ? (
                            <Badge variant="outline" className="text-[10px]">PENDING</Badge>
                          ) : entry.outcome.win ? (
                            <Badge variant="default" className="text-[10px] bg-emerald-500/15 text-emerald-400">
                              WIN
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="text-[10px]">LOSS</Badge>
                          )}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                            {formatTimestamp(entry.created_at)}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* ── LIVE confirmation dialog ────────────────────────────────────────── */}
      <AlertDialog open={liveDialogOpen} onOpenChange={setLiveDialogOpen}>
        <AlertDialogContent className="font-mono">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Switch to LIVE Paper Trading
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3 text-sm">
              <p>
                You are about to enable <strong>LIVE</strong> paper trading mode.
                Orders will be sent to Alpaca's paper API and executed against the
                simulated market — they are not real-money trades, but they will
                fill and affect your paper account balance.
              </p>
              <p>
                Type <code className="bg-muted px-1.5 py-0.5 rounded text-destructive font-bold">LIVE</code>{" "}
                below to confirm:
              </p>
              <Input
                value={liveConfirm}
                onChange={(e) => setLiveConfirm(e.target.value)}
                placeholder='Type "LIVE" to confirm'
                className="font-mono text-sm"
                autoFocus
              />
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmLiveSwitch}
              disabled={liveConfirm !== "LIVE"}
              className="text-xs bg-destructive text-destructive-foreground hover:bg-destructive/80 disabled:opacity-40"
            >
              Switch to LIVE
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
