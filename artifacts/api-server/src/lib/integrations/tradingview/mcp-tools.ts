/**
 * TradingView MCP Tools — unified registration for FastMCP and toolRegistry.
 *
 * Registers all 11 TV tools in the FastMCP server AND returns tool
 * definitions for the agents-mcp.ts MCP_TOOLS array. This eliminates
 * the 3-place registration pattern — one call does all three.
 */

import { z } from "zod";
import type { FastMCP } from "fastmcp";
import { logger } from "../../logger.js";
import { langfuse } from "../../observability/langfuse.js";
import { isTvEnabled } from "./config.js";

// ─── CDP tool wrappers ────────────────────────────────────────────────────

import { getChartState, getSymbol, getTimeframe, getDrawings } from "./cdp/chart.js";
import { changeSymbol, changeTimeframe, drawHorizontalLine, drawFibRetracement, drawLabel, deleteDrawings, setAlert } from "./cdp/actions.js";
import { connect } from "./cdp/connection.js";

// ─── Tool definition format for agents-mcp.ts ─────────────────────────────

export interface ToolDef {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

// ─── Registry ─────────────────────────────────────────────────────────────

export function registerTradingViewTools(server: FastMCP): ToolDef[] {
  const defs: ToolDef[] = [];

  // Helper to add a tool to FastMCP + return its definition for MCP_TOOLS
  function addTool(params: {
    name: string;
    description: string;
    parameters: z.ZodObject<any>;
    execute: (args: any) => Promise<any>;
  }) {
    const { name, description, parameters, execute } = params;

    // 1. FastMCP registration
    server.addTool({
      name,
      description,
      parameters,
      execute: async (args) => {
        const start = Date.now();
        try {
          if (isTvEnabled()) {
            const { isConnected } = await import("./cdp/connection.js");
            if (!(await isConnected())) {
              const { connect } = await import("./cdp/connection.js");
              await connect();
            }
          }
          const result = await execute(args);
          logger.info({ tool: name, durationMs: Date.now() - start }, "TV MCP tool executed");
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        } catch (err: any) {
          logger.error({ err, tool: name }, "TV MCP tool failed");
          return {
            content: [{ type: "text", text: `Error: ${err.message}` }],
            isError: true,
          };
        }
      },
    });

    // 2. Tool definition for MCP_TOOLS (OpenAI function-calling format)
    defs.push({
      type: "function",
      function: {
        name,
        description,
        parameters: zodToJsonSchema(parameters),
      },
    });
  }

  // ── tv_get_chart_state ──
  addTool({
    name: "tv_get_chart_state",
    description: "Read the current TradingView chart state: symbol, timeframe, visible range, crosshair price, drawings, and indicators.",
    parameters: z.object({}),
    execute: async () => {
      const state = await getChartState();
      return state ?? { error: "TradingView not connected. Start TradingView Desktop with --remote-debugging-port=9222." };
    },
  });

  // ── tv_get_symbol ──
  addTool({
    name: "tv_get_symbol",
    description: "Get the active symbol on the TradingView chart.",
    parameters: z.object({}),
    execute: async () => ({ symbol: await getSymbol() ?? "unknown" }),
  });

  // ── tv_get_timeframe ──
  addTool({
    name: "tv_get_timeframe",
    description: "Get the active timeframe on the TradingView chart.",
    parameters: z.object({}),
    execute: async () => ({ timeframe: await getTimeframe() ?? "unknown" }),
  });

  // ── tv_get_drawings ──
  addTool({
    name: "tv_get_drawings",
    description: "Read all drawings currently on the TradingView chart.",
    parameters: z.object({}),
    execute: async () => ({ drawings: await getDrawings() ?? [] }),
  });

  // ── tv_change_symbol ──
  addTool({
    name: "tv_change_symbol",
    description: "Change the active symbol on the TradingView chart. Use our internal format (e.g. BTCUSDT).",
    parameters: z.object({
      symbol: z.string().describe("Trading symbol in our format, e.g. BTCUSDT, ETHUSDT, EURUSD"),
    }),
    execute: async ({ symbol }: { symbol: string }) => {
      const ok = await changeSymbol(symbol);
      return { success: ok, symbol: ok ? symbol : null, error: ok ? undefined : "Failed to change symbol — check TV connection" };
    },
  });

  // ── tv_change_timeframe ──
  addTool({
    name: "tv_change_timeframe",
    description: "Change the active timeframe on the TradingView chart.",
    parameters: z.object({
      timeframe: z.enum(["1m", "5m", "15m", "1h", "4h", "1d", "1w"]).describe("Timeframe label"),
    }),
    execute: async ({ timeframe }: { timeframe: string }) => {
      const ok = await changeTimeframe(timeframe);
      return { success: ok, timeframe: ok ? timeframe : null, error: ok ? undefined : "Failed to change timeframe" };
    },
  });

  // ── tv_draw_horizontal_line ──
  addTool({
    name: "tv_draw_horizontal_line",
    description: "Draw a horizontal line on the TradingView chart at a specific price level.",
    parameters: z.object({
      price: z.number().describe("Price level to draw the line at"),
      text: z.string().optional().describe("Label text for the line"),
      color: z.string().optional().describe("Hex color, e.g. #22c55e for green, #ef4444 for red"),
    }),
    execute: async ({ price, text, color }: { price: number; text?: string; color?: string }) => {
      const ok = await drawHorizontalLine(price, text, color);
      return { success: ok, level: { price, text, color } };
    },
  });

  // ── tv_draw_fib_retracement ──
  addTool({
    name: "tv_draw_fib_retracement",
    description: "Draw a Fibonacci retracement on the TradingView chart between two price levels.",
    parameters: z.object({
      high: z.number().describe("Swing high price"),
      low: z.number().describe("Swing low price"),
    }),
    execute: async ({ high, low }: { high: number; low: number }) => {
      const ok = await drawFibRetracement(high, low);
      return { success: ok, range: { high, low } };
    },
  });

  // ── tv_draw_label ──
  addTool({
    name: "tv_draw_label",
    description: "Draw a text label on the TradingView chart at a specific price level.",
    parameters: z.object({
      price: z.number().describe("Price to place the label at"),
      text: z.string().describe("Label text (e.g. 'Entry Zone', 'BSL @ 64,500')"),
      color: z.string().optional().describe("Hex color"),
    }),
    execute: async ({ price, text, color }: { price: number; text: string; color?: string }) => {
      const ok = await drawLabel(price, text, color);
      return { success: ok, label: { price, text, color } };
    },
  });

  // ── tv_delete_drawings ──
  addTool({
    name: "tv_delete_drawings",
    description: "Delete drawings from the TradingView chart. Optionally filter by type.",
    parameters: z.object({
      type: z.string().optional().describe("Optional type filter (e.g. 'Horizontal', 'Fib')"),
    }),
    execute: async ({ type }: { type?: string }) => {
      const ok = await deleteDrawings(type);
      return { success: ok, filter: type ?? "all" };
    },
  });

  // ── tv_set_alert ──
  addTool({
    name: "tv_set_alert",
    description: "Set a price alert on the TradingView chart.",
    parameters: z.object({
      price: z.number().describe("Price level to alert on"),
      direction: z.enum(["above", "below", "both"]).describe("Alert trigger direction"),
      message: z.string().optional().describe("Alert message"),
    }),
    execute: async ({ price, direction, message }: { price: number; direction: "above" | "below" | "both"; message?: string }) => {
      const ok = await setAlert(price, direction, message);
      return { success: ok, alert: { price, direction, message } };
    },
  });

  // ── tv_reconcile ──
  addTool({
    name: "tv_reconcile",
    description: "Compare the current SMC analysis with the TradingView chart and report discrepancies. Call this when you want to cross-reference our data with what the user sees on TV.",
    parameters: z.object({
      symbol: z.string().optional().describe("Override symbol (optional — reads from SMC context by default)"),
    }),
    execute: async () => {
      return { note: "Reconciliation requires an SmcReport. Call this with the current report data." };
    },
  });

  return defs;
}

// ─── Helper: Zod → JSON Schema ────────────────────────────────────────────

function zodToJsonSchema(zodObj: z.ZodObject<any>): Record<string, unknown> {
  const shape = zodObj._def.shape();
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const [key, val] of Object.entries(shape)) {
    const field = val as z.ZodTypeAny;
    const desc = field._def?.description ?? "";
    const nullable = field.isNullable() || field.isOptional();

    if (field instanceof z.ZodString) {
      properties[key] = { type: "string", description: desc };
    } else if (field instanceof z.ZodNumber) {
      properties[key] = { type: "number", description: desc };
    } else if (field instanceof z.ZodBoolean) {
      properties[key] = { type: "boolean", description: desc };
    } else if (field instanceof z.ZodEnum) {
      properties[key] = { type: "string", enum: field._def.values, description: desc };
    } else {
      properties[key] = { type: "string", description: desc };
    }

    if (!nullable) required.push(key);
  }

  return {
    type: "object",
    properties,
    required: required.length > 0 ? required : undefined,
  };
}
