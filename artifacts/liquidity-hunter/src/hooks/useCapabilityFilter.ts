/**
 * useCapabilityFilter — filter capabilities by narrative stage and profile.
 */

import { useMemo } from "react";
import { useMarketStore } from "@/state/market-store";
import { useProfileStore } from "@/state/profile-store";
import { searchCapabilities, getCapabilitiesForStage, getCapabilitiesByCategory } from "@/state/capabilities";
import type { CapabilityDef, CapAction, CapCategory } from "@/state/capabilities";

export function useCapabilityFilter() {
  const stage = useMarketStore((s) => s.stageInfo.stage);
  const profile = useProfileStore((s) => s.profile);

  return useMemo(() => ({
    forCurrentStage: (): CapabilityDef[] => getCapabilitiesForStage(stage),
    byCategory: (action?: CapAction): Record<CapCategory, CapabilityDef[]> =>
      getCapabilitiesByCategory(stage, action),
    search: (query: string): CapabilityDef[] => {
      const results = searchCapabilities(query);
      // Filter out capabilities that require tools the user doesn't have
      return results.filter((c) => {
        if (c.requiresTv && !profile.watchlist.length) return true; // show anyway, mark as needing TV
        return true;
      });
    },
    stage,
    capabilityCount: getCapabilitiesForStage(stage).length,
  }), [stage, profile.watchlist.length]);
}
