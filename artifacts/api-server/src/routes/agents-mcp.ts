/**
 * MCP-Aware AI Agent Endpoint
 *
 * POST /api/agents/ask-mcp
 *
 * Instead of injecting a 3K-token system prompt with pre-computed SmcReport data,
 * this endpoint gives the AI a minimal system prompt (~200 tokens) and a list of
 * MCP tools. The AI decides which tools to call, gets live data on demand, and
 * can chain multiple tool calls for iterative reasoning.
 *
 * Token savings: ~15× for simple queries, ~5× for complex analyses.
 */

import { Router, type IRouter } from "express";
import type { Request, Response } from "express";
import { toolRegistry } from "../lib/mcp/tool-registry.js";
import { logger } from "../lib/logger.js";
import { resolveLlmConfig } from "../lib/llm/provider.js";

const router: IRouter = Router();

// ── System prompt builder (includes dashboard context when available) ────────

function buildMcpSystemPrompt(context?: { symbol?: string; timeframe?: string; currentPrice?: number }): string {
  let prompt = `You are an expert SMC (Smart Money Concepts) and ICT analyst with access to live market analysis tools.

CRITICAL RULES:
1. CALL TOOLS FIRST — do not explain what you're planning to do, just do it. Call the tools immediately, then synthesize the results into your response.
2. If a tool returns insufficient data (e.g. not enough candles), immediately try another timeframe or tool without narrating the fallback plan.
3. When you need multiple data points (bias + liquidity + targets), call all needed tools in a single parallel batch.
4. Only describe your approach AFTER you have the data, as part of your final synthesis.

Available tools:
[SMC Analysis] analyze_structure, analyze_liquidity, analyze_order_blocks, analyze_fvg, analyze_pd_array, get_daily_bias, detect_smt, get_draw_targets, build_full_report, get_live_candles, scan_all_timeframes
[Chart Control] tv_chart_get_state, tv_chart_set_symbol, tv_chart_set_timeframe
[Chart Drawing] tv_draw_shape
[TV Data] tv_data_get_ohlcv, tv_data_get_quote, tv_data_get_depth
[TV UI] tv_ui_click, tv_ui_find_element, tv_ui_open_panel, tv_ui_keyboard
[TV Comparison] read_tv_indicator_levels, compare_engine_vs_tv, get_reliability_report, evaluate_outcomes`;

  if (context?.symbol) {
    const parts = [`\n\nDASHBOARD CONTEXT (the user is currently viewing this market):`];
    parts.push(`- Symbol: ${context.symbol}`);
    if (context.timeframe) parts.push(`- Timeframe: ${context.timeframe}`);
    if (context.currentPrice != null) parts.push(`- Current Price: ${context.currentPrice}`);
    parts.push(`\nIf the user asks a question without specifying a symbol or timeframe, DEFAULT to the dashboard context above. For example, if they ask "where are institutions likely sitting?", they mean ${context.symbol} on the ${context.timeframe ?? "current"} timeframe.`);
    prompt += parts.join("\n");
  }

  prompt += `\n\nADDITIONAL SYSTEM CAPABILITIES (available as tools below):
- TradingView Desktop CDP connection — connect to the user's local TV Desktop, check connection status
- Pine indicator level reading — read horizontal lines from any indicator on the TV chart (LuxAlgo, custom Pine scripts, etc.), auto-classified into OB/FVG/BOS/CHoCH/liquidity/SMT types
- Comparison Engine — cross-reference TV indicator levels against the internal SMC engine, get agreement rates, price discrepancies, and confidence gaps per detection type
- Reliability scoring — per-type reliability tracking (engine vs TV) with trend data
- Outcome evaluation — check forward price action to see which source was correct
- Truth Engine arbitration — single authoritative verdict when TV and engine disagree

FULL TRADINGVIEW DESKTOP CAPABILITIES (70+ tools across 13 categories):

1. CHART CONTROL (8 tools): tv_chart_get_state (read symbol/timeframe/indicators), tv_chart_set_symbol (change symbol), tv_chart_set_timeframe (change timeframe), tv_chart_set_type (Candles/Line/Area/HeikinAshi/Renko/etc), tv_chart_visible_range (get/set visible date range), tv_chart_scroll_to_date, tv_chart_symbol_info (full symbol details), tv_chart_symbol_search (search symbols by name)

2. DRAWING (6 tools): tv_draw_shape (draw horizontal_line, trend_line, fib_retracement, rectangle, ray, text, arrows, pitchfork, gann_fan, signal, risk_reward, etc. at specific time/price), tv_draw_list (list all drawings), tv_draw_get_properties (inspect drawing), tv_draw_remove (remove one), tv_draw_clear_all (remove all)

3. DATA READING (10 tools): tv_data_get_ohlcv (extract OHLCV bars), tv_data_get_quote (real-time quote with bid/ask), tv_data_get_depth (DOM/order book), tv_data_get_indicator_values (read all indicator values), tv_data_get_pine_lines (read Pine Script horizontal lines), tv_data_get_pine_labels (read Pine labels), tv_data_get_pine_boxes (read Pine box zones), tv_data_get_pine_tables (read Pine table data), tv_data_get_strategy_results (backtest metrics: profit factor, Sharpe, drawdown, win rate), tv_data_get_trades (individual trade list from backtest), tv_data_get_equity (equity curve)

4. ALERTS (3 tools): tv_alert_create (set price alerts with crossing/above/below conditions), tv_alert_list (list all active alerts), tv_alert_delete (remove alerts)

5. INDICATORS (3 tools): tv_indicator_add (add any indicator by name), tv_indicator_remove, tv_indicator_get (inspect indicator inputs/values)

6. PANE/LAYOUT (4 tools): tv_pane_get_layout (read multi-pane layout), tv_pane_set_layout (split into 1-4 panes), tv_pane_focus (switch active pane), tv_pane_set_symbol (set symbol in a specific pane)

7. REPLAY MODE (6 tools): tv_replay_start (from a date), tv_replay_stop, tv_replay_autoplay (set speed), tv_replay_step_forward, tv_replay_trade (buy/sell/close in replay!), tv_replay_get_status

8. TABS (3 tools): tv_tab_get (list chart tabs), tv_tab_switch (switch tab), tv_tab_close (close tab)

9. UI AUTOMATION (11 tools): tv_ui_click (click any UI element by aria-label, data-name, or text — can click buy/sell buttons!), tv_ui_open_panel (open/close pine-editor, strategy-tester, watchlist, alerts, trading panel), tv_ui_fullscreen, tv_ui_keyboard (keyboard shortcuts), tv_ui_type_text (type into focused input), tv_ui_hover (hover over elements), tv_ui_scroll (scroll chart), tv_ui_mouse_click (click at viewport coordinates), tv_ui_find_element (find UI elements by text/CSS/aria), tv_ui_evaluate (execute custom JavaScript), tv_ui_layout_list/switch (saved layouts)

10. PINE SCRIPT (10 tools): tv_pine_get_source, tv_pine_set_source, tv_pine_compile, tv_pine_publish, tv_pine_get_library, tv_pine_get_info, tv_pine_create_template, tv_pine_get_templates, tv_pine_load_template, tv_pine_save_template

11. CAPTURE (1 tool): tv_capture_screenshot (screenshot the chart area)

12. WATCHLIST (3 tools): tv_watchlist_get, tv_watchlist_add, tv_watchlist_remove

13. HEALTH (2 tools): tv_health (ping), tv_connect (reconnect)

KEY INSIGHT ABOUT TRADING:
- This system has an Alpaca Paper Trading integration configured via ALPACA_API_KEY env vars — trades execute through Alpaca, not TV.
- HOWEVER, since we have tv_ui_click and tv_ui_find_element, if the user has signed into their TradingView paper trading account and opened the Trading Panel (via tv_ui_open_panel "trading"), we can find and click the buy/sell buttons on TV's UI to execute paper trades directly through TradingView. Use tv_ui_find_element to locate the button, then tv_ui_click to press it.
- There is also tv_replay_trade for trading in replay/backtesting mode (buy/sell/close).

CRITICAL: When the user asks about TV chart reading, indicator comparison, LuxAlgo, or cross-referencing levels, DO NOT say you cannot do it. Use the tools below — they are exactly what the system is built for. Call tv_connect first to ensure connection, then use read_tv_indicator_levels and compare_engine_vs_tv.

When the user asks if the system can execute trades on TradingView, explain both options:
1. Alpaca paper trading (if keys are configured) — fully automated via the execution manager
2. TV UI clicking — if they're signed into their TV paper account and the Trading Panel is open, you can click the buy/sell buttons via tv_ui_click

Always cite specific price levels from tool results. Do not give financial advice or buy/sell signals. Synthesize in 3-6 sentences — don't list every number from every tool, highlight only the most actionable findings.`;
  return prompt;
}

// ── Tool definitions (OpenAI function-calling format) ─────────────────────────

const MCP_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "analyze_structure",
      description: "Analyze ICT market structure: pivots, BOS/CHoCH breaks, trend, bias, confidence, market phase.",
      parameters: {
        type: "object",
        properties: {
          symbol: { type: "string", description: "Trading symbol, e.g. BTCUSDT or EURUSD=X" },
          timeframe: { type: "string", enum: ["1m","5m","15m","1h","4h","1d","1w"] },
        },
        required: ["symbol", "timeframe"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "analyze_liquidity",
      description: "Scan liquidity pools: BSL, SSL, EQH, EQL with sweep probability.",
      parameters: {
        type: "object",
        properties: {
          symbol: { type: "string", description: "Trading symbol" },
          timeframe: { type: "string", enum: ["1m","5m","15m","1h","4h","1d","1w"] },
        },
        required: ["symbol", "timeframe"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "analyze_order_blocks",
      description: "Detect order blocks and breaker blocks with confidence scoring.",
      parameters: {
        type: "object",
        properties: {
          symbol: { type: "string", description: "Trading symbol" },
          timeframe: { type: "string", enum: ["1m","5m","15m","1h","4h","1d","1w"] },
        },
        required: ["symbol", "timeframe"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "analyze_fvg",
      description: "Detect fair value gaps with fill fraction and inversion tracking.",
      parameters: {
        type: "object",
        properties: {
          symbol: { type: "string", description: "Trading symbol" },
          timeframe: { type: "string", enum: ["1m","5m","15m","1h","4h","1d","1w"] },
        },
        required: ["symbol", "timeframe"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "analyze_pd_array",
      description: "Analyze premium/discount array: dealing range, equilibrium, PD zones.",
      parameters: {
        type: "object",
        properties: {
          symbol: { type: "string", description: "Trading symbol" },
          timeframe: { type: "string", enum: ["1m","5m","15m","1h","4h","1d","1w"] },
        },
        required: ["symbol", "timeframe"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_daily_bias",
      description: "Compute higher-timeframe (1D) bias with strength and evidence.",
      parameters: {
        type: "object",
        properties: {
          symbol: { type: "string", description: "Trading symbol" },
        },
        required: ["symbol"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "detect_smt",
      description: "Detect SMT divergence between two correlated symbols.",
      parameters: {
        type: "object",
        properties: {
          primarySymbol: { type: "string", description: "Primary symbol, e.g. BTCUSDT" },
          correlatedSymbol: { type: "string", description: "Correlated symbol, e.g. ETHUSDT" },
          timeframe: { type: "string", enum: ["1m","5m","15m","1h","4h","1d","1w"] },
        },
        required: ["primarySymbol", "correlatedSymbol", "timeframe"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_draw_targets",
      description: "Get ranked draw-on-liquidity targets with confluence scores.",
      parameters: {
        type: "object",
        properties: {
          symbol: { type: "string", description: "Trading symbol" },
          timeframe: { type: "string", enum: ["1m","5m","15m","1h","4h","1d","1w"] },
        },
        required: ["symbol", "timeframe"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "build_full_report",
      description: "Build complete SMC report across all 8 analysis dimensions.",
      parameters: {
        type: "object",
        properties: {
          symbol: { type: "string", description: "Trading symbol" },
          timeframe: { type: "string", enum: ["1m","5m","15m","1h","4h","1d","1w"] },
        },
        required: ["symbol", "timeframe"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_live_candles",
      description: "Get raw OHLCV candles from the real-time WebSocket pipeline.",
      parameters: {
        type: "object",
        properties: {
          symbol: { type: "string", description: "Trading symbol" },
          timeframe: { type: "string", enum: ["1m","5m","15m","1h","4h","1d","1w"] },
          limit: { type: "number", description: "Number of recent candles (1-300, default 20)" },
        },
        required: ["symbol", "timeframe"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "scan_all_timeframes",
      description: "Run SMC analysis across all 7 timeframes (M1→W1) for a symbol.",
      parameters: {
        type: "object",
        properties: {
          symbol: { type: "string", description: "Trading symbol" },
        },
        required: ["symbol"],
      },
    },
  },
  // ── TV Desktop / Learning Framework tools ───────────────────────────
  {
    type: "function" as const,
    function: {
      name: "tv_connect",
      description: "Connect to the user's local TradingView Desktop app via Chrome DevTools Protocol (CDP port 9222). Call this first before any other TV operations.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "tv_status",
      description: "Check the TradingView Desktop CDP connection status — connected or disconnected.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "read_tv_indicator_levels",
      description: "Read horizontal line levels from Pine Script indicators on the user's TradingView chart. This reads levels from ANY active indicator (LuxAlgo ICT tools, custom Pine scripts, etc.) and auto-classifies them into detection types (OB, FVG, BOS, CHOCH, LIQUIDITY_SWEEP, SMT, etc.). Returns classified detection points with prices.",
      parameters: {
        type: "object",
        properties: {
          indicatorName: { type: "string", description: "Optional: filter to a specific indicator name (case-insensitive, e.g. 'luxalgo', 'ict', 'order block'). Leave empty to read from ALL indicators." },
        },
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "compare_engine_vs_tv",
      description: "Cross-reference the internal SMC engine's detections against TV indicator levels (or provided detection points). Returns matched/unmatched levels, agreement rates, price discrepancies, confidence gaps, and the Truth Engine's arbitrated verdicts. Runs the full comparison pipeline.",
      parameters: {
        type: "object",
        properties: {
          symbol: { type: "string", description: "Trading symbol to analyze (e.g. BTCUSDT, EURUSD=X)" },
          timeframe: { type: "string", enum: ["1m","5m","15m","1h","4h","1d","1w"], description: "Timeframe to compare on" },
          market: { type: "string", enum: ["crypto", "forex"], description: "Market type" },
          indicatorName: { type: "string", description: "TV indicator name to read levels from (optional — auto-detects if left empty)" },
        },
        required: ["symbol", "timeframe", "market"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_reliability_report",
      description: "Get per-type reliability scores comparing the internal engine vs TV indicators across all detection types (OB, FVG, BOS, CHOCH, LIQUIDITY_SWEEP, SMT, etc.). Shows which source is more reliable for each detection type.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "evaluate_outcomes",
      description: "Take past comparisons and check forward price action to determine which source (TV or engine) was correct. Updates reliability scores with actual market outcomes.",
      parameters: {
        type: "object",
        properties: {
          symbol: { type: "string", description: "Trading symbol" },
          timeframe: { type: "string", enum: ["1m","5m","15m","1h","4h","1d","1w"] },
          market: { type: "string", enum: ["crypto", "forex"] },
          detectionType: { type: "string", description: "Optional: filter to a specific detection type" },
          limit: { type: "number", description: "Number of recent comparisons to evaluate (default 20, max 100)" },
        },
        required: ["symbol", "timeframe", "market"],
      },
    },
  },
  // ── TV Desktop UI tools (chart control, drawing, clicking) ──────────
  {
    type: "function" as const,
    function: {
      name: "tv_chart_set_symbol",
      description: "Change the active symbol on the TradingView chart. E.g. BTCUSDT, AAPL, EURUSD, BINANCE:ETHUSDT.",
      parameters: {
        type: "object",
        properties: {
          symbol: { type: "string", description: "Trading symbol to switch to, e.g. BTCUSDT, AAPL, EURUSD" },
        },
        required: ["symbol"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "tv_chart_set_timeframe",
      description: "Change the active timeframe on the TradingView chart.",
      parameters: {
        type: "object",
        properties: {
          timeframe: { type: "string", enum: ["1m","5m","15m","1h","4h","1d","1w"], description: "Timeframe to switch to" },
        },
        required: ["timeframe"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "tv_chart_get_state",
      description: "Read the full TradingView chart state: symbol, timeframe, chart type, and list of active indicators.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "tv_draw_shape",
      description: "Draw a shape on the TradingView chart at specified time/price. Supports: horizontal_line, trend_line, fib_retracement, rectangle, ray, text, arrow, signal, risk_reward, and many more.",
      parameters: {
        type: "object",
        properties: {
          shape: { type: "string", description: "Shape type: horizontal_line, trend_line, fib_retracement, rectangle, ray, text, arrow, signal, risk_reward" },
          time: { type: "number", description: "Time of the first point as Unix timestamp (seconds)" },
          price: { type: "number", description: "Price of the first point" },
          time2: { type: "number", description: "Optional: time of the second point (for trend_line, fib_retracement)" },
          price2: { type: "number", description: "Optional: price of the second point" },
          text: { type: "string", description: "Optional label/text" },
          color: { type: "string", description: "Optional hex color, e.g. #22c55e" },
        },
        required: ["shape", "time", "price"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "tv_ui_open_panel",
      description: "Open or close a TradingView panel. Panels: trading (to access buy/sell buttons), watchlist, alerts, pine-editor, strategy-tester.",
      parameters: {
        type: "object",
        properties: {
          panel: { type: "string", enum: ["trading", "watchlist", "alerts", "pine-editor", "strategy-tester"], description: "Panel name to open/close" },
          action: { type: "string", enum: ["open", "close", "toggle"], description: "Action (default: toggle)" },
        },
        required: ["panel"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "tv_ui_click",
      description: "Click a button or UI element on the TradingView interface. Can click buy/sell buttons, toolbar buttons, menu items, etc. Use tv_ui_find_element first to locate the element.",
      parameters: {
        type: "object",
        properties: {
          by: { type: "string", enum: ["aria-label", "data-name", "text", "class-contains"], description: "How to find the element: by aria-label, data-name attribute, visible text content, or class name" },
          value: { type: "string", description: "The value to match (e.g. 'Buy', 'Sell', 'Market', 'Trading Panel', 'Order type')" },
        },
        required: ["by", "value"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "tv_ui_find_element",
      description: "Find UI elements on the TradingView page by text content, CSS selector, or aria-label. Returns position, size, and visibility info so you can click them with tv_ui_click.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Text to search for (e.g. 'Buy', 'Sell', 'Market Order', 'Buy Market')" },
          strategy: { type: "string", enum: ["text", "css", "aria-label"], description: "Search strategy (default: text contains)" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "tv_ui_keyboard",
      description: "Send a keyboard shortcut to the TradingView page. E.g. key='s', modifiers=['ctrl'] for Ctrl+S.",
      parameters: {
        type: "object",
        properties: {
          key: { type: "string", description: "Key to press (e.g. 's', 'Enter', 'Escape', 'ArrowUp')" },
          modifiers: { type: "array", items: { type: "string", enum: ["alt", "ctrl", "meta", "shift"] }, description: "Optional modifier keys to hold" },
        },
        required: ["key"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "tv_data_get_quote",
      description: "Get a real-time quote for the current chart symbol. Returns last price, bid, ask, open, high, low, volume.",
      parameters: {
        type: "object",
        properties: {
          symbol: { type: "string", description: "Optional: symbol to get quote for (defaults to current chart)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "tv_data_get_depth",
      description: "Read the Depth of Market (DOM) / order book from TradingView if visible. Returns bid and ask levels with sizes, plus spread.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "tv_data_get_ohlcv",
      description: "READ THIS FIRST: Read OHLCV bar data from the current TradingView chart. IMPORTANT USAGE: After reading bars with this tool, call the 'analyze_from_tv_bars' tool to run SMC analysis on them. This is the only reliable way to get SMC analysis on this machine because the internal data pipeline (Binance/Yahoo) is DNS-blocked — TV Desktop is the only working data source.",
      parameters: {
        type: "object",
        properties: {
          count: { type: "number", description: "Number of recent bars to return (max 500, default 200)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "analyze_from_tv_bars",
      description: "CRITICAL: Run SMC analysis on bars read from the TradingView chart. Call tv_data_get_ohlcv first to read bars, then pass the bars to this tool. Returns a full SMC report (structure, liquidity, OBs, FVGs, PD array, daily bias, SMT, draw targets, narrative). This is the PRIMARY analysis path when Binance/Yahoo APIs are unreachable.",
      parameters: {
        type: "object",
        properties: {
          symbol: { type: "string", description: "Trading symbol, e.g. BTCUSDT" },
          timeframe: { type: "string", enum: ["1m","5m","15m","1h","4h","1d","1w"], description: "Timeframe of the bars" },
          market: { type: "string", enum: ["crypto", "forex"], description: "Market type" },
        },
        required: ["symbol", "timeframe", "market"],
      },
    },
  },
];

// ── Tool executor — routes tool calls to the tool registry ──────────────────

const API_BASE = `http://127.0.0.1:${process.env.PORT || "3001"}`;

async function executeToolCall(name: string, args: Record<string, unknown>): Promise<string> {
  // ── TV Desktop / Learning Framework tools (self-contained HTTP calls) ──
  try {
    switch (name) {
      case "tv_connect": {
        const resp = await fetch(`${API_BASE}/api/agent-loop/tv-connect`, { method: "POST", headers: { "Content-Type": "application/json" } });
        const data = await resp.json();
        return JSON.stringify(data);
      }
      case "tv_status": {
        const resp = await fetch(`${API_BASE}/api/agent-loop/tv-status`);
        const data = await resp.json();
        return JSON.stringify(data);
      }
      case "read_tv_indicator_levels": {
        // Use the dedicated HTTP endpoint which handles CDP connection internally
        const resp = await fetch(`${API_BASE}/api/learning/read-tv-indicator-levels`);
        const data = await resp.json();
        if (!data.connected) {
          // Try connecting TV first
          await fetch(`${API_BASE}/api/agent-loop/tv-connect`, { method: "POST", headers: { "Content-Type": "application/json" } });
          const retryResp = await fetch(`${API_BASE}/api/learning/read-tv-indicator-levels`);
          const retryData = await retryResp.json();
          return JSON.stringify(retryData);
        }
        // Apply indicator name filter if provided
        const indicatorName = (args.indicatorName as string) || "";
        let levels = data.levels || [];
        if (indicatorName) {
          const filter = indicatorName.toLowerCase();
          levels = levels.filter((l: any) => (l.indicator || "").toLowerCase().includes(filter));
        }
        return JSON.stringify({
          totalLevels: levels.length,
          indicatorFilter: indicatorName || "all indicators",
          indicatorsFound: data.indicatorsFound || [],
          byType: data.byType || {},
          levels: levels.slice(0, 50).map((l: any) => ({
            detectionType: l.detectionType,
            price: Math.round(l.price * 100000) / 100000,
            confidence: l.confidence,
            indicator: l.indicator,
            label: l.label || "",
          })),
        });
      }
      case "compare_engine_vs_tv": {
        // First read TV levels to ensure we have fresh data
        let tvLevels: any[] = [];
        try {
          const levelResp = await fetch(`${API_BASE}/api/learning/read-tv-indicator-levels`);
          const levelData = await levelResp.json();
          if (levelData.levels && levelData.levels.length > 0) {
            tvLevels = levelData.levels.map((l: any) => ({
              detectionType: l.detectionType,
              price: l.price,
              confidence: l.confidence,
              metadata: { indicator: l.indicator, label: l.label },
            }));
          }
        } catch (e) { /* levels read is best-effort */ }

        // Now run the full comparison with the TV levels
        const resp = await fetch(`${API_BASE}/api/learning/comparisons/analyze`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            symbol: args.symbol,
            timeframe: args.timeframe,
            market: args.market,
            indicatorName: args.indicatorName || "",
            tvDetections: tvLevels.length > 0 ? tvLevels : undefined,
          }),
        });
        const data = await resp.json();
        return JSON.stringify({
          comparisonsCount: data.comparisonsCount,
          metrics: data.metrics,
          tvLevelsRead: tvLevels.length,
          fusedDecisions: data.fusedDecisions?.slice(0, 10),
          arbitratedMarketView: data.arbitratedMarketView,
          report: data.report,
        });
      }
      case "get_reliability_report": {
        const resp = await fetch(`${API_BASE}/api/learning/reliability`);
        const data = await resp.json();
        return JSON.stringify({
          inMemory: data.inMemory,
          database: data.database?.slice(0, 30),
        });
      }
      case "evaluate_outcomes": {
        // Fetch recent comparisons for this symbol/timeframe
        const compResp = await fetch(`${API_BASE}/api/learning/comparisons?symbol=${args.symbol}&timeframe=${args.timeframe}&limit=${args.limit || 20}`);
        const compData = await compResp.json();
        const comps: any[] = compData.comparisons || [];
        if (comps.length === 0) return JSON.stringify({ outcomes: [], message: "No comparisons found to evaluate" });
        const resp = await fetch(`${API_BASE}/api/learning/evaluate-outcomes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            comparisonIds: comps.map((c: any) => c.id),
            lookbackBars: 20,
          }),
        });
        const data = await resp.json();
        return JSON.stringify({
          outcomesCount: data.count,
          outcomes: data.outcomes?.slice(0, 20),
        });
      }
      // ── TV Desktop tools (CDP-based) ─────────────────────────────────
      case "tv_chart_get_state":
      case "tv_chart_set_symbol":
      case "tv_chart_set_timeframe":
      case "tv_draw_shape":
      case "tv_ui_open_panel":
      case "tv_ui_click":
      case "tv_ui_find_element":
      case "tv_ui_keyboard":
      case "tv_data_get_quote":
      case "tv_data_get_depth":
      case "tv_data_get_ohlcv":
      case "analyze_from_tv_bars": {
        // Ensure TV is connected first
        await fetch(`${API_BASE}/api/agent-loop/tv-connect`, { method: "POST", headers: { "Content-Type": "application/json" } });

        // Connect directly via CDP
        const CDP = (await import("chrome-remote-interface")).default;
        const targets = await fetch("http://127.0.0.1:9222/json/list").then(r => r.json());
        const target = targets.find((t: any) => t.type === "page" && /tradingview\.com\/chart/i.test(t.url));
        if (!target) return JSON.stringify({ error: "No TradingView chart page found" });

        const client = await CDP({ host: "127.0.0.1", port: 9222, target: target.id });
        await client.Runtime.enable();
        const E = async (expr: string) => {
          const r = await client.Runtime.evaluate({ expression: expr, returnByValue: true, awaitPromise: true });
          return r.result.value;
        };
        const eStr = (s: string) => JSON.stringify(s);

        let result: any;
        try {
          switch (name) {
            case "tv_chart_get_state":
              result = await E(`(function() {
                var api = window.TradingViewApi._activeChartWidgetWV.value();
                var studies = []; try { var all = api.getAllStudies(); studies = (all || []).map(function(s) { return { id: s.id, name: s.name || s.title || '?' }; }); } catch(e) {}
                return { symbol: api.symbol(), resolution: api.resolution(), chartType: api.chartType(), studies: studies };
              })()`);
              break;

            case "tv_chart_set_symbol":
              await E(`window.TradingViewApi._activeChartWidgetWV.value().setSymbol(${eStr(String(args.symbol))}, {})`);
              await new Promise(r => setTimeout(r, 2000));
              result = { success: true, symbol: args.symbol };
              break;

            case "tv_chart_set_timeframe":
              const tfMap: Record<string, string> = {"1m":"1","5m":"5","15m":"15","1h":"60","4h":"240","1d":"1D","1w":"1W"};
              const tvTf = tfMap[String(args.timeframe)] || String(args.timeframe);
              await E(`window.TradingViewApi._activeChartWidgetWV.value().setResolution(${eStr(tvTf)}, {})`);
              await new Promise(r => setTimeout(r, 1500));
              result = { success: true, timeframe: args.timeframe, resolved: tvTf };
              break;

            case "tv_draw_shape":
              const s = String(args.shape || "horizontal_line");
              const t = Number(args.time) || Math.floor(Date.now() / 1000);
              const p = Number(args.price) || 0;
              const t2 = args.time2 != null ? Number(args.time2) : null;
              const p2 = args.price2 != null ? Number(args.price2) : null;
              const overrides: any = {};
              if (args.color) overrides.color = args.color;
              const overStr = JSON.stringify(overrides);
              const txt = args.text ? eStr(String(args.text)) : '""';
              if (t2 && p2) {
                await E(`window.TradingViewApi._activeChartWidgetWV.value().createMultipointShape([{time:${t},price:${p}},{time:${t2},price:${p2}}],{shape:${eStr(s)},overrides:${overStr},text:${txt}})`);
              } else {
                await E(`window.TradingViewApi._activeChartWidgetWV.value().createShape({time:${t},price:${p}},{shape:${eStr(s)},overrides:${overStr},text:${txt}})`);
              }
              result = { success: true, shape: s };
              break;

            case "tv_ui_open_panel":
              result = await E(`(function() {
                var panel = ${eStr(String(args.panel))};
                var action = ${eStr(String(args.action || "toggle"))};
                var bwb = window.TradingView && window.TradingView.bottomWidgetBar;
                if (panel === 'pine-editor' || panel === 'strategy-tester') {
                  var widgetName = panel === 'pine-editor' ? 'pine-editor' : 'backtesting';
                  if (!bwb) return { error: 'bottomWidgetBar not available' };
                  if (action === 'open') { bwb.showWidget(widgetName); }
                  else if (action === 'close') { bwb.hideWidget(widgetName); }
                  else { var ba = document.querySelector('[class*="layout__area--bottom"]'); var isOpen = ba && ba.offsetHeight > 50; if (isOpen) bwb.hideWidget(widgetName); else bwb.showWidget(widgetName); }
                  return { success: true, panel: panel, action: action };
                }
                var sel = { trading: 'trading-button', watchlist: 'base-watchlist-widget-button', alerts: 'alerts-button' };
                var dn = sel[panel];
                if (!dn) return { error: 'Unknown panel: ' + panel };
                var btn = document.querySelector('[data-name="' + dn + '"]') || document.querySelector('[aria-label="' + panel.charAt(0).toUpperCase() + panel.slice(1) + '"]');
                if (!btn) return { error: 'Button not found for ' + panel };
                btn.click();
                return { success: true, panel: panel, action: 'toggled' };
              })()`);
              break;

            case "tv_ui_click":
              result = await E(`(function() {
                var by = ${eStr(String(args.by))};
                var value = ${eStr(String(args.value))};
                var el = null;
                if (by === 'aria-label') { el = document.querySelector('[aria-label="' + value.replace(/"/g,'\\\\"') + '"]'); if (!el) el = document.querySelector('[aria-label*="' + value.replace(/"/g,'\\\\"') + '"]'); }
                else if (by === 'data-name') el = document.querySelector('[data-name="' + value.replace(/"/g,'\\\\"') + '"]');
                else if (by === 'text') { var cs = document.querySelectorAll('button, a, [role="button"], [role="menuitem"]'); for (var i=0;i<cs.length;i++) { if (cs[i].textContent.trim() === value || cs[i].textContent.trim().toLowerCase() === value.toLowerCase()) { el=cs[i]; break; } } }
                else if (by === 'class-contains') el = document.querySelector('[class*="' + value.replace(/"/g,'\\\\"') + '"]');
                if (!el) return { found: false, error: 'Element not found: ' + by + '=' + value };
                el.click();
                return { found: true, tag: el.tagName.toLowerCase(), text: (el.textContent||'').trim().substring(0,80) };
              })()`);
              break;

            case "tv_ui_find_element":
              const query = String(args.query);
              const strategy = String(args.strategy || "text");
              const raw = await E(`(function() {
                var q = ${eStr(query)}; var strat = ${eStr(strategy)}; var r=[];
                if (strat === 'css') { var els=document.querySelectorAll(q); for(var i=0;i<Math.min(els.length,20);i++){ var rc=els[i].getBoundingClientRect(); r.push({tag:els[i].tagName.toLowerCase(),text:(els[i].textContent||'').trim().substring(0,80),aria_label:els[i].getAttribute('aria-label'),x:rc.x,y:rc.y,width:rc.width,height:rc.height,visible:els[i].offsetParent!==null}); } }
                else { var all=document.querySelectorAll('button,a,[role="button"],span,div,input'); for(var i=0;i<all.length;i++){ var t=(all[i].textContent||'').trim(); if(t.toLowerCase().indexOf(q.toLowerCase())!==-1&&t.length<200){ var rc=all[i].getBoundingClientRect(); if(rc.width>0&&rc.height>0){ r.push({tag:all[i].tagName.toLowerCase(),text:t.substring(0,80),aria_label:all[i].getAttribute('aria-label'),x:rc.x,y:rc.y,width:rc.width,height:rc.height,visible:all[i].offsetParent!==null}); if(r.length>=20) break; } } } }
                return r;
              })()`);
              result = { query, strategy, count: (raw || []).length, elements: raw || [] };
              break;

            case "tv_ui_keyboard":
              const k = String(args.key);
              const mods: string[] = (args.modifiers as string[]) || [];
              await client.Input.dispatchKeyEvent({ type: "keyDown", key: k, windowsVirtualKeyCode: k.toUpperCase().charCodeAt(0) });
              await client.Input.dispatchKeyEvent({ type: "keyUp", key: k });
              result = { success: true, key: k, modifiers: mods };
              break;

            case "tv_data_get_quote":
              result = await E(`(function() {
                var chart = window.TradingViewApi._activeChartWidgetWV.value()._chartWidget;
                var sym = ''; try { sym = chart.symbol(); } catch(e) {}
                var bars = chart.model().mainSeries().bars();
                var quote = { symbol: sym };
                if (bars && typeof bars.lastIndex === 'function') { var v = bars.valueAt(bars.lastIndex()); if (v) { quote.time=v[0]; quote.open=v[1]; quote.high=v[2]; quote.low=v[3]; quote.close=v[4]; quote.last=v[4]; quote.volume=v[5]||0; } }
                var hdr=document.querySelector('[class*="headerRow"] [class*="last-"]'); if(hdr){var hp=parseFloat(hdr.textContent.replace(/[^0-9.\\-]/g,'')); if(!isNaN(hp)) quote.header_price=hp;}
                return quote;
              })()`);
              break;

            case "tv_data_get_depth":
              result = await E(`(function() {
                var dom = document.querySelector('[class*="depth"],[class*="orderBook"],[class*="dom-"],[data-name="dom"]');
                if (!dom) return { found: false, error: 'DOM panel not found. Open Depth of Market panel first.' };
                var bids=[], asks=[]; var rows=dom.querySelectorAll('[class*="row"], tr');
                for(var i=0;i<rows.length;i++){ var pEl=rows[i].querySelector('[class*="price"]'); var sEl=rows[i].querySelector('[class*="size"],[class*="volume"]'); if(!pEl) continue; var pr=parseFloat(pEl.textContent.replace(/[^0-9.\\-]/g,'')); var sz=sEl?parseFloat(sEl.textContent.replace(/[^0-9.\\-]/g,'')):0; if(isNaN(pr)) continue; var rc=(rows[i].className||'')+(rows[i].innerHTML||''); if(/bid|buy/i.test(rc)) bids.push({price:pr,size:sz}); else if(/ask|sell/i.test(rc)) asks.push({price:pr,size:sz}); else if(i<rows.length/2) asks.push({price:pr,size:sz}); else bids.push({price:pr,size:sz}); }
                bids.sort(function(a,b){return b.price-a.price}); asks.sort(function(a,b){return a.price-b.price});
                var spread=asks.length&&bids.length?+(asks[0].price-bids[0].price).toFixed(6):null;
                return {found:true,bids:bids.slice(0,20),asks:asks.slice(0,20),spread:spread};
              })()`);
              break;

            case "tv_data_get_ohlcv": {
              const ohlcvLimit = Math.min((args.count as number) || 200, 500);
              const rawBars = await E(`(function() {
                var bars = window.TradingViewApi._activeChartWidgetWV.value()._chartWidget.model().mainSeries().bars();
                if (!bars || typeof bars.lastIndex !== 'function') return null;
                var result = []; var end = bars.lastIndex(); var start = Math.max(bars.firstIndex(), end - ${ohlcvLimit} + 1);
                for (var i = start; i <= end; i++) { var v = bars.valueAt(i); if (v) result.push({ time: v[0], open: v[1], high: v[2], low: v[3], close: v[4], volume: v[5] || 0 }); }
                return JSON.stringify(result);
              })()`);
              const parsedBars = rawBars ? JSON.parse(rawBars) : [];
              result = { bar_count: parsedBars.length, bars: parsedBars };
              break;
            }

            case "analyze_from_tv_bars": {
              // Uses GET /api/analysis/from-tv which handles everything:
              // connect TV, switch symbol/timeframe, read bars, run SMC report
              const tvSym = String(args.symbol || "BTCUSDT");
              const tvTf2 = String(args.timeframe || "15m");
              const tvMkt = String(args.market || (tvSym.includes("=X") ? "forex" : "crypto"));
              const resp2 = await fetch(`${API_BASE}/api/analysis/from-tv?symbol=${tvSym}&timeframe=${tvTf2}&market=${tvMkt}`);
              const data2 = await resp2.json();
              result = data2;
              break;
            }
          }
        } finally {
          await client.close();
        }
        return JSON.stringify(result || { error: "Tool returned no result" });
      }
    }
  } catch (err) {
    logger.error({ err, tool: name }, "Learning/TV tool execution failed");
    return JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" });
  }

  // ── Fallback: SMC tools from toolRegistry ───────────────────────────
  const fn = toolRegistry.get(name);
  if (!fn) {
    return JSON.stringify({ error: `Tool "${name}" not found. Available: ${[...toolRegistry.keys()].join(", ")}` });
  }
  try {
    return await fn(args);
  } catch (err) {
    logger.error({ err, tool: name }, "MCP tool execution failed");
    return JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" });
  }
}

// ── POST /api/agents/ask-mcp ──────────────────────────────────────────────────

router.post("/agents/ask-mcp", async (req: Request, res: Response): Promise<void> => {
  const { question, history = [], context } = req.body as {
    question: string;
    history?: Array<{ role: "user" | "assistant" | "tool"; content: string; tool_call_id?: string; tool_calls?: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }> }>;
    context?: { symbol?: string; timeframe?: string; currentPrice?: number };
  };

  if (!question || typeof question !== "string") {
    res.status(400).json({ error: "question is required" });
    return;
  }

  const llmConfig = resolveLlmConfig();
  if (!llmConfig.apiKey && llmConfig.provider !== "amd") {
    res.status(500).json({ error: "AI not configured — set FIREWORKS_API_KEY or LLM_API_KEY" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  const messages: Array<Record<string, unknown>> = [
    { role: "system", content: buildMcpSystemPrompt(context) },
    ...history.slice(-8),
    { role: "user", content: question },
  ];

  try {
    // ── Agent loop: AI can make multiple tool call rounds ──────────────────
    let maxRounds = 3; // prevent infinite loops
    let streamedContent = "";

    while (maxRounds-- > 0) {
      const response = await fetch(`${llmConfig.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(llmConfig.apiKey && llmConfig.apiKey !== "not-needed"
            ? { Authorization: `Bearer ${llmConfig.apiKey}` }
            : {}),
        },
        body: JSON.stringify({
          model: llmConfig.model,
          stream: true,
          max_tokens: 4096,
          messages: messages as Array<{ role: string; content: string }>,
          tools: MCP_TOOLS,
          tool_choice: "auto",
        }),
      });

      if (!response.ok || !response.body) {
        const text = await response.text();
        res.write(`data: ${JSON.stringify({ error: `AI error: ${response.status} ${text}` })}\n\n`);
        res.end();
        return;
      }

      // Parse the SSE stream, collecting content and tool calls
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantContent = "";
      const toolCalls: Array<{ id: string; name: string; arguments: string }> = [];
      let currentToolCall: { id: string; name: string; arguments: string } | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === "data: [DONE]") continue;
          if (!trimmed.startsWith("data: ")) continue;
          try {
            const json = JSON.parse(trimmed.slice(6));
            const delta = json.choices?.[0]?.delta;

            if (delta?.content) {
              assistantContent += delta.content;
              res.write(`data: ${JSON.stringify({ content: delta.content })}\n\n`);
              streamedContent += delta.content;
            }

            if (delta?.tool_calls) {
              for (const raw of delta.tool_calls) {
                const tc = raw as { id?: string; function?: { name?: string; arguments?: string } };
                if (tc.id) {
                  if (currentToolCall && currentToolCall.id !== tc.id) {
                    toolCalls.push({ ...currentToolCall });
                  }
                  const prevName: string = currentToolCall?.name ?? "";
                  currentToolCall = {
                    id: tc.id,
                    name: tc.function?.name ?? prevName,
                    arguments: tc.function?.arguments ?? "",
                  };
                } else if (tc.function?.arguments && currentToolCall) {
                  currentToolCall.arguments += tc.function.arguments;
                }
              }
            }
          } catch { /* skip malformed */ }
        }
      }
      // Push final tool call
      if (currentToolCall) {
        toolCalls.push(currentToolCall);
      }

      // If the model made tool calls, execute them and feed results back
      if (toolCalls.length > 0) {
        // Add assistant message with tool calls
        messages.push({
          role: "assistant",
          content: assistantContent || null,
          tool_calls: toolCalls.map(tc => ({
            id: tc.id,
            type: "function",
            function: { name: tc.name, arguments: tc.arguments },
          })),
        });

        // Execute each tool and add results
        for (const tc of toolCalls) {
          res.write(`data: ${JSON.stringify({ tool_start: tc.name })}\n\n`);

          let parsedArgs: Record<string, unknown> = {};
          try { parsedArgs = JSON.parse(tc.arguments); } catch { /* use empty */ }

          const result = await executeToolCall(tc.name, parsedArgs);

          res.write(`data: ${JSON.stringify({ tool_result: tc.name, content: result.slice(0, 200) + (result.length > 200 ? "..." : "") })}\n\n`);

          messages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: result,
          });

        }

        // Continue loop — AI will process tool results and respond
        continue;
      }

      // No tool calls — final response sent, done
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
      return;
    }

    // Max rounds exceeded
    res.write(`data: ${JSON.stringify({ done: true, note: "max tool-call rounds reached" })}\n\n`);
    res.end();
  } catch (err) {
    logger.error({ err }, "MCP agent ask failed");
    res.write(`data: ${JSON.stringify({ error: "Stream error" })}\n\n`);
    res.end();
  }
});

export default router;
