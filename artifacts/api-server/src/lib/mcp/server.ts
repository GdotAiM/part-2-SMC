/**
 * SMC Pulse Predict — MCP Server Factory
 *
 * Creates a FastMCP server that wraps the SMC engine, candle store, and
 * real-time pipeline as MCP tools, resources, and prompts. Runs in-process
 * with the Express API server on the same port via HTTP streaming transport.
 */

import { FastMCP } from "fastmcp";
import { registerStructureTool } from "./tools/structure.js";
import { registerLiquidityTool } from "./tools/liquidity.js";
import { registerOrderBlocksTool } from "./tools/order-blocks.js";
import { registerFvgTool } from "./tools/fvg.js";
import { registerPdArrayTool } from "./tools/pd-array.js";
import { registerDailyBiasTool } from "./tools/daily-bias.js";
import { registerSmtTool } from "./tools/smt.js";
import { registerDrawTargetsTool } from "./tools/draw-targets.js";
import { registerFullReportTool } from "./tools/full-report.js";
import { registerLiveCandlesTool } from "./tools/live-candles.js";
import { registerScanAllTool } from "./tools/scan-all.js";
import { registerCandleResource } from "./resources/candles.js";
import { registerStatusResource } from "./resources/status.js";
import { registerSmcAnalysisPrompt } from "./prompts/analysis.js";
import { registerTradingViewTools } from "../integrations/tradingview/mcp-tools.js";
import { registerAllDesktopTools } from "../integrations/tradingview-desktop/register-all.js";

export function createSmcMcpServer(): FastMCP {
  const server = new FastMCP({
    name: "SMC Pulse Predict — Liquidity Hunter",
    version: "1.0.0",
  });

  // ── Tools (11) ────────────────────────────────────────────────────────────
  registerStructureTool(server);
  registerLiquidityTool(server);
  registerOrderBlocksTool(server);
  registerFvgTool(server);
  registerPdArrayTool(server);
  registerDailyBiasTool(server);
  registerSmtTool(server);
  registerDrawTargetsTool(server);
  registerFullReportTool(server);
  registerLiveCandlesTool(server);
  registerScanAllTool(server);

  // ── TV Desktop Tools (~80+) ────────────────────────────────────────────────
  // Replaces the old web-mode TV tools with the full Desktop-native surface.
  // Uses chrome-remote-interface to connect to TV Desktop's CDP port and
  // accesses the internal window.TradingViewApi for reliable drawing, data,
  // alerts, indicators, replay, Pine Script, tabs, UI, and more.
  registerAllDesktopTools(server);

  // Legacy web-mode TV tools (keep for backward compatibility for now)
  registerTradingViewTools(server);

  // ── Resources (2) ─────────────────────────────────────────────────────────
  registerCandleResource(server);
  registerStatusResource(server);

  // ── Prompts (1) ───────────────────────────────────────────────────────────
  registerSmcAnalysisPrompt(server);

  return server;
}
