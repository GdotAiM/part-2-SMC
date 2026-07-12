/**
 * TradingView Integration — barrel exports.
 *
 * Combines CDP connection, chart reading, chart actions, reconciliation,
 * and MCP tool registration into one module.
 */

// Config
export { getTvConfig, setTvConfig, isTvEnabled, isTvPrimary, isHybridMode, canWriteToTv } from "./config.js";

// Types
export type {
  TradingViewConfig, DataSourceMode, InteractionMode, TvConnectionType,
  ChartState, Drawing, ReconciliationReport, Discrepancy,
} from "./types.js";
export { toTvSymbol, fromTvSymbol, toTvTimeframe, fromTvTimeframe, SYMBOL_TO_TV } from "./types.js";

// CDP Connection
export { connect, disconnect, isConnected, evaluate, evaluateWithArgs, getPageUrl, keyboardPress, mouseClick, getPanePosition } from "./cdp/connection.js";

// CDP Chart Reader
export { getChartState, getSymbol, getTimeframe, getVisibleRange, getDrawings, getBars } from "./cdp/chart.js";

// CDP Actions
export { changeSymbol, changeTimeframe, drawHorizontalLine, drawFibRetracement, drawLabel, deleteDrawings, setAlert, syncSmcLevels } from "./cdp/actions.js";

// Reconciliation
export { reconcile, formatReconciliationForPrompt } from "./reconciliation.js";

// MCP Tools
export { registerTradingViewTools } from "./mcp-tools.js";
