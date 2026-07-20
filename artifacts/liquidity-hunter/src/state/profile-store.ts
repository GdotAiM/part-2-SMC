/**
 * Trader Profile — persisted to localStorage.
 *
 * Stores the user's model selection, session preferences, and risk rules.
 * Everything filters through this profile for progressive disclosure.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

// ── Types ────────────────────────────────────────────────────────────────────

export interface ModelSelection {
  id: string;
  enabled: boolean;
  role: "primary_entry" | "secondary_entry" | "reversal" | "confluence";
}

export interface RiskRules {
  minRR: number;           // Minimum risk-reward ratio (default 1:2)
  maxDailyTrades: number;  // Default 3
  positionSizePercent: number; // Default 0.5
  maxDrawdownPercent: number;  // Default 5
}

export interface SessionPreference {
  name: string;
  enabled: boolean;
  isPrimary: boolean;
}

export interface TraderProfile {
  // Which models the user trades
  models: ModelSelection[];
  // Which sessions they trade
  sessions: SessionPreference[];
  // Risk configuration
  risk: RiskRules;
  // Preferred timeframes for cascade
  preferredTimeframes: string[];
  // Favorite symbols
  watchlist: string[];
  // UI preferences
  theme: "dark";
  showBriefing: boolean;
  stageAutoAdvance: boolean;
}

const DEFAULT_MODELS: ModelSelection[] = [
  { id: "smc-confluence-1", enabled: true, role: "primary_entry" },
  { id: "smc-confluence-2", enabled: true, role: "secondary_entry" },
  { id: "smc-confluence-3", enabled: true, role: "confluence" },
  { id: "smc-confluence-4", enabled: false, role: "confluence" },
  { id: "smc-confluence-5", enabled: false, role: "confluence" },
  { id: "temporal-silver-bullet-london", enabled: true, role: "secondary_entry" },
  { id: "temporal-silver-bullet-nyam", enabled: true, role: "primary_entry" },
  { id: "temporal-silver-bullet-nypm", enabled: false, role: "secondary_entry" },
  { id: "temporal-judas-swing", enabled: true, role: "reversal" },
  { id: "temporal-power-of-three", enabled: true, role: "confluence" },
  { id: "reversal-turtle-soup", enabled: false, role: "reversal" },
  { id: "reversal-unicorn", enabled: false, role: "reversal" },
  { id: "classical-01", enabled: false, role: "secondary_entry" },
  { id: "classical-09", enabled: false, role: "secondary_entry" },
  { id: "mmxm-mmbm", enabled: false, role: "confluence" },
  { id: "mmxm-mmsm", enabled: false, role: "confluence" },
];

const DEFAULT_SESSIONS: SessionPreference[] = [
  { name: "ASIAN", enabled: false, isPrimary: false },
  { name: "LONDON", enabled: true, isPrimary: false },
  { name: "NY_AM", enabled: true, isPrimary: true },
  { name: "NY_PM", enabled: true, isPrimary: false },
  { name: "LATE", enabled: false, isPrimary: false },
];

const DEFAULT_RISK: RiskRules = {
  minRR: 2.0,
  maxDailyTrades: 3,
  positionSizePercent: 0.5,
  maxDrawdownPercent: 5,
};

const DEFAULT_TF = ["1m", "5m", "15m", "1h", "4h", "1d", "1w"];

// ── Store ────────────────────────────────────────────────────────────────────

interface ProfileStore {
  profile: TraderProfile;
  updateModel: (id: string, changes: Partial<ModelSelection>) => void;
  updateSession: (name: string, changes: Partial<SessionPreference>) => void;
  updateRisk: (changes: Partial<RiskRules>) => void;
  toggleWatchlist: (symbol: string) => void;
  setTimeframes: (tfs: string[]) => void;
  setShowBriefing: (show: boolean) => void;
  setStageAutoAdvance: (on: boolean) => void;
  resetProfile: () => void;
  activeModelIds: () => string[];
  enabledSessionNames: () => string[];
}

const DEFAULT_PROFILE: TraderProfile = {
  models: DEFAULT_MODELS,
  sessions: DEFAULT_SESSIONS,
  risk: DEFAULT_RISK,
  preferredTimeframes: DEFAULT_TF,
  watchlist: ["BTCUSDT", "ETHUSDT", "EURUSD=X"],
  theme: "dark",
  showBriefing: true,
  stageAutoAdvance: true,
};

export const useProfileStore = create<ProfileStore>()(
  persist(
    (set, get) => ({
      profile: DEFAULT_PROFILE,

      updateModel: (id, changes) =>
        set((s) => ({
          profile: {
            ...s.profile,
            models: s.profile.models.map((m) =>
              m.id === id ? { ...m, ...changes } : m,
            ),
          },
        })),

      updateSession: (name, changes) =>
        set((s) => ({
          profile: {
            ...s.profile,
            sessions: s.profile.sessions.map((se) =>
              se.name === name ? { ...se, ...changes } : se,
            ),
          },
        })),

      updateRisk: (changes) =>
        set((s) => ({
          profile: { ...s.profile, risk: { ...s.profile.risk, ...changes } },
        })),

      toggleWatchlist: (symbol) =>
        set((s) => {
          const exists = s.profile.watchlist.includes(symbol);
          return {
            profile: {
              ...s.profile,
              watchlist: exists
                ? s.profile.watchlist.filter((x) => x !== symbol)
                : [...s.profile.watchlist, symbol],
            },
          };
        }),

      setTimeframes: (tfs) =>
        set((s) => ({ profile: { ...s.profile, preferredTimeframes: tfs } })),

      setShowBriefing: (show) =>
        set((s) => ({ profile: { ...s.profile, showBriefing: show } })),

      setStageAutoAdvance: (on) =>
        set((s) => ({ profile: { ...s.profile, stageAutoAdvance: on } })),

      resetProfile: () => set({ profile: DEFAULT_PROFILE }),

      activeModelIds: () =>
        get().profile.models.filter((m) => m.enabled).map((m) => m.id),

      enabledSessionNames: () =>
        get().profile.sessions.filter((s) => s.enabled).map((s) => s.name),
    }),
    {
      name: "smc-pulse-profile",
      partialize: (state) => ({ profile: state.profile }),
    },
  ),
);
