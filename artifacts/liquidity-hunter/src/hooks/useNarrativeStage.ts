/**
 * useNarrativeStage — subscribe to market store and return the current
 * narrative stage with all derived context.
 */

import { useMemo } from "react";
import { useMarketStore } from "@/state/market-store";
import { getCapabilitiesForStage, type CapabilityDef } from "@/state/capabilities";

export function useNarrativeStage() {
  const stageInfo = useMarketStore((s) => s.stageInfo);

  const availableCapabilities: CapabilityDef[] = useMemo(
    () => getCapabilitiesForStage(stageInfo.stage),
    [stageInfo.stage],
  );

  return {
    ...stageInfo,
    availableCapabilities,
    stageIndex: ["WATCHING", "SCANNING", "LIQUIDITY_SWEPT", "DISPLACEMENT", "MSS_FORMING", "FVG_FORMED", "ENTRY_READY", "IN_TRADE", "REVIEW", "NO_TRADE"].indexOf(stageInfo.stage),
  };
}
