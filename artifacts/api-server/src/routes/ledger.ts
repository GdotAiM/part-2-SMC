import { Router, type IRouter } from "express";
import { TradeLedgerService } from "../lib/services/TradeLedgerService.js";
import { PerformanceMatrixService } from "../lib/services/PerformanceMatrixService.js";
import {
  ExecutionManager,
  MockBrokerAdapter,
} from "../lib/execution/BrokerAbstraction.js";
import { SignalGenerator } from "../lib/services/SignalGenerator.js";
import { fetchBinanceCandles } from "../lib/fetchers/binance.js";
import { fetchYahooCandles } from "../lib/fetchers/yahoo.js";
import { buildReport } from "../lib/smc/report.js";

const router: IRouter = Router();
const ledgerService = new TradeLedgerService();
const matrixService = new PerformanceMatrixService();
const executionManager = new ExecutionManager(new MockBrokerAdapter(), "REVIEW");
const signalGenerator = new SignalGenerator();

// ─── GET /api/ledger — Query signals ──────────────────────────────────────────

router.get("/ledger", async (req, res) => {
  try {
    const { asset, setup, symbol, mode, limit } = req.query;

    const signals = await ledgerService.querySignals({
      asset: asset as string | undefined,
      setup: setup as string | undefined,
      symbol: symbol as string | undefined,
      mode: mode as string | undefined,
      limit: limit ? parseInt(limit as string) : 50,
    });

    // Calculate aggregate metrics
    const metrics = matrixService.calculateMetrics(signals);

    res.json({ signals, metrics });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ─── GET /api/ledger/pending — Signals awaiting outcome ───────────────────────

router.get("/ledger/pending", async (_req, res) => {
  try {
    const signals = await ledgerService.getPendingSignals();
    res.json({ signals });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ─── GET /api/performance-matrix — Matrix data ────────────────────────────────

router.get("/performance-matrix", async (req, res) => {
  try {
    const { asset, detailed } = req.query;

    const matrix = await matrixService.queryMatrix({
      asset: asset as string | undefined,
      detailed: detailed === "true",
    });

    res.json(matrix);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ─── POST /api/signals/generate — Generate signals from live SMC analysis ─────

router.post("/signals/generate", async (req, res) => {
  try {
    const { symbol, market, timeframe, style } = req.body;

    if (!symbol || !market) {
      res.status(400).json({ error: "symbol and market are required" });
      return;
    }

    const tf = timeframe || "1h";
    const mkt = market as "crypto" | "forex";

    // Fetch live candles
    const candles =
      mkt === "crypto"
        ? await fetchBinanceCandles(symbol as string, tf)
        : await fetchYahooCandles(symbol as string, tf);

    // Run SMC analysis
    const report = buildReport(candles, symbol as string, mkt, tf);

    // Generate signal
    const signal = signalGenerator.generateFromReport(report, mkt, {
      source: "API_GENERATED",
    });

    if (!signal) {
      res.json({ signals: [], message: "No valid trade setup detected" });
      return;
    }

    // Log to ledger
    await ledgerService.logSignal(signal, "REVIEW");

    res.json({ signals: [signal] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ─── POST /api/signals/execute — Execute signal through broker ─────────────────

router.post("/signals/execute", async (req, res) => {
  try {
    const { signal, mode } = req.body;

    if (!signal) {
      res.status(400).json({ error: "signal is required" });
      return;
    }

    if (mode) {
      executionManager.setMode(mode as "REVIEW" | "LIVE");
    }

    const result = await executionManager.executeSignal(signal);

    // Log to ledger
    await ledgerService.logSignal(
      signal,
      executionManager.getMode(),
      result.order_id
    );

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ─── GET /api/account — Mock account status ───────────────────────────────────

router.get("/account", async (_req, res) => {
  try {
    const status = await executionManager.getAccountStatus();
    res.json(status);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ─── POST /api/performance-matrix/rebuild — Trigger full matrix rebuild ───────

router.post("/performance-matrix/rebuild", async (_req, res) => {
  try {
    const count = await matrixService.rebuildFullMatrix();
    res.json({ message: `Performance matrix rebuilt`, combinations: count });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
