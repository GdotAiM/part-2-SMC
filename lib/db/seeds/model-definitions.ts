/**
 * Seed script for the full ICT/SMC trading model taxonomy.
 *
 * Encodes every distinct model from the taxonomy across six categories:
 *   1. Classical Horizon Models (2019) — 12 models
 *   2. Charter Price Action Blueprint     — 12 models
 *   3. Modern Step-by-Step Confluence     —  5 models
 *   4. Market Maker Cycles (MMXM)         —  2 models
 *   5. Temporal & Reversal Specialties    — 11 models
 *
 * Total: 41 model definitions.
 *
 * Predicates referenced by name only — none exist as executable code yet:
 *   hasBias, hasMarketStructureShift, hasFVG, hasOrderBlock,
 *   hasInducementZone, priceWithinOTEzone, hasConsolidationZone,
 *   hasLiquiditySweep, hasDisplacement, hasSessionAlignment,
 *   hasSMTDivergence, hasBreakerBlock, hasWeeklyExpansionContext,
 *   hasRangeExpansion, hasEqualHighsLows
 *
 * Usage:
 *   DATABASE_URL="postgresql://..." pnpm exec tsx lib/db/seeds/model-definitions.ts
 */

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { modelDefinitions } from "../src/schema/model-definitions";

const { Pool } = pg;

// ─── Helper ──────────────────────────────────────────────────────────────────

function param(
  key: string,
  label: string,
  type: "number" | "string" | "boolean" | "select",
  defaultVal: unknown,
  opts?: { min?: number; max?: number; options?: string[] },
) {
  return { key, label, type, default: defaultVal, ...opts };
}

const TF_SELECT = ["1m", "5m", "15m", "1h", "4h", "1d", "1w", "1M"];
const COMBO_TFS = ["1m", "5m", "15m", "1h", "4h", "1d"];

// ─── Model records ───────────────────────────────────────────────────────────

const models = [

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 1 — Classical Horizon Models (2019)
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: "classical-01",
    name: "Model 1 — Intraday Scalping",
    category: "classical-horizon",
    version: "1.0.0",
    description:
      "High-frequency intraday scalping using a 20-day lookback on M5–M1 charts. Targets previous session " +
      "high/low liquidity sweeps within NY/London session open windows. Execution on fresh FVGs after displacement.",
    requires: ["hasBias", "hasLiquiditySweep", "hasDisplacement", "hasSessionAlignment"],
    optional: ["hasFVG", "hasMarketStructureShift"],
    timeWindow: { type: "session", value: "LONDON_NY_OPEN" },
    assets: ["FOREX", "INDICES", "FUTURES"],
    parameters: [
      param("lookbackDays", "Lookback Period", "number", 20, { min: 10, max: 60 }),
      param("entryTf", "Entry Timeframe", "select", "5m", { options: ["1m", "3m", "5m"] }),
      param("minRR", "Minimum Risk-Reward", "number", 2, { min: 1, max: 5 }),
    ],
    performanceStats: {},
    isPublished: true,
  },
  {
    id: "classical-02",
    name: "Model 2 — Short-Term Trading",
    category: "classical-horizon",
    version: "1.0.0",
    description:
      "Short-term trading on major forex pairs and indices. H1 bias with M15–M5 entries. " +
      "Retracements to daily or 4-hour unmitigated POI zones (OBs, FVGs) targeting premium/discount inefficiencies.",
    requires: ["hasBias", "hasMarketStructureShift", "hasOrderBlock"],
    optional: ["hasFVG", "hasLiquiditySweep"],
    timeWindow: null,
    assets: ["FOREX", "INDICES"],
    parameters: [
      param("biasTf", "Bias Timeframe", "select", "1h", { options: ["1h", "4h"] }),
      param("entryTf", "Entry Timeframe", "select", "15m", { options: ["5m", "15m"] }),
      param("minRR", "Minimum Risk-Reward", "number", 2, { min: 1, max: 5 }),
    ],
    performanceStats: {},
    isPublished: true,
  },
  {
    id: "classical-03",
    name: "Model 3 — Swing Trading",
    category: "classical-horizon",
    version: "1.0.0",
    description:
      "Swing trading commodities and major forex. Combines COT hedging data with daily liquidity pool setups " +
      "and Optimal Trade Entry (OTE) zones. Daily/H4 bias with H1 entry.",
    requires: ["hasBias", "hasLiquiditySweep", "priceWithinOTEzone"],
    optional: ["hasOrderBlock", "hasFVG", "hasMarketStructureShift"],
    timeWindow: null,
    assets: ["COMMODITIES", "FOREX"],
    parameters: [
      param("biasTf", "Bias Timeframe", "select", "1d", { options: ["4h", "1d"] }),
      param("entryTf", "Entry Timeframe", "select", "1h", { options: ["1h", "4h"] }),
      param("oteMin", "OTE Zone Minimum", "number", 0.62, { min: 0, max: 1 }),
      param("oteMax", "OTE Zone Maximum", "number", 0.79, { min: 0, max: 1 }),
      param("minRR", "Minimum Risk-Reward", "number", 3, { min: 1, max: 10 }),
    ],
    performanceStats: {},
    isPublished: true,
  },
  {
    id: "classical-04",
    name: "Model 4 — Position Trading",
    category: "classical-horizon",
    version: "1.0.0",
    description:
      "Multi-month position trading on global currencies and indices. Relies on quarterly structural shifts, " +
      "seasonal tendencies, and intermarket correlation matrices (e.g. DXY vs Euro). Monthly/weekly bias with daily entry.",
    requires: ["hasBias"],
    optional: ["hasLiquiditySweep", "hasMarketStructureShift", "hasSMTDivergence"],
    timeWindow: null,
    assets: ["FOREX", "INDICES"],
    parameters: [
      param("biasTf", "Bias Timeframe", "select", "1M", { options: ["1w", "1M"] }),
      param("entryTf", "Entry Timeframe", "select", "1d", { options: ["1d", "4h"] }),
      param("minRR", "Minimum Risk-Reward", "number", 5, { min: 2, max: 20 }),
    ],
    performanceStats: {},
    isPublished: true,
  },
  {
    id: "classical-05",
    name: "Model 5 — Advanced Session Setup",
    category: "classical-horizon",
    version: "1.0.0",
    description:
      "Day trading model active weekdays only. Uses standard deviation extensions of the daily manipulation leg " +
      "to target precise expansion points. M15–M5 entry within session killzones.",
    requires: ["hasBias", "hasDisplacement", "hasSessionAlignment", "hasRangeExpansion"],
    optional: ["hasFVG", "hasOrderBlock"],
    timeWindow: { type: "session", value: "WEEKDAYS" },
    assets: ["FOREX", "INDICES", "FUTURES"],
    parameters: [
      param("entryTf", "Entry Timeframe", "select", "15m", { options: ["5m", "15m"] }),
      param("stdDevMultiplier", "Std Dev Multiplier", "number", 1.5, { min: 1, max: 3 }),
      param("minRR", "Minimum Risk-Reward", "number", 2, { min: 1, max: 5 }),
    ],
    performanceStats: {},
    isPublished: true,
  },
  {
    id: "classical-06",
    name: "Model 6 — Universal Buy Model",
    category: "classical-horizon",
    version: "1.0.0",
    description:
      "Multi-asset class buyside expansion model. Structured around buyside expansion profiles and market maker " +
      "accumulation phases. Identifies discount-zone entries after sellside liquidity sweeps.",
    requires: ["hasBias", "hasLiquiditySweep", "hasMarketStructureShift"],
    optional: ["hasFVG", "hasOrderBlock", "priceWithinOTEzone"],
    timeWindow: null,
    assets: ["*"],
    parameters: [
      param("biasTf", "Bias Timeframe", "select", "4h", { options: TF_SELECT }),
      param("entryTf", "Entry Timeframe", "select", "15m", { options: COMBO_TFS }),
      param("minRR", "Minimum Risk-Reward", "number", 2, { min: 1, max: 10 }),
    ],
    performanceStats: {},
    isPublished: true,
  },
  {
    id: "classical-07",
    name: "Model 7 — Universal Sell Model",
    category: "classical-horizon",
    version: "1.0.0",
    description:
      "Multi-asset class sellside expansion model (mirror of Model 6). Structured around sellside expansion " +
      "profiles and distribution phases. Identifies premium-zone entries after buyside liquidity sweeps.",
    requires: ["hasBias", "hasLiquiditySweep", "hasMarketStructureShift"],
    optional: ["hasFVG", "hasOrderBlock", "priceWithinOTEzone"],
    timeWindow: null,
    assets: ["*"],
    parameters: [
      param("biasTf", "Bias Timeframe", "select", "4h", { options: TF_SELECT }),
      param("entryTf", "Entry Timeframe", "select", "15m", { options: COMBO_TFS }),
      param("minRR", "Minimum Risk-Reward", "number", 2, { min: 1, max: 10 }),
    ],
    performanceStats: {},
    isPublished: true,
  },
  {
    id: "classical-08",
    name: "Model 8 — Weekly Range Strategy",
    category: "classical-horizon",
    version: "1.0.0",
    description:
      "Major forex pairs strategy capturing weekly expansions by anticipating the weekly high or low forming " +
      "between Monday and Wednesday. Weekly context with H1 entry. Trades in the direction of the weekly bias.",
    requires: ["hasBias", "hasRangeExpansion", "hasWeeklyExpansionContext"],
    optional: ["hasLiquiditySweep", "hasMarketStructureShift"],
    timeWindow: { type: "session", value: "MON_WED" },
    assets: ["FOREX"],
    parameters: [
      param("biasTf", "Bias Timeframe", "select", "1w", { options: ["1w", "1d"] }),
      param("entryTf", "Entry Timeframe", "select", "1h", { options: ["1h", "4h"] }),
      param("minRR", "Minimum Risk-Reward", "number", 3, { min: 1, max: 10 }),
    ],
    performanceStats: {},
    isPublished: true,
  },
  {
    id: "classical-09",
    name: "Model 9 — One Shot One Kill (OSOK)",
    category: "classical-horizon",
    version: "1.0.0",
    description:
      "Weekly position trading designed to capture the single largest high-probability directional expansion leg " +
      "of the weekly range. Daily bias with H1/M15 entry. Seeks minimum 1:3 R:R on the dominant structural move.",
    requires: ["hasBias", "hasMarketStructureShift", "hasLiquiditySweep"],
    optional: ["hasFVG", "hasOrderBlock", "hasInducementZone"],
    timeWindow: null,
    assets: ["FOREX", "INDICES"],
    parameters: [
      param("biasTf", "Bias Timeframe", "select", "1d", { options: ["4h", "1d"] }),
      param("entryTf", "Entry Timeframe", "select", "1h", { options: ["15m", "1h"] }),
      param("minRR", "Minimum Risk-Reward", "number", 3, { min: 2, max: 20 }),
    ],
    performanceStats: {},
    isPublished: true,
  },
  {
    id: "classical-10",
    name: "Model 10 — Swing Stalking",
    category: "classical-horizon",
    version: "1.0.0",
    description:
      "Day-to-swing trading designed to capture 50–75 pips per week by exploiting external range liquidity runs. " +
      "Daily range context with H1 entry. Targets external liquidity sweeps beyond the established range.",
    requires: ["hasBias", "hasLiquiditySweep", "hasRangeExpansion"],
    optional: ["hasMarketStructureShift", "hasFVG", "hasOrderBlock"],
    timeWindow: null,
    assets: ["FOREX", "INDICES"],
    parameters: [
      param("biasTf", "Bias Timeframe", "select", "1d", { options: ["1d", "4h"] }),
      param("entryTf", "Entry Timeframe", "select", "1h", { options: ["1h", "15m"] }),
      param("pipTarget", "Weekly Pip Target", "number", 60, { min: 30, max: 150 }),
      param("minRR", "Minimum Risk-Reward", "number", 2, { min: 1, max: 5 }),
    ],
    performanceStats: {},
    isPublished: true,
  },
  {
    id: "classical-11",
    name: "Model 11 — Daily Range Scalping",
    category: "classical-horizon",
    version: "1.0.0",
    description:
      "Scalping indices and major forex pairs on M15–M5. Focuses on daily range expansion stages and order block " +
      "retests during designated session open killzones (London/NY).",
    requires: ["hasBias", "hasOrderBlock", "hasSessionAlignment"],
    optional: ["hasFVG", "hasDisplacement", "hasMarketStructureShift"],
    timeWindow: { type: "session", value: "LONDON_NY_KILLZONE" },
    assets: ["INDICES", "FOREX"],
    parameters: [
      param("entryTf", "Entry Timeframe", "select", "15m", { options: ["5m", "15m"] }),
      param("killzoneWindow", "Killzone Window Minutes", "number", 60, { min: 30, max: 120 }),
      param("minRR", "Minimum Risk-Reward", "number", 2, { min: 1, max: 4 }),
    ],
    performanceStats: {},
    isPublished: true,
  },
  {
    id: "classical-12",
    name: "Model 12 — Core Scalping Model",
    category: "classical-horizon",
    version: "1.0.0",
    description:
      "Scalping highly liquid assets on M5–M1. Targets a fixed 20 pips per trade by entering fresh Fair Value Gaps " +
      "(FVGs) immediately following a high-velocity displacement move. Strict 1:2 R:R.",
    requires: ["hasDisplacement", "hasFVG"],
    optional: ["hasBias", "hasMarketStructureShift", "hasLiquiditySweep"],
    timeWindow: null,
    assets: ["FOREX", "INDICES", "CRYPTO"],
    parameters: [
      param("entryTf", "Entry Timeframe", "select", "5m", { options: ["1m", "3m", "5m"] }),
      param("pipTarget", "Fixed Pip Target", "number", 20, { min: 10, max: 50 }),
      param("minRR", "Minimum Risk-Reward", "number", 2, { min: 1, max: 3 }),
    ],
    performanceStats: {},
    isPublished: true,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 2 — Charter Price Action Blueprint (pedagogical series)
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: "charter-01",
    name: "Charter Model 1 — Market Structure",
    category: "charter-blueprint",
    version: "1.0.0",
    description:
      "Foundational mechanics of price delivery. Trains the analyst to map sequences of higher highs, higher lows, " +
      "lower highs, and lower lows to determine the current market structure phase. Introduces swing point identification " +
      "and the concept of structure as the primary filter for all higher-context decisions.",
    requires: ["hasBias", "hasMarketStructureShift"],
    optional: ["hasLiquiditySweep"],
    timeWindow: null,
    assets: ["*"],
    parameters: [
      param("biasTf", "Structure Timeframe", "select", "4h", { options: TF_SELECT }),
      param("pivotLookback", "Swing Point Lookback Bars", "number", 5, { min: 3, max: 20 }),
    ],
    performanceStats: {},
    isPublished: true,
  },
  {
    id: "charter-02",
    name: "Charter Model 2 — Fair Value Gaps",
    category: "charter-blueprint",
    version: "1.0.0",
    description:
      "Mechanics of Fair Value Gaps (FVGs) — how the market treats price imbalances as liquidity magnets " +
      "that price is expected to return to and fill. Covers FVG formation from displacement, classification " +
      "(bullish/bearish), fill fraction analysis, and inversion mechanics when a gap is fully mitigated.",
    requires: ["hasFVG", "hasDisplacement"],
    optional: ["hasBias", "hasMarketStructureShift"],
    timeWindow: null,
    assets: ["*"],
    parameters: [
      param("entryTf", "Analysis Timeframe", "select", "4h", { options: COMBO_TFS }),
      param("fillThreshold", "FVG Fill Fraction Threshold", "number", 0.5, { min: 0, max: 1 }),
    ],
    performanceStats: {},
    isPublished: true,
  },
  {
    id: "charter-03",
    name: "Charter Model 3 — Order Blocks",
    category: "charter-blueprint",
    version: "1.0.0",
    description:
      "Structural identification of Order Blocks (OBs) as footprint zones of institutional orders. " +
      "Covers the distinction between valid and mitigated OBs, breaker blocks (failed OBs), strength scoring, " +
      "and the significance of OB+FVG overlap zones as high-probability entry anchors.",
    requires: ["hasOrderBlock"],
    optional: ["hasBias", "hasFVG", "hasMarketStructureShift"],
    timeWindow: null,
    assets: ["*"],
    parameters: [
      param("entryTf", "Analysis Timeframe", "select", "4h", { options: COMBO_TFS }),
      param("minStrength", "Minimum OB Strength", "number", 0.3, { min: 0, max: 1 }),
    ],
    performanceStats: {},
    isPublished: true,
  },
  {
    id: "charter-04",
    name: "Charter Model 4 — Liquidity Runs",
    category: "charter-blueprint",
    version: "1.0.0",
    description:
      "Synthesis of the first three models to track Liquidity Runs. Details how institutions target resting " +
      "stop orders clustered above swing highs (buy-side liquidity / BSL) and below swing lows (sell-side " +
      "liquidity / SSL). Covers engineered equal highs/lows as deliberate liquidity-building structures.",
    requires: ["hasLiquiditySweep", "hasMarketStructureShift"],
    optional: ["hasBias", "hasFVG", "hasOrderBlock", "hasEqualHighsLows"],
    timeWindow: null,
    assets: ["*"],
    parameters: [
      param("biasTf", "Context Timeframe", "select", "1h", { options: ["1h", "4h", "1d"] }),
      param("entryTf", "Entry Timeframe", "select", "15m", { options: ["5m", "15m"] }),
      param("minRR", "Minimum Risk-Reward", "number", 2, { min: 1, max: 5 }),
    ],
    performanceStats: {},
    isPublished: true,
  },
  {
    id: "charter-05",
    name: "Charter Model 5 — Bias & Direction",
    category: "charter-blueprint",
    version: "1.0.0",
    description:
      "Establishes techniques for determining daily and weekly market bias. Integrates HTF structure analysis " +
      "(weekly/daily swing points), PD Array positioning (premium/discount), daily bias strength and consecutive-day " +
      "momentum, and session context to produce a directional bias that filters all lower-timeframe entries.",
    requires: ["hasBias"],
    optional: ["hasMarketStructureShift", "hasLiquiditySweep", "hasFVG", "hasOrderBlock"],
    timeWindow: null,
    assets: ["*"],
    parameters: [
      param("biasTf", "Bias Timeframe", "select", "1d", { options: ["4h", "1d", "1w"] }),
      param("minDailyStrength", "Minimum Daily Bias Strength", "number", 0.3, { min: 0, max: 1 }),
    ],
    performanceStats: {},
    isPublished: true,
  },
  {
    id: "charter-06",
    name: "Charter Model 6 — Weekly Range Expansion",
    category: "charter-blueprint",
    version: "1.0.0",
    description:
      "Teaches Weekly Range Expansion — aligning trades with the broader weekly cycle. Uses the weekly open " +
      "as the anchor, identifies the weekly bias from Monday/Tuesday price action, and structures entries " +
      "around the expectation that price will reach the opposite end of the weekly range before Friday's close.",
    requires: ["hasBias", "hasRangeExpansion"],
    optional: ["hasWeeklyExpansionContext", "hasLiquiditySweep", "hasMarketStructureShift"],
    timeWindow: { type: "session", value: "WEEKLY_CYCLE" },
    assets: ["FOREX", "INDICES"],
    parameters: [
      param("biasTf", "Bias Timeframe", "select", "1w", { options: ["1w", "1d"] }),
      param("entryTf", "Entry Timeframe", "select", "4h", { options: ["1h", "4h"] }),
      param("minRR", "Minimum Risk-Reward", "number", 2, { min: 1, max: 8 }),
    ],
    performanceStats: {},
    isPublished: true,
  },
  {
    id: "charter-07",
    name: "Charter Model 7 — Intraday Trading Techniques",
    category: "charter-blueprint",
    version: "1.0.0",
    description:
      "Intraday trading techniques focusing on shorter timeframes to capture daily expansions. " +
      "Covers session-based execution (Asian, London, NY overlap), killzone identification, and " +
      "alignment of intraday entry triggers with the daily bias established in Model 5.",
    requires: ["hasBias", "hasSessionAlignment", "hasMarketStructureShift"],
    optional: ["hasFVG", "hasOrderBlock", "hasLiquiditySweep"],
    timeWindow: { type: "session", value: "INTRADAY_KILLZONES" },
    assets: ["FOREX", "INDICES", "FUTURES"],
    parameters: [
      param("biasTf", "Bias Timeframe", "select", "1h", { options: ["1h", "4h"] }),
      param("entryTf", "Entry Timeframe", "select", "15m", { options: ["5m", "15m", "1h"] }),
      param("minRR", "Minimum Risk-Reward", "number", 2, { min: 1, max: 5 }),
    ],
    performanceStats: {},
    isPublished: true,
  },
  {
    id: "charter-08",
    name: "Charter Model 8 — Advanced Entry Techniques",
    category: "charter-blueprint",
    version: "1.0.0",
    description:
      "Advanced entry techniques demonstrating how to construct high-probability confluences using overlapping " +
      "structural markers — FVGs within order blocks, OBs within PD Array zones, and liquidity sweeps that " +
      "simultaneously tap multiple POI levels. Emphasises the stacking of confluence factors before execution.",
    requires: ["hasBias", "hasMarketStructureShift", "hasFVG", "hasOrderBlock"],
    optional: ["hasLiquiditySweep", "hasInducementZone", "priceWithinOTEzone"],
    timeWindow: null,
    assets: ["*"],
    parameters: [
      param("biasTf", "Bias Timeframe", "select", "4h", { options: ["1h", "4h", "1d"] }),
      param("entryTf", "Entry Timeframe", "select", "15m", { options: ["5m", "15m", "1h"] }),
      param("minConfluence", "Minimum Confluence Factors", "number", 3, { min: 2, max: 6 }),
      param("minRR", "Minimum Risk-Reward", "number", 2, { min: 1, max: 5 }),
    ],
    performanceStats: {},
    isPublished: true,
  },
  {
    id: "charter-09",
    name: "Charter Model 9 — One Shot One Kill Strategy",
    category: "charter-blueprint",
    version: "1.0.0",
    description:
      "Executes trades with minimal frequency but maximum efficiency. Seeks the single highest-conviction " +
      "setup of the day or week — the one trade where all confluence factors align perfectly. Requires " +
      "HTF bias confirmation, a clear LTF liquidity sweep, MSS with displacement, and an entry POI with " +
      "minimum 1:3 R:R. No second-tier setups are taken.",
    requires: ["hasBias", "hasMarketStructureShift", "hasLiquiditySweep", "hasDisplacement"],
    optional: ["hasFVG", "hasOrderBlock", "hasInducementZone", "priceWithinOTEzone"],
    timeWindow: null,
    assets: ["FOREX", "INDICES", "FUTURES"],
    parameters: [
      param("biasTf", "Bias Timeframe", "select", "1d", { options: ["4h", "1d"] }),
      param("entryTf", "Entry Timeframe", "select", "1h", { options: ["15m", "1h"] }),
      param("minRR", "Minimum Risk-Reward", "number", 3, { min: 2, max: 20 }),
      param("maxDailyTrades", "Maximum Trades Per Day", "number", 1, { min: 1, max: 3 }),
    ],
    performanceStats: {},
    isPublished: true,
  },
  {
    id: "charter-10",
    name: "Charter Model 10 — Dealing Ranges & Premium/Discount",
    category: "charter-blueprint",
    version: "1.0.0",
    description:
      "Teaches dealing ranges and premium/discount levels using the PD Array matrix. The core discipline: " +
      "buy only in discount zones (below equilibrium) and sell only in premium zones (above equilibrium). " +
      "Covers how to identify the dealing range high/low, calculate the equilibrium, and use the current " +
      "bias to determine whether price has room to run or is extended.",
    requires: ["hasBias"],
    optional: ["hasMarketStructureShift", "hasFVG", "hasOrderBlock", "hasLiquiditySweep"],
    timeWindow: null,
    assets: ["*"],
    parameters: [
      param("biasTf", "Bias Timeframe", "select", "1d", { options: ["4h", "1d"] }),
      param("entryTf", "Entry Timeframe", "select", "1h", { options: ["1h", "4h"] }),
      param("pdArrayRequired", "PD Array Alignment Required", "boolean", true),
      param("minRR", "Minimum Risk-Reward", "number", 2, { min: 1, max: 10 }),
    ],
    performanceStats: {},
    isPublished: true,
  },
  {
    id: "charter-11",
    name: "Charter Model 11 — Scalping Techniques",
    category: "charter-blueprint",
    version: "1.0.0",
    description:
      "Highly refined scalping techniques based on daily range expansions. Uses the daily range " +
      "high/low as the outer boundaries and enters on micro-structure shifts within session killzones. " +
      "Targets a fixed number of pips per scalp (typically 10–20) with strict 1:2 R:R discipline. " +
      "Distinguished from Model 12 by its reliance on daily range context rather than pure displacement.",
    requires: ["hasBias", "hasRangeExpansion", "hasMarketStructureShift", "hasSessionAlignment"],
    optional: ["hasFVG", "hasOrderBlock", "hasLiquiditySweep"],
    timeWindow: { type: "session", value: "KILLZONE_SCALP" },
    assets: ["FOREX", "INDICES", "CRYPTO"],
    parameters: [
      param("entryTf", "Entry Timeframe", "select", "5m", { options: ["1m", "3m", "5m"] }),
      param("scalpTarget", "Scalp Target (pips)", "number", 15, { min: 5, max: 30 }),
      param("minRR", "Minimum Risk-Reward", "number", 2, { min: 1, max: 3 }),
    ],
    performanceStats: {},
    isPublished: true,
  },
  {
    id: "charter-12",
    name: "Charter Model 12 — Algorithmic Theory (IPDA)",
    category: "charter-blueprint",
    version: "1.0.0",
    description:
      "Completes the blueprint by outlining Algorithmic Theory in Trading. Demonstrates how the Interbank " +
      "Price Delivery Algorithm (IPDA) functions to continuously reprice financial assets through time-based " +
      "price delivery cycles — accumulation, manipulation, and distribution — across all timeframes " +
      "simultaneously. Synthesises all prior Charter models into a unified market narrative framework.",
    requires: ["hasBias", "hasMarketStructureShift"],
    optional: ["hasFVG", "hasOrderBlock", "hasLiquiditySweep", "hasConsolidationZone", "hasSMTDivergence"],
    timeWindow: null,
    assets: ["*"],
    parameters: [
      param("biasTf", "Bias Timeframe", "select", "1d", { options: TF_SELECT }),
      param("entryTf", "Entry Timeframe", "select", "4h", { options: COMBO_TFS }),
    ],
    performanceStats: {},
    isPublished: true,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 3 — Modern Step-by-Step Confluence Models
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: "smc-confluence-1",
    name: "HTF POI + BOS + FVG",
    category: "modern-confluence",
    version: "1.0.0",
    description:
      "Foundational confluence model. Identify a higher timeframe Point of Interest (unfilled FVG, validated OB, or key liquidity pool). " +
      "Drop to a lower timeframe, wait for a liquidity sweep, then confirm a Market Structure Shift (MSS) with displacement that leaves " +
      "a fresh FVG. Enter on retracement to that FVG. SL beyond sweep extreme. TP at opposing liquidity. Minimum 1:2 R:R.",
    requires: ["hasBias", "hasMarketStructureShift", "hasFVG"],
    optional: ["hasOrderBlock", "hasLiquiditySweep"],
    timeWindow: null,
    assets: ["*"],
    parameters: [
      param("htfTf", "HTF Timeframe", "select", "4h", { options: ["1h", "4h", "1d"] }),
      param("entryTf", "LTF Entry Timeframe", "select", "5m", { options: ["1m", "5m", "15m"] }),
      param("minRR", "Minimum Risk-Reward", "number", 2, { min: 1, max: 10 }),
      param("fvgFillThreshold", "FVG Fill Fraction Threshold", "number", 0.5, { min: 0, max: 1 }),
    ],
    performanceStats: {},
    isPublished: true,
  },
  {
    id: "smc-confluence-2",
    name: "HTF POI + BOS + IDM + FVG",
    category: "modern-confluence",
    version: "1.0.0",
    description:
      "Extends Model 1 with an inducement (IDM) filter. After MSS with displacement, price forms a minor internal consolidation leg " +
      "where retail stops cluster. Requires price to first sweep that internal inducement before entry. Entry within FVG behind inducement. " +
      "Reduces drawdown vs Model 1.",
    requires: ["hasBias", "hasMarketStructureShift", "hasInducementZone", "hasFVG"],
    optional: ["hasOrderBlock", "hasLiquiditySweep"],
    timeWindow: null,
    assets: ["*"],
    parameters: [
      param("htfTf", "HTF Timeframe", "select", "4h", { options: ["1h", "4h", "1d"] }),
      param("entryTf", "LTF Entry Timeframe", "select", "5m", { options: ["1m", "5m", "15m"] }),
      param("minRR", "Minimum Risk-Reward", "number", 2, { min: 1, max: 10 }),
      param("idmLookback", "Inducement Lookback Bars", "number", 5, { min: 1, max: 20 }),
    ],
    performanceStats: {},
    isPublished: true,
  },
  {
    id: "smc-confluence-3",
    name: "HTF POI + BOS + FVG + OTE",
    category: "modern-confluence",
    version: "1.0.0",
    description:
      "Integrates Fibonacci retracement with Model 1 mechanics. After MSS displacement, apply Fib from displacement leg's " +
      "swing low to swing high. Enter only where an unmitigated FVG overlaps the OTE zone (62%–79% retracement, 75% major trigger). " +
      "Maximises mathematical expectancy through premium/discount optimisation.",
    requires: ["hasBias", "hasMarketStructureShift", "hasFVG", "priceWithinOTEzone"],
    optional: ["hasOrderBlock", "hasLiquiditySweep"],
    timeWindow: null,
    assets: ["*"],
    parameters: [
      param("htfTf", "HTF Timeframe", "select", "4h", { options: ["1h", "4h", "1d"] }),
      param("entryTf", "LTF Entry Timeframe", "select", "5m", { options: ["1m", "5m", "15m"] }),
      param("minRR", "Minimum Risk-Reward", "number", 2, { min: 1, max: 10 }),
      param("oteMin", "OTE Zone Minimum", "number", 0.62, { min: 0, max: 1 }),
      param("oteMax", "OTE Zone Maximum", "number", 0.79, { min: 0, max: 1 }),
    ],
    performanceStats: {},
    isPublished: true,
  },
  {
    id: "smc-confluence-4",
    name: "HTF POI + BOS + IDM + FVG + OTE",
    category: "modern-confluence",
    version: "1.0.0",
    description:
      "Highest standard confluence setup. Combines inducement sweep (Model 2) with Fibonacci OTE (Model 3). " +
      "Price must sweep internal inducement, retrace into 62%–79% OTE zone, and tap an unmitigated FVG. " +
      "Lowest frequency, highest win-rate of the standard models.",
    requires: ["hasBias", "hasMarketStructureShift", "hasInducementZone", "hasFVG", "priceWithinOTEzone"],
    optional: ["hasOrderBlock", "hasLiquiditySweep"],
    timeWindow: null,
    assets: ["*"],
    parameters: [
      param("htfTf", "HTF Timeframe", "select", "4h", { options: ["1h", "4h", "1d"] }),
      param("entryTf", "LTF Entry Timeframe", "select", "5m", { options: ["1m", "5m", "15m"] }),
      param("minRR", "Minimum Risk-Reward", "number", 2, { min: 1, max: 10 }),
      param("oteMin", "OTE Zone Minimum", "number", 0.62, { min: 0, max: 1 }),
      param("oteMax", "OTE Zone Maximum", "number", 0.79, { min: 0, max: 1 }),
    ],
    performanceStats: {},
    isPublished: true,
  },
  {
    id: "smc-confluence-5",
    name: "Five Box Setup",
    category: "modern-confluence",
    version: "1.0.0",
    description:
      "Multi-stage session model. Price enters a tight consolidation zone building equal highs/lows that engineer " +
      "stop-loss clusters. A high-velocity move breaks outside the range, sweeping engineered liquidity. Price immediately " +
      "rejects the breakout, retesting the original box. Entry on retest confirmation, opposite direction of sweep. " +
      "SL beyond extreme point of manipulation run.",
    requires: ["hasBias", "hasConsolidationZone", "hasMarketStructureShift", "hasEqualHighsLows"],
    optional: ["hasOrderBlock", "hasFVG", "hasInducementZone", "hasLiquiditySweep"],
    timeWindow: null,
    assets: ["*"],
    parameters: [
      param("htfTf", "HTF Timeframe", "select", "4h", { options: ["1h", "4h", "1d"] }),
      param("entryTf", "LTF Entry Timeframe", "select", "5m", { options: ["1m", "5m", "15m"] }),
      param("minRR", "Minimum Risk-Reward", "number", 2, { min: 1, max: 10 }),
      param("boxLookbackBars", "Consolidation Box Lookback Bars", "number", 12, { min: 3, max: 48 }),
      param("sweepExtensionPct", "Sweep Extension %", "number", 0.5, { min: 0.1, max: 5 }),
    ],
    performanceStats: {},
    isPublished: true,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 3 — Market Maker Cycles (MMXM)
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: "mmxm-mmsm",
    name: "Market Maker Sell Model (MMSM)",
    category: "market-maker-cycle",
    version: "1.0.0",
    description:
      "Tracks the full lifecycle of an asset transitioning from bullish to bearish phase. Stages: (1) Original Consolidation — " +
      "price ranges, building buy/sell-side liquidity pools. (2) Engineering Liquidity — upward expansion creating higher lows that " +
      "attract retail buyers. (3) Smart Money Reversal at HTF bearish PD Array — MSS + SMT divergence confirms distribution. " +
      "(4) Sell program targets each engineered higher low. (5) Terminal Distribution at original consolidation low. " +
      "Standard deviation projections: targets mapped at -1.0 to -2.5 extensions of SMR leg.",
    requires: ["hasBias", "hasMarketStructureShift", "hasSMTDivergence", "hasLiquiditySweep"],
    optional: ["hasFVG", "hasOrderBlock", "hasConsolidationZone", "hasEqualHighsLows"],
    timeWindow: null,
    assets: ["*"],
    parameters: [
      param("biasTf", "HTF Bias Timeframe", "select", "1d", { options: ["4h", "1d", "1w"] }),
      param("entryTf", "Entry Timeframe", "select", "1h", { options: ["15m", "1h", "4h"] }),
      param("smrConfirmation", "SMR Confirmation Required", "boolean", true),
      param("tpMultiplier1", "TP1 Std Dev Multiplier", "number", 1.0, { min: 0.5, max: 3 }),
      param("tpMultiplier2", "TP2 Std Dev Multiplier", "number", 2.0, { min: 1, max: 5 }),
      param("minRR", "Minimum Risk-Reward", "number", 3, { min: 2, max: 10 }),
    ],
    performanceStats: {},
    isPublished: true,
  },
  {
    id: "mmxm-mmbm",
    name: "Market Maker Buy Model (MMBM)",
    category: "market-maker-cycle",
    version: "1.0.0",
    description:
      "Mirror image of MMSM — tracks transition from bearish to bullish phase. Stages: (1) Original Consolidation. " +
      "(2) Engineering Liquidity — downward expansion creating clean lower highs that trap breakout sellers. " +
      "(3) Smart Money Reversal at HTF bullish PD Array after sellside liquidity sweep. MSS + SMT divergence confirmed. " +
      "(4) Buy program captures resting buy-stops above engineered lower highs. (5) Terminal Distribution at original consolidation highs.",
    requires: ["hasBias", "hasMarketStructureShift", "hasSMTDivergence", "hasLiquiditySweep"],
    optional: ["hasFVG", "hasOrderBlock", "hasConsolidationZone", "hasEqualHighsLows"],
    timeWindow: null,
    assets: ["*"],
    parameters: [
      param("biasTf", "HTF Bias Timeframe", "select", "1d", { options: ["4h", "1d", "1w"] }),
      param("entryTf", "Entry Timeframe", "select", "1h", { options: ["15m", "1h", "4h"] }),
      param("smrConfirmation", "SMR Confirmation Required", "boolean", true),
      param("tpMultiplier1", "TP1 Std Dev Multiplier", "number", 1.0, { min: 0.5, max: 3 }),
      param("tpMultiplier2", "TP2 Std Dev Multiplier", "number", 2.0, { min: 1, max: 5 }),
      param("minRR", "Minimum Risk-Reward", "number", 3, { min: 2, max: 10 }),
    ],
    performanceStats: {},
    isPublished: true,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 4 — Temporal & Reversal Specialties
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: "temporal-silver-bullet-london",
    name: "Silver Bullet — London Open",
    category: "temporal-reversal",
    version: "1.0.0",
    description:
      "Precise time-dependent execution model running in the London Open window (03:00–04:00 EST / 07:00–08:00 GMT). " +
      "Captures the initial manipulation or expansion leg of the London session. Prior to the hour, identify clean " +
      "buy/sell-side liquidity on the 15m parent chart. On window open, drop to LTF (5m/3m/1m), wait for a liquidity " +
      "sweep + MSS with displacement leaving an FVG. Limit order on the first FVG retest. Target: 20–30 pips, 1:2 R:R.",
    requires: ["hasBias", "hasLiquiditySweep", "hasMarketStructureShift", "hasDisplacement"],
    optional: ["hasFVG", "hasOrderBlock"],
    timeWindow: { type: "time", value: "LONDON_OPEN_0300_0400_EST" },
    assets: ["FOREX", "INDICES", "FUTURES"],
    parameters: [
      param("entryTf", "Entry Timeframe", "select", "5m", { options: ["1m", "3m", "5m"] }),
      param("parentTf", "Parent Chart Timeframe", "select", "15m", { options: ["15m", "5m"] }),
      param("pipTarget", "Pip Target", "number", 25, { min: 10, max: 50 }),
      param("minRR", "Minimum Risk-Reward", "number", 2, { min: 1, max: 5 }),
    ],
    performanceStats: {},
    isPublished: true,
  },
  {
    id: "temporal-silver-bullet-nyam",
    name: "Silver Bullet — New York AM",
    category: "temporal-reversal",
    version: "1.0.0",
    description:
      "Silver Bullet execution in the NY AM window (10:00–11:00 EST / 14:00–15:00 GMT). Highest volume window, " +
      "overlapping the tail of London session and NY open volatility. Same mechanical rules as Silver Bullet London.",
    requires: ["hasBias", "hasLiquiditySweep", "hasMarketStructureShift", "hasDisplacement"],
    optional: ["hasFVG", "hasOrderBlock"],
    timeWindow: { type: "time", value: "NY_AM_1000_1100_EST" },
    assets: ["FOREX", "INDICES", "FUTURES"],
    parameters: [
      param("entryTf", "Entry Timeframe", "select", "5m", { options: ["1m", "3m", "5m"] }),
      param("parentTf", "Parent Chart Timeframe", "select", "15m", { options: ["15m", "5m"] }),
      param("pipTarget", "Pip Target", "number", 25, { min: 10, max: 50 }),
      param("minRR", "Minimum Risk-Reward", "number", 2, { min: 1, max: 5 }),
    ],
    performanceStats: {},
    isPublished: true,
  },
  {
    id: "temporal-silver-bullet-nypm",
    name: "Silver Bullet — New York PM",
    category: "temporal-reversal",
    version: "1.0.0",
    description:
      "Silver Bullet execution in the NY PM window (14:00–15:00 EST / 18:00–19:00 GMT). Captures afternoon trend " +
      "continuation or late-session expansions. Same mechanical rules as Silver Bullet London.",
    requires: ["hasBias", "hasLiquiditySweep", "hasMarketStructureShift", "hasDisplacement"],
    optional: ["hasFVG", "hasOrderBlock"],
    timeWindow: { type: "time", value: "NY_PM_1400_1500_EST" },
    assets: ["FOREX", "INDICES", "FUTURES"],
    parameters: [
      param("entryTf", "Entry Timeframe", "select", "5m", { options: ["1m", "3m", "5m"] }),
      param("parentTf", "Parent Chart Timeframe", "select", "15m", { options: ["15m", "5m"] }),
      param("pipTarget", "Pip Target", "number", 25, { min: 10, max: 50 }),
      param("minRR", "Minimum Risk-Reward", "number", 2, { min: 1, max: 5 }),
    ],
    performanceStats: {},
    isPublished: true,
  },
  {
    id: "temporal-judas-swing",
    name: "Judas Swing",
    category: "temporal-reversal",
    version: "1.0.0",
    description:
      "Structural manipulation model occurring at major session opens (London 02:00–03:00 EST or NY 08:30–09:30 EST). " +
      "Generates a false breakout that runs counter to the true daily bias. E.g. if daily bias is bullish, a sudden " +
      "aggressive drop at session open runs below Asian range low triggering sell stops. Once liquidity is swept and " +
      "institutional buy orders filled at a discount, price reverses into the true expansion leg.",
    requires: ["hasBias", "hasLiquiditySweep", "hasSessionAlignment", "hasMarketStructureShift"],
    optional: ["hasFVG", "hasOrderBlock", "hasInducementZone"],
    timeWindow: { type: "time", value: "SESSION_OPEN_LONDON_NY" },
    assets: ["FOREX", "INDICES", "FUTURES"],
    parameters: [
      param("entryTf", "Entry Timeframe", "select", "5m", { options: ["1m", "3m", "5m", "15m"] }),
      param("sweepLookback", "Sweep Lookback (bars)", "number", 5, { min: 1, max: 20 }),
      param("minRR", "Minimum Risk-Reward", "number", 2, { min: 1, max: 5 }),
    ],
    performanceStats: {},
    isPublished: true,
  },
  {
    id: "temporal-power-of-three",
    name: "Power of Three (PO3)",
    category: "temporal-reversal",
    version: "1.0.0",
    description:
      "Defines the structural lifecycle of a single candle (daily, weekly, or monthly) in three algorithmic phases: " +
      "(1) Accumulation — price ranges near the session/candle open, building retail orders. (2) Manipulation — aggressive " +
      "drive opposite to true daily bias (Judas Swing). (3) Distribution — decisive expansion in the true direction, creating " +
      "the full range. Entry direction is the same as daily bias, after manipulation phase completes.",
    requires: ["hasBias", "hasLiquiditySweep", "hasMarketStructureShift"],
    optional: ["hasFVG", "hasOrderBlock", "hasConsolidationZone"],
    timeWindow: null,
    assets: ["*"],
    parameters: [
      param("biasTf", "Bias Timeframe", "select", "1d", { options: ["1h", "4h", "1d", "1w"] }),
      param("entryTf", "Entry Timeframe", "select", "15m", { options: ["5m", "15m", "1h"] }),
      param("accumulationBars", "Accumulation Phase Max Bars", "number", 12, { min: 3, max: 48 }),
      param("minRR", "Minimum Risk-Reward", "number", 2, { min: 1, max: 10 }),
    ],
    performanceStats: {},
    isPublished: true,
  },
  {
    id: "reversal-turtle-soup",
    name: "Turtle Soup",
    category: "temporal-reversal",
    version: "1.0.0",
    description:
      "High-probability counter-trend reversal protocol exploiting failed breakouts at key S/R boundaries. Identifies " +
      "a significant swing high/low on HTF (4h/daily). When price breaks beyond this level on LTF, the model does NOT " +
      "wait for a full close beyond the level — it requires price to sweep the extreme with a candle wick, immediately " +
      "reject, and close back inside prior range. Limit entry just inside the broken level. SL beyond the sweep wick. " +
      "TP at opposing end of the range.",
    requires: ["hasLiquiditySweep", "hasMarketStructureShift", "hasDisplacement"],
    optional: ["hasBias", "hasFVG", "hasOrderBlock"],
    timeWindow: null,
    assets: ["*"],
    parameters: [
      param("htfTf", "HTF Swing Level Timeframe", "select", "4h", { options: ["1h", "4h", "1d"] }),
      param("entryTf", "Entry Timeframe", "select", "5m", { options: ["1m", "3m", "5m", "15m"] }),
      param("sweepWickRequired", "Sweep Wick Required", "boolean", true),
      param("minRR", "Minimum Risk-Reward", "number", 2, { min: 1, max: 5 }),
    ],
    performanceStats: {},
    isPublished: true,
  },
  {
    id: "reversal-unicorn",
    name: "Unicorn Model",
    category: "temporal-reversal",
    version: "1.0.0",
    description:
      "Precision setup at the direct overlap of two structural anchors — a Breaker Block and a Fair Value Gap. " +
      "A Breaker Block is a failed OB broken with strong displacement, trapping breakout traders. The displacement leg " +
      "must simultaneously form an FVG within the breaker block's price boundaries. Entry via limit order at the " +
      "midpoint/boundary of the overlapping zone. SL beyond the body high/low of the manipulation leg.",
    requires: ["hasBreakerBlock", "hasFVG", "hasMarketStructureShift"],
    optional: ["hasBias", "hasOrderBlock", "hasLiquiditySweep"],
    timeWindow: null,
    assets: ["*"],
    parameters: [
      param("entryTf", "Entry Timeframe", "select", "5m", { options: ["1m", "3m", "5m", "15m"] }),
      param("overlapType", "Overlap Entry Type", "select", "midpoint", { options: ["midpoint", "boundary"] }),
      param("minRR", "Minimum Risk-Reward", "number", 2, { min: 1, max: 5 }),
    ],
    performanceStats: {},
    isPublished: true,
  },
  {
    id: "reversal-scob",
    name: "Single Candle Order Block (SCOB / IFC)",
    category: "temporal-reversal",
    version: "1.0.0",
    description:
      "Micro-refinement entry model used inside a higher timeframe POI. The first lower timeframe candle to tap the HTF POI " +
      "must actively sweep the preceding candle's high or low and immediately close back within its range, printing a pin-bar " +
      "or hammer structure. This micro-sweep confirms institutional orders have been filled at the turning point. " +
      "Limit entry at the high/low of the sweeping candle. Tight SL one tick beyond the sweep wick.",
    requires: ["hasBias", "hasMarketStructureShift", "hasLiquiditySweep"],
    optional: ["hasFVG", "hasOrderBlock", "hasInducementZone"],
    timeWindow: null,
    assets: ["*"],
    parameters: [
      param("htfTf", "HTF POI Timeframe", "select", "1h", { options: ["1h", "4h", "1d"] }),
      param("entryTf", "Entry Timeframe", "select", "5m", { options: ["1m", "3m", "5m"] }),
      param("minRR", "Minimum Risk-Reward", "number", 2, { min: 1, max: 5 }),
    ],
    performanceStats: {},
    isPublished: true,
  },
  {
    id: "framework-sharp-turn",
    name: "Sharp Turn (ST) Model",
    category: "temporal-reversal",
    version: "1.0.0",
    description:
      "Two-timeframe alignment framework for high-velocity structural reversals. Context derived from a primary HTF; " +
      "entry executed exactly two layers down the timeframe hierarchy. Monthly context → daily entry. Weekly context → 4h entry. " +
      "Daily context → 1h entry. SL beyond the extreme swing of the first structural reversal leg.",
    requires: ["hasBias", "hasMarketStructureShift", "hasLiquiditySweep"],
    optional: ["hasFVG", "hasOrderBlock", "hasDisplacement"],
    timeWindow: null,
    assets: ["*"],
    parameters: [
      param("contextTf", "Context Timeframe", "select", "1w", { options: ["1d", "1w", "1M"] }),
      param("entryTf", "Entry Timeframe (2 tiers down)", "select", "1h", { options: ["1h", "4h", "1d"] }),
      param("minRR", "Minimum Risk-Reward", "number", 3, { min: 2, max: 10 }),
    ],
    performanceStats: {},
    isPublished: true,
  },
  {
    id: "framework-2fvg",
    name: "2 FVG Model",
    category: "temporal-reversal",
    version: "1.0.0",
    description:
      "Three-timeframe alignment framework for transitioning from macro consolidation to aggressive expansion. " +
      "Ignore the first impulsive leg of the MSS. Instead wait for a secondary retracement leg and execute on the " +
      "retest of the second consecutive FVG formed during that secondary expansion. SL beyond the short-term high/low " +
      "of the second leg. More insulated risk than the Sharp Turn model.",
    requires: ["hasBias", "hasMarketStructureShift", "hasFVG", "hasDisplacement"],
    optional: ["hasOrderBlock", "hasLiquiditySweep", "hasInducementZone", "hasConsolidationZone"],
    timeWindow: null,
    assets: ["*"],
    parameters: [
      param("contextTf", "Context Timeframe", "select", "1w", { options: ["1d", "1w", "1M"] }),
      param("entryTf", "Entry Timeframe (3 tiers down)", "select", "4h", { options: ["1h", "4h", "1d"] }),
      param("fvgFillThreshold", "FVG Fill Threshold", "number", 0.5, { min: 0, max: 1 }),
      param("minRR", "Minimum Risk-Reward", "number", 2, { min: 1, max: 8 }),
    ],
    performanceStats: {},
    isPublished: true,
  },
];

// ─── Runner ──────────────────────────────────────────────────────────────────

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  console.log(`Seeding ${models.length} model definitions …`);

  for (const model of models) {
    await db
      .insert(modelDefinitions)
      .values({ ...model, createdAt: new Date(), updatedAt: new Date() })
      .onConflictDoNothing({ target: modelDefinitions.id });
    console.log(`  ✓ ${model.id} — ${model.name}`);
  }

  console.log("\nDone.");
  await pool.end();
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
