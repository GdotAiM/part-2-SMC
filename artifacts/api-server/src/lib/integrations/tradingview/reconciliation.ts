/**
 * TradingView Reconciliation — compare SMC data with TV data.
 *
 * Detects and flags discrepancies between our SMC analysis and what
 * TradingView is showing. Supports three modes:
 *   app:     Our data is truth — flag TV differences for info only
 *   tv:      TV data is truth — prefer TV's symbol/TF/price
 *   hybrid:  Compare both, flag discrepancies, let AI reason over them
 */

import { getTvConfig, isTvPrimary, isHybridMode } from "./config.js";
import { getChartState } from "./cdp/chart.js";
import { toTvSymbol, fromTvSymbol, fromTvTimeframe } from "./types.js";
import type { ReconciliationReport, Discrepancy } from "./types.js";
import type { SmcReport } from "../../smc/types.js";
import { logger } from "../../logger.js";

// ─── Main reconciliation ──────────────────────────────────────────────────

/**
 * Compare an SMC report against the current TradingView chart state.
 * Returns a reconciliation report regardless of connected status
 * (if TV is disconnected, the report simply notes "TV unavailable").
 */
export async function reconcile(
  smcReport: SmcReport,
): Promise<ReconciliationReport> {
  const tvConfig = getTvConfig();
  const discrepancies: Discrepancy[] = [];
  let recommendedAction: ReconciliationReport["recommendedAction"] = "use_app";

  // If TV is not enabled or not connected, short-circuit
  if (!tvConfig.enabled) {
    return {
      discrepancies: [{ field: "tv_connection", appValue: "disabled", tvValue: "disabled", severity: "info", description: "TradingView integration is disabled. Using app data." }],
      recommendedAction: "use_app",
      symbol: smcReport.symbol,
      timeframe: smcReport.timeframe,
    };
  }

  const chartState = await getChartState();
  if (!chartState) {
    discrepancies.push({
      field: "tv_connection",
      appValue: "connected",
      tvValue: "disconnected",
      severity: "info",
      description: "TradingView chart state unavailable (CDP disconnected). Using app data.",
    });
    return { discrepancies, recommendedAction: "use_app", symbol: smcReport.symbol, timeframe: smcReport.timeframe };
  }

  // 1. Symbol comparison
  const tvSymbol = chartState.symbol;
  const appSymbol = smcReport.symbol;
  const tvCleaned = fromTvSymbol(tvSymbol);
  if (tvCleaned.toUpperCase() !== appSymbol.toUpperCase()) {
    discrepancies.push({
      field: "symbol",
      appValue: appSymbol,
      tvValue: tvSymbol,
      severity: "warning",
      description: `TV shows ${tvSymbol}, app uses ${appSymbol}.`,
    });
  }

  // 2. Timeframe comparison
  const tvTf = fromTvTimeframe(chartState.timeframe);
  if (tvTf !== smcReport.timeframe) {
    discrepancies.push({
      field: "timeframe",
      appValue: smcReport.timeframe,
      tvValue: chartState.timeframe + ` (${tvTf})`,
      severity: "info",
      description: `TV shows ${chartState.timeframe} (${tvTf}), app analyzing ${smcReport.timeframe}.`,
    });
  }

  // 3. Price comparison (if crosshair position is available)
  if (chartState.crosshairPrice != null) {
    const appPrice = smcReport.currentPrice;
    const tvPrice = chartState.crosshairPrice;
    const diffPct = Math.abs(tvPrice - appPrice) / Math.max(tvPrice, appPrice) * 100;
    if (diffPct > tvConfig.reconcileThreshold) {
      const severity = diffPct > 1 ? "error" : diffPct > 0.5 ? "warning" : "info";
      discrepancies.push({
        field: "current_price",
        appValue: appPrice,
        tvValue: tvPrice,
        severity,
        description: `Price differs by ${diffPct.toFixed(2)}% (app: ${appPrice}, TV: ${tvPrice}).`,
      });
    }
  }

  // 4. Drawing count
  if (chartState.drawings.length > 0) {
    discrepancies.push({
      field: "drawings",
      appValue: "N/A",
      tvValue: `${chartState.drawings.length} drawings`,
      severity: "info",
      description: `TV has ${chartState.drawings.length} drawings.`,
    });
  }

  // 5. Determine recommended action
  if (isTvPrimary() && discrepancies.filter((d) => d.severity === "error").length === 0) {
    recommendedAction = "use_tv";
  } else if (isHybridMode() && discrepancies.length > 0) {
    recommendedAction = "flag_ai";
  } else {
    recommendedAction = "use_app";
  }

  // Log summary
  if (discrepancies.length > 0) {
    logger.info(
      { discrepancies: discrepancies.length, severities: discrepancies.map((d) => d.severity).join(","), action: recommendedAction },
      "TV reconciliation complete",
    );
  }

  return {
    discrepancies,
    recommendedAction,
    symbol: smcReport.symbol,
    timeframe: smcReport.timeframe,
  };
}

/**
 * Format a reconciliation report as a string for LLM prompt injection.
 */
export function formatReconciliationForPrompt(report: ReconciliationReport): string {
  if (report.discrepancies.length === 0 && report.recommendedAction === "use_app") {
    return "";
  }

  const lines = [
    "\n=== TRADINGVIEW RECONCILIATION ===",
    `Data source mode: ${getTvConfig().dataSource}`,
    `Recommended action: ${report.recommendedAction}`,
  ];

  if (report.discrepancies.length > 0) {
    lines.push("Discrepancies:");
    for (const d of report.discrepancies) {
      lines.push(`  [${d.severity}] ${d.field}: ${d.description}`);
    }
  }

  return lines.join("\n");
}
