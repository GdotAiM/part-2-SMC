/**
 * TradingView Desktop — Unified MCP Tool Registration
 *
 * Registers all ~80 TradingView Desktop tools with the FastMCP server.
 * Tools are organized by domain, sourced from each domain module.
 *
 * Only registers tools when TV integration is enabled in config.
 * Attempts auto-connect on first tool execution.
 */

import type { FastMCP } from "fastmcp";
import { z } from "zod";
import { logger } from "../../logger.js";
import { connect, isConnected } from "./core/connection.js";

import { chartTools } from "./chart.js";
import { drawingTools } from "./drawing.js";
import { dataTools } from "./data.js";
import { alertTools } from "./alerts.js";
import { indicatorTools } from "./indicators.js";
import { paneTools } from "./pane.js";
import { replayTools } from "./replay.js";
import { tabTools } from "./tab.js";
import { uiTools } from "./ui.js";
import { pineTools } from "./pine.js";
import { captureTools } from "./capture.js";
import { watchlistTools } from "./watchlist.js";
import { healthTools } from "./health.js";

export interface ToolDef {
  name: string;
  description: string;
  parameters: z.ZodObject<any>;
  execute: (args: any) => Promise<any>;
}

// ─── All tools by category ───────────────────────────────────────────────

const allToolSets: { category: string; tools: ToolDef[] }[] = [
  { category: "Chart", tools: chartTools },
  { category: "Drawing", tools: drawingTools },
  { category: "Data", tools: dataTools },
  { category: "Alerts", tools: alertTools },
  { category: "Indicators", tools: indicatorTools },
  { category: "Pane/Layout", tools: paneTools },
  { category: "Replay", tools: replayTools },
  { category: "Tabs", tools: tabTools },
  { category: "UI", tools: uiTools },
  { category: "Pine Script", tools: pineTools },
  { category: "Capture", tools: captureTools },
  { category: "Watchlist", tools: watchlistTools },
  { category: "Health", tools: healthTools },
];

// ─── Tool definitions for tool-registry (agent loop path) ────────────────

export function getAllToolDefs(): ToolDef[] {
  return allToolSets.flatMap(ts => ts.tools);
}

/**
 * Register all TV Desktop tools with the FastMCP server.
 * Also attempts a lazy connection on first call if TV is enabled.
 */
export function registerAllDesktopTools(server: FastMCP): void {
  let registeredCount = 0;

  for (const { category, tools } of allToolSets) {
    for (const tool of tools) {
      const { name, description, parameters, execute } = tool;

      server.addTool({
        name,
        description,
        parameters,
        execute: async (args) => {
          try {
            // Lazy connect — first tool call triggers CDP connection
            if (!(await isConnected())) {
              const ok = await connect();
              if (!ok && name !== "tv_health" && name !== "tv_connect") {
                return {
                  content: [{
                    type: "text",
                    text: JSON.stringify({
                      error: "TradingView Desktop not reachable. Launch TV Desktop with --remote-debugging-port=9222 first, or call tv_connect to retry.",
                    }),
                  }],
                };
              }
            }
            const result = await execute(args);
            return {
              content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
            };
          } catch (err: any) {
            logger.error({ err: err.message, tool: name }, "TV Desktop tool failed");
            return {
              content: [{ type: "text", text: JSON.stringify({ error: err.message }) }],
              isError: true,
            };
          }
        },
      });

      registeredCount++;
    }
  }

  logger.info({ toolCount: registeredCount }, "TradingView Desktop tools registered with FastMCP");
}
