import { useState, useEffect, useCallback } from "react";
import {
  Play, Square, Loader2, AlertTriangle, CheckCircle, Radio,
  ExternalLink, Activity, Eye, Zap,
} from "lucide-react";
import { apiUrl } from "@/lib/api";
import {
  getBrokerStatus, setBrokerMode, executeSignal,
  startLoopMonitor, stopLoopMonitor, getLoopStatus, generateSignal,
} from "@/lib/api";
import { fmtAssetPrice } from "@/lib/format";

// ─── Types ────────────────────────────────────────────────────────────────

interface TradeSetup {
  symbol: string;
  timeframe: string;
  market: "crypto" | "forex";
  direction: "long" | "short" | null;
  entryLow: number | null;
  entryHigh: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  confidence: number;
  grade: string;
}

interface Props {
  setup: TradeSetup;
}

// ─── TradeActions ──────────────────────────────────────────────────────────

export function TradeActions({ setup }: Props) {
  const [brokerMode, setBrokerModeState] = useState<"REVIEW" | "LIVE">("REVIEW");
  const [brokerName, setBrokerName] = useState("");
  const [isReady, setIsReady] = useState(false);
  const [isPaper, setIsPaper] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [execResult, setExecResult] = useState<{ success: boolean; order_id?: string; message?: string } | null>(null);
  const [monitoring, setMonitoring] = useState(false);
  const [monitorId, setMonitorId] = useState<string | null>(null);
  const [showModeDialog, setShowModeDialog] = useState(false);
  const [showLiveConfirm, setShowLiveConfirm] = useState(false);
  const [pendingMode, setPendingMode] = useState<"REVIEW" | "LIVE" | null>(null);
  const [liveConfirmInput, setLiveConfirmInput] = useState("");

  // Fetch broker status on mount
  const refreshBroker = useCallback(async () => {
    try {
      const status = await getBrokerStatus();
      setBrokerModeState(status.mode);
      setBrokerName(status.broker_name);
      setIsReady(status.is_ready);
      setIsPaper(status.is_paper);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { refreshBroker(); }, [refreshBroker]);

  // Check if this setup already has a monitor
  useEffect(() => {
    getLoopStatus().then((data) => {
      const existing = data.monitors.find(
        (m: any) => m.symbol === setup.symbol && m.timeframe === setup.timeframe,
      );
      if (existing) {
        setMonitoring(true);
        setMonitorId(existing.id);
      }
    }).catch(() => {});
  }, [setup.symbol, setup.timeframe]);

  // ── Execute signal ──
  async function handleExecute() {
    if (!setup.entryLow || !setup.entryHigh || !setup.stopLoss || !setup.takeProfit || !setup.direction) return;

    const entryPrice = (setup.entryLow + setup.entryHigh) / 2;
    const signalPayload = {
      id: `${setup.symbol}_${Date.now()}`,
      timestamp: new Date().toISOString(),
      asset_class: setup.market === "crypto" ? "CRYPTO" : "FOREX",
      symbol: setup.symbol,
      setup_type: "MANUAL",
      setup_subtype: setup.direction === "long" ? "BULLISH" : "BEARISH",
      entry_price: entryPrice,
      stop_loss: setup.stopLoss,
      take_profit: setup.takeProfit,
      confidence_score: setup.confidence,
      risk_reward_ratio: setup.stopLoss ? Math.abs(setup.takeProfit - entryPrice) / Math.abs(entryPrice - setup.stopLoss) : 1,
      setup_quality_factors: { structure_confluence: 2, liquidity_quality: 2, confluence_count: 3 },
      analysis_context: {
        timeframe_cascade: { macro: "", intermediate: "", execution: setup.timeframe },
        market_regime: "RANGING",
        session_context: "MANUAL",
        htf_bias: setup.direction === "long" ? "BULLISH" : "BEARISH",
        confluence_factors: {},
      },
      parameter_snapshot: {},
      rationale: { structure_confluence: "Manual trade entry", liquidity_quality: "Manual" },
      version: "1.0",
      source: "MANUAL_TRADE",
    };

    setExecuting(true);
    setExecResult(null);
    try {
      const result = await executeSignal(signalPayload);
      setExecResult(result);
      if (result.order_id) {
        await generateSignal({ symbol: setup.symbol, market: setup.market, timeframe: setup.timeframe });
      }
    } catch (err: any) {
      setExecResult({ success: false, message: err.message });
    }
    setExecuting(false);
  }

  // ── Switch broker mode ──
  async function confirmModeSwitch() {
    if (!pendingMode) return;
    try {
      const confirm = pendingMode === "LIVE" ? "LIVE" : undefined;
      await setBrokerMode(pendingMode, confirm);
      setBrokerModeState(pendingMode);
    } catch { /* ignore */ }
    setPendingMode(null);
    setShowModeDialog(false);
    setShowLiveConfirm(false);
    setLiveConfirmInput("");
  }

  function openModeSwitch(mode: "REVIEW" | "LIVE") {
    setPendingMode(mode);
    if (mode === "LIVE") {
      setShowLiveConfirm(true);
    } else {
      confirmModeSwitch();
    }
  }

  // ── Monitor management ──
  async function toggleMonitor() {
    if (monitoring && monitorId) {
      await stopLoopMonitor(monitorId);
      setMonitoring(false);
      setMonitorId(null);
    } else {
      try {
        const result = await startLoopMonitor({
          symbol: setup.symbol,
          timeframe: setup.timeframe,
          market: setup.market,
        });
        setMonitorId(result.monitorId);
        setMonitoring(true);
      } catch { /* ignore */ }
    }
  }

  const hasLevels = !!(setup.entryLow && setup.entryHigh && setup.stopLoss && setup.takeProfit);
  const entryPrice = hasLevels ? (setup.entryLow! + setup.entryHigh!) / 2 : 0;

  return (
    <div className="mt-4 space-y-3 border-t border-border/60 pt-4">
      {/* ── Broker status bar ── */}
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground/70">
        <Radio className={`w-2.5 h-2.5 ${brokerMode === "LIVE" ? "text-rose-500 animate-pulse" : "text-muted-foreground"}`} />
        <span>
          Broker: <span className="font-semibold text-foreground/70">{brokerName}</span>
        </span>
        <span className={`px-1 py-0.5 rounded-sm font-bold text-[9px] ${
          brokerMode === "LIVE"
            ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
            : "bg-amber-500/15 text-amber-400 border border-amber-500/25"
        }`}>
          {brokerMode}
        </span>
        {isPaper && (
          <span className="px-1 py-0.5 rounded-sm bg-blue-500/15 text-blue-400 font-bold text-[9px] border border-blue-500/25">
            PAPER
          </span>
        )}
        <button
          onClick={() => setShowModeDialog(true)}
          className="ml-auto text-[9px] text-muted-foreground hover:text-foreground underline"
        >
          Switch to {brokerMode === "LIVE" ? "REVIEW" : "LIVE"}
        </button>
      </div>

      {/* ── Mode switch dialog ── */}
      {showModeDialog && (
        <div className="rounded-sm border border-border bg-muted/30 p-3 space-y-2">
          <p className="text-[11px] font-semibold">Switch Execution Mode</p>
          <div className="flex gap-2">
            <button
              onClick={() => openModeSwitch("REVIEW")}
              className={`flex-1 px-2.5 py-1.5 rounded-sm text-[10px] font-bold border transition-colors ${
                brokerMode === "REVIEW"
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-border bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              <Eye className="w-3 h-3 inline mr-1" /> REVIEW
            </button>
            <button
              onClick={() => openModeSwitch("LIVE")}
              className={`flex-1 px-2.5 py-1.5 rounded-sm text-[10px] font-bold border transition-colors ${
                brokerMode === "LIVE"
                  ? "border-rose-500/30 bg-rose-500/10 text-rose-400"
                  : "border-border bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              <Radio className="w-3 h-3 inline mr-1" /> LIVE
            </button>
          </div>
          {showLiveConfirm && (
            <div className="space-y-1.5">
              <p className="text-[10px] text-rose-400 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Type <span className="font-bold">LIVE</span> to confirm:
              </p>
              <input
                value={liveConfirmInput}
                onChange={(e) => setLiveConfirmInput(e.target.value)}
                placeholder='Type "LIVE" to confirm'
                className="w-full bg-muted border border-rose-500/40 rounded-sm px-2 py-1 text-xs text-foreground"
              />
              <div className="flex gap-2">
                <button
                  onClick={confirmModeSwitch}
                  disabled={liveConfirmInput !== "LIVE"}
                  className="px-2.5 py-1 rounded-sm bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[10px] font-bold disabled:opacity-40"
                >
                  Confirm LIVE
                </button>
                <button
                  onClick={() => { setShowLiveConfirm(false); setPendingMode(null); }}
                  className="px-2.5 py-1 rounded-sm bg-muted text-muted-foreground border border-border text-[10px]"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          {!showLiveConfirm && (
            <button
              onClick={() => setShowModeDialog(false)}
              className="text-[10px] text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          )}
        </div>
      )}

      {/* ── Action buttons ── */}
      <div className="flex flex-wrap gap-2">
        {/* Execute Now */}
        <button
          onClick={handleExecute}
          disabled={executing || !hasLevels}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-bold border transition-all ${
            brokerMode === "LIVE"
              ? "bg-rose-500/20 border-rose-500/40 text-rose-400 hover:bg-rose-500/30"
              : "bg-emerald-500/15 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25"
          } disabled:opacity-40`}
          title={brokerMode === "LIVE" ? "Execute LIVE order" : "Execute in REVIEW mode (dry-run)"}
        >
          {executing ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Play className="w-3.5 h-3.5" />
          )}
          {executing ? "Executing..." : `Execute${brokerMode === "LIVE" ? " LIVE" : " Now"}`}
        </button>

        {/* Monitor with Agent */}
        <button
          onClick={toggleMonitor}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-bold border transition-all ${
            monitoring
              ? "bg-amber-500/20 border-amber-500/30 text-amber-400 hover:bg-amber-500/30"
              : "bg-primary/10 border-primary/30 text-primary hover:bg-primary/20"
          }`}
        >
          {monitoring ? (
            <Square className="w-3.5 h-3.5" />
          ) : (
            <Activity className="w-3.5 h-3.5" />
          )}
          {monitoring ? `Monitoring (${setup.timeframe})` : "Monitor with Agent"}
        </button>
      </div>

      {/* ── Exec result ── */}
      {execResult && (
        <div className={`rounded-sm px-2.5 py-2 text-[11px] flex items-start gap-2 ${
          execResult.success
            ? "bg-emerald-500/10 border border-emerald-500/25"
            : "bg-destructive/10 border border-destructive/30"
        }`}>
          {execResult.success
            ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
            : <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
          }
          <div>
            <p className={`font-semibold ${execResult.success ? "text-emerald-400" : "text-destructive"}`}>
              {execResult.success ? "Order Placed" : "Execution Failed"}
            </p>
            {execResult.order_id && (
              <p className="text-muted-foreground mt-0.5">Order ID: {execResult.order_id}</p>
            )}
            {execResult.message && (
              <p className="text-muted-foreground mt-0.5">{execResult.message}</p>
            )}
          </div>
        </div>
      )}

      {/* ── Monitoring detail ── */}
      {monitoring && monitorId && (
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground bg-muted/30 rounded-sm px-2.5 py-1.5 border border-border">
          <Activity className="w-3 h-3 text-amber-400 animate-pulse" />
          <span>
            Monitoring <span className="font-semibold text-foreground/70">{setup.symbol}</span>
            {" on "}
            <span className="font-semibold text-foreground/70">{setup.timeframe}</span>
          </span>
          <span className="text-[9px] px-1 py-0.5 rounded-sm bg-amber-500/15 text-amber-400">ID: {monitorId.slice(0, 12)}</span>
          <button
            onClick={toggleMonitor}
            className="ml-auto text-[9px] text-destructive hover:text-destructive/80 underline"
          >
            Stop
          </button>
        </div>
      )}

      {/* ── No levels warning ── */}
      {!hasLevels && (
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60 italic">
          <AlertTriangle className="w-3 h-3" />
          Set entry, stop, and target levels to enable execution
        </div>
      )}
    </div>
  );
}
