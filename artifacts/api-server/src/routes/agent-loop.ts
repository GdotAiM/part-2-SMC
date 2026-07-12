/**
 * Agent Loop Routes
 *
 * REST + SSE endpoints for the AI Agent Loop system.
 *
 * Endpoints:
 *   POST   /api/agent-loop/run              — Execute one loop cycle (SSE)
 *   POST   /api/agent-loop/start-monitoring  — Start background monitor
 *   POST   /api/agent-loop/stop-monitoring   — Stop background monitor
 *   GET    /api/agent-loop/status            — All active monitors
 *   GET    /api/agent-loop/runs              — Historical runs
 *   GET    /api/agent-loop/runs/:id          — Detailed trace
 *   POST   /api/agent-loop/runs/:id/evaluate — Trigger evaluation
 *   GET    /api/agent-loop/memory            — Query semantic memory
 *   POST   /api/agent-loop/memory            — Store manual entry
 *   DELETE /api/agent-loop/memory/:id        — Delete memory entry
 */

import { Router, type IRouter } from "express";
import type { Request, Response } from "express";
import { AgentLoop } from "../lib/loop/AgentLoop.js";
import { DEFAULT_LOOP_CONFIG } from "../lib/loop/types.js";
import { monitoringManager } from "../lib/loop/MonitoringManager.js";
import { LoopTracer } from "../lib/harness/LoopTracer.js";
import { MemoryService } from "../lib/memory/MemoryService.js";
import { LoopEvaluator } from "../lib/harness/LoopEvaluator.js";
import { candleStore } from "../lib/realtime/candle-store.js";
import { buildReport } from "../lib/smc/report.js";
import { logger } from "../lib/logger.js";
import { langfuse } from "../lib/observability/langfuse.js";
import { PromptOptimizer } from "../lib/optimization/prompt-optimizer.js";
import { newsFetcher } from "../lib/news/index.js";
import { qdrantMemory } from "../lib/memory/vector/QdrantMemory.js";
import { buildNewsContext } from "../lib/news/index.js";
import { AgentEvaluator } from "../lib/evaluation/index.js";
import { fetchBinanceCandles, fetchBinanceCandlesDirect } from "../lib/fetchers/binance.js";
import { fetchYahooCandles } from "../lib/fetchers/yahoo.js";

const router: IRouter = Router();
const memoryService = new MemoryService();
const tracer = new LoopTracer();

// ── Helper: detect market from symbol ─────────────────────────────

function detectMarket(symbol: string): "crypto" | "forex" {
  return symbol.includes("=X") ? "forex" : "crypto";
}

// ── POST /api/agent-loop/run — SSE: one loop cycle ────────────────

router.post("/agent-loop/run", async (req: Request, res: Response): Promise<void> => {
  const { symbol, timeframe, market } = req.body as {
    symbol?: string;
    timeframe?: string;
    market?: string;
  };

  if (!symbol || !timeframe) {
    res.status(400).json({ error: "symbol and timeframe are required" });
    return;
  }

  const mkt = market || detectMarket(symbol);
  const tf = timeframe;
  const sym = symbol.toUpperCase();

  const config = {
    ...DEFAULT_LOOP_CONFIG,
    symbol: sym,
    timeframe: tf,
    market: mkt as "crypto" | "forex",
  };

  // Get candles — try Binance Direct API for crypto, Yahoo for forex, then candle store
  let candles: any[] = [];
  try {
    if (mkt === "crypto") {
      candles = await fetchBinanceCandlesDirect(sym, tf);
      logger.info({ symbol: sym, timeframe: tf, count: candles.length, source: "binance_direct" }, "Fetched candles from Binance API");
    } else {
      candles = await fetchYahooCandles(sym, tf);
      logger.info({ symbol: sym, timeframe: tf, count: candles.length, source: "yahoo" }, "Fetched candles from Yahoo");
    }
  } catch (fetchErr) {
    logger.warn({ err: fetchErr.message, symbol: sym, tf }, "Direct fetch failed, trying candle store");
    candles = candleStore.getCandles(sym, tf);
    if (candles.length >= 10) {
      logger.info({ symbol: sym, timeframe: tf, count: candles.length, source: "candle_store" }, "Using candle store fallback");
    }
  }
  if (candles.length < 10) {
    // Fallback: try reading bars from TradingView Desktop (it has a live connection)
    try {
      const tv = await import("../lib/integrations/tradingview/index.js");
      if (tv.isTvEnabled()) {
        logger.info({ symbol: sym, tf }, "Binance/Yahoo unavailable — trying TradingView Desktop...");
        // Ensure we're connected
        await tv.connect();
        // Read the current symbol/timeframe from TV to see if it matches
        const tvSymbol = await tv.getSymbol();
        const tvTf = await tv.getTimeframe();
        if (tvSymbol && tvTf) {
          logger.info({ tvSymbol, tvTf }, "TV Desktop chart is showing");
          // Attempt conversion
          const rawSymbol = tv.fromTvSymbol ? tv.fromTvSymbol(tvSymbol) : tvSymbol;
          // Read bars — TV has the most recent data cached
          const tvBars = await tv.getBars(500);
          if (tvBars && tvBars.length >= 10) {
            candles = tvBars.map(b => [b.time, b.open, b.high, b.low, b.close, b.volume]);
            logger.info({ symbol: sym, tf, count: candles.length, source: "tradingview_desktop" }, "Using TV Desktop bars");
          }
        }
      }
    } catch (tvErr: any) {
      logger.warn({ err: tvErr.message }, "TV Desktop fallback failed");
    }
  }
  if (candles.length < 10) {
    res.status(400).json({ error: "Not enough data for " + sym + " " + tf + ". API, store, and TV Desktop all unavailable." });
    return;
  }
  // Seed candle store so SMC tools can read from it
  try {
    candleStore.seedCandles(sym, tf, candles);
  } catch { /* non-critical */ }

  const report = buildReport(candles, sym, mkt as "crypto" | "forex", tf);

  // Setup SSE
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  // Create loop instance
  const loop = new AgentLoop(config);

  // Wire SSE events
  loop.on("step", (step) => {
    try {
      res.write(`data: ${JSON.stringify({ type: "loop_step", step })}\n\n`);
    } catch { /* client may have disconnected */ }
  });

  loop.on("decision", (decision) => {
    try {
      res.write(`data: ${JSON.stringify({ type: "loop_decision", decision })}\n\n`);
    } catch { /* ignore */ }
  });

  loop.on("signal", (signal) => {
    try {
      res.write(`data: ${JSON.stringify({ type: "loop_signal", signal: { symbol: signal.symbol, confidence: signal.confidence_score, entry_price: signal.entry_price, stop_loss: signal.stop_loss, take_profit: signal.take_profit } })}\n\n`);
    } catch { /* ignore */ }
  });

  loop.on("error", (err) => {
    try {
      res.write(`data: ${JSON.stringify({ type: "loop_error", error: err.message })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: "loop_complete", result: { action: "error" } })}\n\n`);
      res.end();
    } catch { /* ignore */ }
  });

  loop.on("complete", (result) => {
    try {
      res.write(`data: ${JSON.stringify({ type: "loop_complete", result })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
      res.end();
    } catch { /* ignore */ }
  });

  try {
    await loop.run(report, "api");
  } catch (err: any) {
    logger.error({ err }, "Agent loop run failed");
    try {
      res.write(`data: ${JSON.stringify({ type: "loop_error", error: err.message })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
      res.end();
    } catch { /* ignore */ }
  }
});

// ── POST /api/agent-loop/start-monitoring ─────────────────────────

router.post("/agent-loop/start-monitoring", async (req: Request, res: Response): Promise<void> => {
  const { symbol, timeframe, market } = req.body as {
    symbol?: string;
    timeframe?: string;
    market?: string;
  };

  if (!symbol || !timeframe) {
    res.status(400).json({ error: "symbol and timeframe are required" });
    return;
  }

  const config = {
    ...DEFAULT_LOOP_CONFIG,
    symbol: symbol.toUpperCase(),
    timeframe,
    market: (market || detectMarket(symbol)) as "crypto" | "forex",
  };

  try {
    const monitorId = await monitoringManager.add(config);
    res.json({ monitorId, status: "started", symbol: config.symbol, timeframe: config.timeframe });
  } catch (err: any) {
    res.status(500).json({ error: `Failed to start monitor: ${err.message}` });
  }
});

// ── POST /api/agent-loop/stop-monitoring ─────────────────────────

router.post("/agent-loop/stop-monitoring", (req: Request, res: Response): void => {
  const { monitorId } = req.body as { monitorId?: string };

  if (!monitorId) {
    res.status(400).json({ error: "monitorId is required" });
    return;
  }

  const removed = monitoringManager.remove(monitorId);
  if (removed) {
    res.json({ status: "stopped", monitorId });
  } else {
    res.status(404).json({ error: `Monitor "${monitorId}" not found` });
  }
});

// ── GET /api/agent-loop/status ──────────────────────────────────

router.get("/agent-loop/status", (_req: Request, res: Response): void => {
  const monitors = monitoringManager.getAll();
  res.json({ monitors, count: monitors.length });
});

// ── GET /api/agent-loop/runs — historical runs ──────────────────

router.get("/agent-loop/runs", async (req: Request, res: Response): Promise<void> => {
  try {
    const { symbol, status, limit } = req.query;
    const runs = await tracer.queryRuns({
      symbol: symbol as string | undefined,
      status: status as string | undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });
    res.json({ runs });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/agent-loop/runs/:id — detailed trace ───────────────

router.get("/agent-loop/runs/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const trace = await tracer.getRunTrace(req.params.id);
    if (!trace.run) {
      res.status(404).json({ error: `Run "${req.params.id}" not found` });
      return;
    }
    res.json(trace);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/agent-loop/runs/:id/evaluate ──────────────────────

router.post("/agent-loop/runs/:id/evaluate", async (req: Request, res: Response): Promise<void> => {
  try {
    const trace = await tracer.getRunTrace(req.params.id);
    if (!trace.run) {
      res.status(404).json({ error: `Run "${req.params.id}" not found` });
      return;
    }

    const evaluator = new LoopEvaluator(memoryService.semantic);
    const evaluation = evaluator.scoreRun(trace.steps, trace.run.result || { action: "no_action", confidence: 0, narrative: "" });
    await evaluator.persistEvaluation(evaluation, req.params.id);

    res.json({ evaluation });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/agent-loop/memory — query semantic memory ──────────

router.get("/agent-loop/memory", async (req: Request, res: Response): Promise<void> => {
  try {
    const { tags, key, limit } = req.query;
    const tagsArr = tags ? (tags as string).split(",").map((t) => t.trim()).filter(Boolean) : undefined;
    const entries = await memoryService.semantic.query(tagsArr, key as string | undefined);
    res.json({ entries: limit ? entries.slice(0, parseInt(limit as string)) : entries });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/agent-loop/memory — store manual entry ────────────

router.post("/agent-loop/memory", async (req: Request, res: Response): Promise<void> => {
  const { key, content, source, score, tags } = req.body as {
    key?: string;
    content?: string;
    source?: string;
    score?: number;
    tags?: string[];
  };

  if (!key || !content) {
    res.status(400).json({ error: "key and content are required" });
    return;
  }

  try {
    await memoryService.semantic.storeEntry({
      key,
      content,
      source: (source as any) || "manual",
      score: score ?? 0,
      tags: tags || [],
      isDurable: true,
    });
    res.json({ status: "stored", key });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/agent-loop/memory/:id ─────────────────────────────

router.delete("/agent-loop/memory/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    await memoryService.semantic.deleteEntry(req.params.id);
    res.json({ status: "deleted" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/agent-loop/optimize — Optimize an agent prompt ────────────

router.post("/agent-loop/optimize", async (req: Request, res: Response): Promise<void> => {
  const { agentName, currentPrompt } = req.body as {
    agentName?: string;
    currentPrompt?: string;
  };

  if (!agentName || !currentPrompt) {
    res.status(400).json({ error: "agentName and currentPrompt are required" });
    return;
  }

  try {
    const optimizer = new PromptOptimizer();
    const result = await optimizer.optimize(agentName, currentPrompt);
    res.json(result);
  } catch (err: any) {
    logger.error({ err }, "Prompt optimization failed");
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/agent-loop/optimize/variants — List prompt variants ─────────

router.get("/agent-loop/optimize/variants", async (req: Request, res: Response): Promise<void> => {
  const { agentName } = req.query as { agentName?: string };

  if (!agentName) {
    res.status(400).json({ error: "agentName query param is required" });
    return;
  }

  try {
    const optimizer = new PromptOptimizer();
    const variants = await optimizer.getVariants(agentName);
    res.json({ variants });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/agent-loop/langfuse-status — Langfuse configuration status ──

router.get("/agent-loop/langfuse-status", (_req: Request, res: Response): void => {
  const publicKey = !!process.env.LANGFUSE_PUBLIC_KEY;
  const secretKey = !!process.env.LANGFUSE_SECRET_KEY;
  res.json({
    configured: publicKey && secretKey,
    hasPublicKey: publicKey,
    hasSecretKey: secretKey,
    host: process.env.LANGFUSE_HOST || "https://us.cloud.langfuse.com",
  });
});



// ─── GET /api/agent-loop/tv-status — TradingView connection status
router.get("/agent-loop/tv-status", async (_req, res) => {
  try {
    const tv = await import("../lib/integrations/tradingview/index.js");
    const connected = await tv.isConnected();
    res.json({ connected, config: tv.getTvConfig(), url: connected ? await tv.getPageUrl() : null });
  } catch (err) {
    res.json({ connected: false, error: err.message });
  }
});

// ─── POST /api/agent-loop/tv-config — Update TV config
router.post("/agent-loop/tv-config", async (req, res) => {
  try {
    const { setTvConfig, getTvConfig } = await import("../lib/integrations/tradingview/config.js");
    setTvConfig(req.body);
    res.json({ config: getTvConfig() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/agent-loop/tv-connect — Force reconnect
router.post("/agent-loop/tv-connect", async (_req, res) => {
  try {
    const tv = await import("../lib/integrations/tradingview/index.js");
    const ok = await tv.connect();
    res.json({ connected: ok });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/agent-loop/tv-sync — Sync SMC levels to TV chart
router.post("/agent-loop/tv-sync", async (req, res) => {
  try {
    const tv = await import("../lib/integrations/tradingview/index.js");
    const { report } = req.body;
    if (!report) { res.status(400).json({ error: "report is required" }); return; }
    const count = await tv.syncSmcLevels(report);
    res.json({ synced: count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/agent-loop/tv-read — Read chart state (symbol, timeframe)
router.get("/agent-loop/tv-read", async (_req, res) => {
  try {
    const tv = await import("../lib/integrations/tradingview/index.js");
    const state = await tv.getChartState();
    res.json({ state });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/agent-loop/tv-draw — Draw SMC levels on TV chart
router.post("/agent-loop/tv-draw", async (req, res) => {
  try {
    const tv = await import("../lib/integrations/tradingview/index.js");
    const { action, symbol, timeframe } = req.body as { action?: string; symbol?: string; timeframe?: string };

    if (!tv.isTvEnabled()) {
      res.status(400).json({ error: "TV Desktop not enabled" });
      return;
    }

    // Ensure connected
    if (!(await tv.isConnected())) {
      await tv.connect();
    }

    // If symbol/timeframe provided, switch TV Desktop chart to that context
    if (symbol && timeframe) {
      if (await tv.isConnected()) {
        const converted = tv.toTvSymbol ? tv.toTvSymbol(symbol) : symbol;
        const tvTf = timeframe.replace("m", "").replace("h", "").replace("d", "D").replace("w", "W");
        const kind = timeframe.endsWith("m") ? "minutes" : timeframe.endsWith("h") ? "hours" : timeframe.endsWith("d") ? "days" : "weeks";
        const mult = parseInt(timeframe) || 1;

        await tv.evaluateWithArgs((sym: string, tf: string, k: string, m: number) => {
          try {
            const coll = (window as any)._exposed_chartWidgetCollection;
            const src = coll?.activeChartWidget?._value
              ?._paneWidgets?._value?.[0]
              ?._legendWidget?._mainSeriesViewModel?._source;
            if (!src) return;
            src.setSymbol(sym);
            src.setInterval(tf, { kind: k, multiplier: m });
          } catch {}
        }, converted, tvTf, kind, mult);

        // Wait for chart to load new data
        await new Promise(r => setTimeout(r, 3000));

        // Wait a bit more for BTC on 1m — it can be slow
        if (symbol.includes("BTC") && timeframe === "1m") {
          await new Promise(r => setTimeout(r, 3000));
        }
      }
    }

    const result: any = { action, levels: [], fvgs: [], logs: [] };
    const log = (msg: string) => result.logs.push(msg);

    if (action === "clear") {
      // Clear all drawings via keyboard: Escape to deselect, then remove all
      for (let i = 0; i < 3; i++) { await tv.keyboardPress("Escape"); await new Promise(r => setTimeout(r, 200)); }
      // Also call removeAllDrawingTools via evaluate
      await tv.evaluate(() => {
        try {
          const w = window._exposed_chartWidgetCollection;
          if (w?._chartWidgetsDefs?.[0]?.chartWidget?.model) {
            w._chartWidgetsDefs[0].chartWidget.model().removeAllDrawingTools();
          }
        } catch {}
      });
      log("Chart cleared");
    }

    if (action === "levels" || action === "all") {
      // Compute and draw BSL/SSL/Current
      const coords = await tv.evaluate(() => {
        try {
          const cw = window._exposed_chartWidgetCollection._chartWidgetsDefs[0].chartWidget;
          const pane = cw.model().model().mainPane();
          const ps = pane.defaultPriceScale();
          const ts = cw.model().timeScale();
          const src = window._exposed_chartWidgetCollection.activeChartWidget._value
            ._paneWidgets._value[0]._legendWidget._mainSeriesViewModel._source;
          const items = src.bars()._items.map((i: any) => i.value);
          const cur = items[items.length - 1][4];
          const h = items.map((b: any) => b[2]), l = items.map((b: any) => b[3]);

          // Swing highs/lows
          const sh: number[] = [], sl: number[] = [];
          for (let i = 3; i < items.length - 3; i++) {
            if (h[i] > h[i-1] && h[i] > h[i-2] && h[i] > h[i-3] && h[i] > h[i+1] && h[i] > h[i+2] && h[i] > h[i+3]) sh.push(h[i]);
            if (l[i] < l[i-1] && l[i] < l[i-2] && l[i] < l[i-3] && l[i] < l[i+1] && l[i] < l[i+2] && l[i] < l[i+3]) sl.push(l[i]);
          }
          const d = (p: number[], t: number) => {
            const s = [...new Set(p)].sort((a, b) => a - b);
            const u: number[] = [];
            for (const x of s) { if (!u.length || Math.abs(x - u[u.length - 1]) / u[u.length - 1] > t) u.push(x); }
            return u;
          };
          const thr = src.symbol().includes("BTC") ? 0.0005 : 0.0003;
          const bsl = d(sh, thr).filter(x => x > cur).sort((a, b) => a - b);
          const ssl = d(sl, thr).filter(x => x < cur).sort((a, b) => b - a);

          const levels: any[] = [];
          if (bsl.length) levels.push({ type: "BSL", price: bsl[0], y: ps.priceToCoordinate(bsl[0]) });
          if (ssl.length) levels.push({ type: "SSL", price: ssl[0], y: ps.priceToCoordinate(ssl[0]) });
          levels.push({ type: "Current", price: cur, y: ps.priceToCoordinate(cur) });

          // Get pane position for absolute coordinates
          const el = document.querySelector(".chart-markup-table");
          const rect = el?.getBoundingClientRect();

          return { levels, paneTop: rect?.top || 0, paneLeft: rect?.left || 0 };
        } catch { return null; }
      });

      if (coords && coords.levels) {
        for (const lvl of coords.levels) {
          if (lvl.y === null) continue;
          await tv.keyboardPress("Alt+h");
          await new Promise(r => setTimeout(r, 1200));
          await tv.mouseClick(coords.paneLeft + 200, coords.paneTop + lvl.y);
          await new Promise(r => setTimeout(r, 1000));
          result.levels.push(lvl);
          log(`Drawn ${lvl.type} at ${lvl.price}`);
        }
      }
    }

    if (action === "fvgs" || action === "all") {
      // Compute and draw FVG boxes
      const fvgData = await tv.evaluate(() => {
        try {
          const cw = window._exposed_chartWidgetCollection._chartWidgetsDefs[0].chartWidget;
          const pane = cw.model().model().mainPane();
          const ps = pane.defaultPriceScale();
          const ts = cw.model().timeScale();
          const src = window._exposed_chartWidgetCollection.activeChartWidget._value
            ._paneWidgets._value[0]._legendWidget._mainSeriesViewModel._source;
          const items = src.bars()._items.map((i: any) => i.value);
          const r = items.slice(-40);
          const fvgs: any[] = [];
          for (let i = 1; i < r.length - 1; i++) {
            const p = r[i - 1], n = r[i + 1];
            if (n[3] > p[2]) {
              const top = n[3], bottom = p[2];
              if (top - bottom > 1) fvgs.push({ top, bottom, x: ts.timeToCoordinate(r[i][0]), yTop: ps.priceToCoordinate(top), yBottom: ps.priceToCoordinate(bottom) });
            }
            if (n[2] < p[3]) {
              const top = p[3], bottom = n[2];
              if (top - bottom > 1) fvgs.push({ top, bottom, x: ts.timeToCoordinate(r[i][0]), yTop: ps.priceToCoordinate(top), yBottom: ps.priceToCoordinate(bottom) });
            }
          }
          const rect = document.querySelector(".chart-markup-table")?.getBoundingClientRect();
          return { fvgs: fvgs.slice(-3), paneLeft: rect?.left || 0, paneTop: rect?.top || 0 };
        } catch { return null; }
      });

      if (fvgData && fvgData.fvgs) {
        for (const f of fvgData.fvgs) {
          if (f.yTop === null || f.yBottom === null || f.x === null) continue;

          await tv.keyboardPress("Alt+Shift+r");
          await new Promise(r => setTimeout(r, 1200));

          // Draw rectangle spanning ~30px around the candle
          const span = 30;
          const cx = fvgData.paneLeft + f.x;
          await tv.mouseClick(cx - span, fvgData.paneTop + f.yTop);
          await new Promise(r => setTimeout(r, 600));
          await tv.mouseClick(cx + span, fvgData.paneTop + f.yBottom);
          await new Promise(r => setTimeout(r, 1500));
          result.fvgs.push(f);
          log(`Drawn FVG $${f.bottom.toFixed(2)} -> $${f.top.toFixed(2)}`);
        }
      }
    }

    if (action === "killzones" || action === "all") {
      // Draw session killzone boxes
      const kzData = await tv.evaluate(() => {
        try {
          const cw = window._exposed_chartWidgetCollection._chartWidgetsDefs[0].chartWidget;
          const pane = cw.model().model().mainPane();
          const ps = pane.defaultPriceScale();
          const ts = cw.model().timeScale();
          const src = window._exposed_chartWidgetCollection.activeChartWidget._value
            ._paneWidgets._value[0]._legendWidget._mainSeriesViewModel._source;
          const items = src.bars()._items.map((i: any) => i.value);

          function getZone(time: number): string {
            const d = new Date(time * 1000);
            const mins = d.getUTCHours() * 60 + d.getUTCMinutes();
            if (mins >= 0 && mins < 540) return "asian";
            if (mins >= 420 && mins < 960) return "london";
            if (mins >= 720 && mins < 1260) return "ny";
            return "other";
          }

          const firstIdx = Math.max(0, items.length - 100);
          const zones: any[] = [];
          let curZone: string | null = null;
          let blockStart: number | null = null;

          for (let i = firstIdx; i < items.length; i++) {
            const z = getZone(items[i][0]);
            if (z !== curZone) {
              if (curZone !== null && blockStart !== null) {
                zones.push({ zone: curZone, startX: ts.timeToCoordinate(blockStart), endX: ts.timeToCoordinate(items[i - 1][0]) });
              }
              curZone = z;
              blockStart = items[i][0];
            }
          }
          if (curZone !== null && blockStart !== null && curZone !== "other") {
            zones.push({ zone: curZone, startX: ts.timeToCoordinate(blockStart), endX: ts.timeToCoordinate(items[items.length - 1][0]) });
          }

          const rect = document.querySelector(".chart-markup-table")?.getBoundingClientRect();
          return { zones: zones.filter((z: any) => z.zone !== "other" && z.startX !== null && z.endX !== null), paneTop: rect?.top || 0, paneLeft: rect?.left || 0 };
        } catch { return null; }
      });

      if (kzData && kzData.zones) {
        for (const z of kzData.zones) {
          await tv.keyboardPress("Alt+Shift+r");
          await new Promise(r => setTimeout(r, 1200));

          await tv.mouseClick(kzData.paneLeft + z.startX, kzData.paneTop + 5);
          await new Promise(r => setTimeout(r, 600));
          await tv.mouseClick(kzData.paneLeft + z.endX, kzData.paneTop + 500);
          await new Promise(r => setTimeout(r, 1500));
          log(`Drawn ${z.zone} killzone`);
        }
      }
    }

    await tv.keyboardPress("Escape");
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;


// ─── GET /api/agent-loop/news — Fetch news for a symbol ───────────────────

router.get("/agent-loop/news", async (req: Request, res: Response): Promise<void> => {
  const { symbol, limit } = req.query as { symbol?: string; limit?: string };
  if (!symbol) {
    res.status(400).json({ error: "symbol query param is required" });
    return;
  }
  try {
    const articles = await newsFetcher.fetchNews(symbol, limit ? parseInt(limit) : 5);
    res.json({ articles });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/agent-loop/news/macro — Fetch macro events ──────────────────

router.get("/agent-loop/news/macro", async (_req: Request, res: Response): Promise<void> => {
  try {
    const events = await newsFetcher.fetchMacroEvents(10);
    res.json({ events });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/agent-loop/similar-setups — Find similar past setups ───────

router.post("/agent-loop/similar-setups", async (req: Request, res: Response): Promise<void> => {
  const { symbol, setupType, marketRegime, limit } = req.body as {
    symbol?: string; setupType?: string; marketRegime?: string; limit?: number;
  };
  try {
    const results = await qdrantMemory.findSimilar(
      { symbol, setupType, marketRegime },
      limit || 10,
    );
    res.json({ results });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/agent-loop/qdrant-status — Qdrant health check ──────────────

router.get("/agent-loop/qdrant-status", async (_req: Request, res: Response): Promise<void> => {
  try {
    const health = await qdrantMemory.health();
    res.json(health);
  } catch {
    res.json({ connected: false, collections: [] });
  }
});

// ─── GET /api/agent-loop/news-context — Formatted news for LLM ────────────

router.get("/agent-loop/news-context", async (req: Request, res: Response): Promise<void> => {
  const { symbol } = req.query as { symbol?: string };
  if (!symbol) {
    res.status(400).json({ error: "symbol query param is required" });
    return;
  }
  try {
    const context = await buildNewsContext(symbol);
    res.json({ context });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
