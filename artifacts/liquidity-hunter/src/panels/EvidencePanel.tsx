/**
 * EvidencePanel — collapsible evidence chain drawer.
 *
 * Every system conclusion has a "Show Evidence" action.
 * This panel renders the evidence chain for the currently targeted item.
 */

import { useMemo } from "react";
import { useMarketStore } from "@/state/market-store";
import { useSystemEvidence, useStrategyEvidence, useReportEvidence } from "@/hooks/useEvidence";

function EvidenceBadge({ status }: { status: "pass" | "fail" | "pending" | "info" }) {
  const styles = {
    pass: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    fail: "bg-destructive/10 text-destructive border-destructive/20",
    pending: "bg-amber-400/10 text-amber-400 border-amber-500/20",
    info: "bg-muted text-muted-foreground border-border",
  };
  const labels = { pass: "✓ PASS", fail: "✗ FAIL", pending: "◐ WAIT", info: "ℹ INFO" };
  return (
    <span className={`text-[8px] px-1 py-0.5 rounded-sm border font-semibold shrink-0 ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

function EvidenceList({ items, title }: { items: Array<{ label: string; value: string; status: "pass" | "fail" | "pending" | "info"; detail?: string }>; title: string }) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <h4 className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</h4>
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-2 p-2 rounded-sm bg-muted/10 border border-border/20">
          <EvidenceBadge status={item.status} />
          <div className="min-w-0 flex-1">
            <div className="text-[10px] text-foreground font-medium">{item.label}</div>
            <div className="text-[9px] text-muted-foreground mt-0.5">{item.value}</div>
            {item.detail && (
              <div className="text-[8px] text-muted-foreground/50 mt-0.5">{item.detail}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export function EvidencePanel() {
  const evidenceTargetId = useMarketStore((s) => s.evidenceTargetId);
  const evidencePanelOpen = useMarketStore((s) => s.evidencePanelOpen);
  const closeEvidence = useMarketStore((s) => s.closeEvidence);
  const reports = useMarketStore((s) => s.reports);

  const systemEvidence = useSystemEvidence();
  const strategyEvidence = useStrategyEvidence();

  const anchorTf = useMemo(() =>
    Object.keys(reports).sort(
      (a, b) => ({ "1w": 7, "1d": 6, "4h": 5, "1h": 4, "15m": 3, "5m": 2, "1m": 1 }[b] ?? 0) -
                  ({ "1w": 7, "1d": 6, "4h": 5, "1h": 4, "15m": 3, "5m": 2, "1m": 1 }[a] ?? 0),
    )[0],
    [reports],
  );
  const anchorReport = anchorTf ? reports[anchorTf] : null;
  const reportEvidence = useReportEvidence(anchorReport);

  if (!evidencePanelOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-[420px] bg-background border-l border-border/40 shadow-2xl flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/20">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Evidence Chain
          </h3>
          {evidenceTargetId && (
            <p className="text-[9px] text-primary font-mono mt-0.5">{evidenceTargetId}</p>
          )}
        </div>
        <button
          onClick={closeEvidence}
          className="p-1.5 rounded-sm hover:bg-muted transition-colors"
        >
          <span className="text-xs">✕</span>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Strategy evidence */}
        {strategyEvidence.length > 0 && (
          <EvidenceList items={strategyEvidence} title="Strategy Detection" />
        )}

        {/* Report evidence */}
        {reportEvidence.length > 0 && (
          <EvidenceList items={reportEvidence} title="SMC Report" />
        )}

        {/* System evidence (always shown) */}
        <EvidenceList items={systemEvidence} title="System Health" />

        {/* Empty state */}
        {strategyEvidence.length === 0 && reportEvidence.length === 0 && (
          <div className="flex items-center justify-center h-32 text-[10px] text-muted-foreground italic font-mono text-center">
            No evidence available for this item.<br />
            Run analysis to generate evidence chains.
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-border/20 text-[8px] text-muted-foreground">
        All evidence is derived from live market data and system state.
      </div>
    </div>
  );
}
