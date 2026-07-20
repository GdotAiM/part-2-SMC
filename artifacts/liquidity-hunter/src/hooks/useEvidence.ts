/**
 * useEvidence — build an evidence chain for a specific conclusion or system component.
 *
 * Every piece of system output should have a traceable why.
 * This hook assembles the evidence from available store data.
 */

import { useMemo } from "react";
import { useMarketStore } from "@/state/market-store";

export interface EvidenceItem {
  label: string;
  value: string;
  status: "pass" | "fail" | "pending" | "info";
  detail?: string;
}

export function useSystemEvidence(): EvidenceItem[] {
  const system = useMarketStore((s) => s.system);
  const streamConnected = useMarketStore((s) => s.streamConnected);
  const symbol = useMarketStore((s) => s.symbol);

  return useMemo(() => [
    {
      label: "API Server",
      value: system.apiServer.status === "healthy" ? "Healthy" : "Degraded",
      status: system.apiServer.status === "healthy" ? "pass" : "fail",
      detail: `Uptime: ${Math.floor(system.apiServer.uptime / 3600)}h`,
    },
    {
      label: "MCP Server",
      value: system.mcpServer.status === "healthy"
        ? `${system.mcpServer.toolCount} tools registered`
        : system.mcpServer.status === "unknown" ? "Not checked" : "Degraded",
      status: system.mcpServer.status === "healthy" ? "pass" : "pending",
    },
    {
      label: "TradingView",
      value: system.tradingView.connected ? "Connected" : "Disconnected",
      status: system.tradingView.connected ? "pass" : "fail",
      detail: system.tradingView.connected ? "CDP port 9222" : "Launch TV Desktop with --remote-debugging-port=9222",
    },
    {
      label: "Data Stream",
      value: streamConnected ? "Live" : "Disconnected",
      status: streamConnected ? "pass" : "pending",
      detail: streamConnected ? `Receiving real-time data for ${symbol}` : "SSE stream not connected",
    },
    {
      label: "Database",
      value: system.database.status === "healthy" ? "Healthy" : system.database.status === "unknown" ? "Not configured" : "Degraded",
      status: system.database.status === "healthy" ? "pass" : system.database.status === "unknown" ? "info" : "fail",
    },
    {
      label: "Broker",
      value: system.broker.ready
        ? `${system.broker.mode} — ${system.broker.name}`
        : `Review — ${system.broker.name}`,
      status: system.broker.ready ? "pass" : "info",
    },
    {
      label: "LLM Provider",
      value: `${system.llm.provider} · ${system.llm.status}`,
      status: system.llm.status === "healthy" ? "pass" : "fail",
    },
  ], [system, streamConnected, symbol]);
}

export function useStrategyEvidence(): EvidenceItem[] {
  const primary = useMarketStore((s) => s.strategyPrimary);
  const reports = useMarketStore((s) => s.reports);

  return useMemo(() => {
    const evidence: EvidenceItem[] = [];

    if (!primary) {
      evidence.push({ label: "Strategy Detection", value: "No strategy matched", status: "pending", detail: "Run analysis to detect strategies." });
      return evidence;
    }

    // Strategy evidence from the API response
    const hasEvidence = primary.evidence && primary.evidence.length > 0;
    if (hasEvidence) {
      for (const ev of primary.evidence) {
        const isMatch = ev.startsWith("✓") || ev.startsWith("+");
        evidence.push({
          label: ev.replace(/^[✓✗◐+\-]\s*/, "").split(":")[0],
          value: ev,
          status: isMatch ? "pass" : ev.startsWith("✗") ? "fail" : "pending",
        });
      }
    }

    // Add report-level evidence
    const anchorTf = Object.keys(reports).sort(
      (a, b) => ({ "1w": 7, "1d": 6, "4h": 5, "1h": 4, "15m": 3, "5m": 2, "1m": 1 }[b] ?? 0) -
                  ({ "1w": 7, "1d": 6, "4h": 5, "1h": 4, "15m": 3, "5m": 2, "1m": 1 }[a] ?? 0),
    )[0];
    const report = anchorTf ? reports[anchorTf] : null;

    if (report) {
      if (report.structure.evidence?.length) {
        evidence.push({
          label: "Structure Evidence",
          value: report.structure.evidence.slice(0, 3).join("; "),
          status: "info",
        });
      }
      if (report.dailyBias.evidence?.length) {
        evidence.push({
          label: "Daily Bias Evidence",
          value: report.dailyBias.evidence.slice(0, 3).join("; "),
          status: "info",
        });
      }
    }

    return evidence;
  }, [primary, reports]);
}

export function useReportEvidence(report: import("@workspace/api-client-react").SmcReport | null): EvidenceItem[] {
  return useMemo(() => {
    if (!report) return [];

    const items: EvidenceItem[] = [];

    // Structure evidence
    items.push({
      label: "Market Structure",
      value: `${report.structure.trend} · ${report.structure.bias} bias`,
      status: report.structure.confidence > 0.5 ? "pass" : "pending",
      detail: `Confidence: ${Math.round(report.structure.confidence * 100)}% · Phase: ${report.structure.phase}`,
    });

    // Liquidity evidence
    const swept = report.liquidity.pools.filter((p) => p.wasSwept).length;
    const untapped = report.liquidity.pools.filter((p) => !p.wasSwept).length;
    items.push({
      label: "Liquidity Pools",
      value: `${swept} swept, ${untapped} untapped`,
      status: untapped > 0 ? "info" : "pending",
      detail: `Nearest BSL: ${report.liquidity.nearestBSL?.price ? `$${Math.round(report.liquidity.nearestBSL.price)}` : "—"} · Nearest SSL: ${report.liquidity.nearestSSL?.price ? `$${Math.round(report.liquidity.nearestSSL.price)}` : "—"}`,
    });

    // OB evidence
    const validObs = report.orderBlocks.filter((ob) => ob.valid).length;
    items.push({
      label: "Order Blocks",
      value: `${validObs} valid of ${report.orderBlocks.length}`,
      status: validObs > 0 ? "pass" : "info",
    });

    // FVG evidence
    const unfilled = report.fvg.filter((f) => f.fillFraction === 0 && !f.isInversion).length;
    items.push({
      label: "Fair Value Gaps",
      value: `${unfilled} unmitigated of ${report.fvg.length}`,
      status: unfilled > 0 ? "pass" : "info",
    });

    // SMT evidence
    if (report.smt?.detected) {
      items.push({
        label: "SMT Divergence",
        value: `Detected between ${report.smt.primarySymbol} and ${report.smt.correlatedSymbol}`,
        status: "pass",
        detail: `Type: ${report.smt.type}`,
      });
    }

    return items;
  }, [report]);
}
