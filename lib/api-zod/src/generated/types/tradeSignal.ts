import { z } from "zod/v4";

// ─── Enums ───

export enum SetupType {
  FVG = "FVG",
  OB = "OB",
  MSS = "MSS",
  CHoCH = "CHoCH",
  BOS = "BOS",
  SESSION_BREAKOUT = "SESSION_BREAKOUT",
  LIQUIDITY_SWEEP = "LIQUIDITY_SWEEP",
}

export enum SetupSubtype {
  // OB subtypes
  BULLISH_OB = "BULLISH_OB",
  BEARISH_OB = "BEARISH_OB",
  BREAKER_BLOCK = "BREAKER_BLOCK",
  // FVG subtypes
  FVG_MITIGATION = "FVG_MITIGATION",
  FVG_FILL = "FVG_FILL",
  // MSS subtypes
  BULLISH_MSS = "BULLISH_MSS",
  BEARISH_MSS = "BEARISH_MSS",
  // CHoCH subtypes
  BULLISH_CHOCH = "BULLISH_CHOCH",
  BEARISH_CHOCH = "BEARISH_CHOCH",
  // BOS subtypes
  BULLISH_BOS = "BULLISH_BOS",
  BEARISH_BOS = "BEARISH_BOS",
  // Session subtypes
  LONDON_OPEN = "LONDON_OPEN",
  NY_OPEN = "NY_OPEN",
  ASIAN_SESSION = "ASIAN_SESSION",
}

export enum MarketRegime {
  TRENDING_UP = "TRENDING_UP",
  TRENDING_DOWN = "TRENDING_DOWN",
  RANGING = "RANGING",
  VOLATILE = "VOLATILE",
}

export enum AssetClass {
  STOCK = "STOCK",
  FOREX = "FOREX",
  CRYPTO = "CRYPTO",
}

// ─── Interfaces ───

export interface AnalysisContext {
  timeframe_cascade: {
    macro: string;       // e.g. "D1", "4H"
    intermediate: string;
    execution: string;
  };
  market_regime: MarketRegime;
  session_context: string; // "LONDON_OPEN", "NY_CLOSE", etc.
  htf_bias: "BULLISH" | "BEARISH" | "NEUTRAL";
  confluence_factors: {
    has_structure_break?: boolean;
    has_fvg_alignment?: boolean;
    has_ob_alignment?: boolean;
    has_session_alignment?: boolean;
    multiple_timeframe_confirmation?: boolean;
    sector_divergence?: boolean;
  };
}

export interface ParameterSnapshot {
  asset_class: AssetClass;
  setup_type: SetupType;
  fvg_proximity_threshold?: number;
  ob_proximity_threshold?: number;
  confluence_requirement: number;
  confidence_floor: number;
  session_filter_active: boolean;
  smt_weight?: number;
  sweep_magnitude_threshold?: number;
  [key: string]: any;
}

export interface SetupQualityFactors {
  structure_confluence: number; // 0-3
  liquidity_quality: number;    // 0-5
  confluence_count: number;
}

export interface TradeOutcome {
  actual_entry_price: number;
  actual_exit_price: number;
  pnl: number;
  pnl_percent: number;
  win: boolean;
  exit_reason: "TP_HIT" | "SL_HIT" | "TIMEOUT" | "MARKET_CLOSE" | "PENDING";
  bars_to_exit: number;
  closed_at?: string;
}

export interface UnifiedTradeSignal {
  id: string;
  timestamp: string; // ISO date
  asset_class: AssetClass;
  symbol: string;

  setup_type: SetupType;
  setup_subtype: SetupSubtype;

  entry_price: number;
  stop_loss: number;
  take_profit: number;
  suggested_qty?: number;
  risk_reward_ratio: number;

  confidence_score: number; // 0-100
  setup_quality_factors: SetupQualityFactors;

  analysis_context: AnalysisContext;
  parameter_snapshot: ParameterSnapshot;

  rationale: {
    structure_confluence: string;
    liquidity_quality: string;
    session_context_reason?: string;
  };

  outcome?: TradeOutcome;

  version: string;
  source?: string;
}

export interface SignalBatch {
  generated_at: string;
  signals: UnifiedTradeSignal[];
  batch_id: string;
}

// ─── Zod Schemas (for API validation) ───

export const setupQualityFactorsSchema = z.object({
  structure_confluence: z.number().min(0).max(3),
  liquidity_quality: z.number().min(0).max(5),
  confluence_count: z.number().min(0),
});

export const tradeOutcomeSchema = z.object({
  actual_entry_price: z.number(),
  actual_exit_price: z.number(),
  pnl: z.number(),
  pnl_percent: z.number(),
  win: z.boolean(),
  exit_reason: z.enum(["TP_HIT", "SL_HIT", "TIMEOUT", "MARKET_CLOSE", "PENDING"]),
  bars_to_exit: z.number().int().min(1),
  closed_at: z.string().optional(),
});

export const analysisContextSchema = z.object({
  timeframe_cascade: z.object({
    macro: z.string(),
    intermediate: z.string(),
    execution: z.string(),
  }),
  market_regime: z.nativeEnum(MarketRegime),
  session_context: z.string(),
  htf_bias: z.enum(["BULLISH", "BEARISH", "NEUTRAL"]),
  confluence_factors: z.object({
    has_structure_break: z.boolean().optional(),
    has_fvg_alignment: z.boolean().optional(),
    has_ob_alignment: z.boolean().optional(),
    has_session_alignment: z.boolean().optional(),
    multiple_timeframe_confirmation: z.boolean().optional(),
    sector_divergence: z.boolean().optional(),
  }),
});

export const parameterSnapshotSchema = z.object({
  asset_class: z.nativeEnum(AssetClass),
  setup_type: z.nativeEnum(SetupType),
  fvg_proximity_threshold: z.number().optional(),
  ob_proximity_threshold: z.number().optional(),
  confluence_requirement: z.number(),
  confidence_floor: z.number(),
  session_filter_active: z.boolean(),
  smt_weight: z.number().optional(),
  sweep_magnitude_threshold: z.number().optional(),
}).passthrough();

export const unifiedTradeSignalSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  asset_class: z.nativeEnum(AssetClass),
  symbol: z.string(),
  setup_type: z.nativeEnum(SetupType),
  setup_subtype: z.nativeEnum(SetupSubtype),
  entry_price: z.number(),
  stop_loss: z.number(),
  take_profit: z.number(),
  suggested_qty: z.number().optional(),
  risk_reward_ratio: z.number(),
  confidence_score: z.number().min(0).max(100),
  setup_quality_factors: setupQualityFactorsSchema,
  analysis_context: analysisContextSchema,
  parameter_snapshot: parameterSnapshotSchema,
  rationale: z.object({
    structure_confluence: z.string(),
    liquidity_quality: z.string(),
    session_context_reason: z.string().optional(),
  }),
  outcome: tradeOutcomeSchema.optional(),
  version: z.string(),
  source: z.string().optional(),
});

export const signalBatchSchema = z.object({
  generated_at: z.string(),
  signals: z.array(unifiedTradeSignalSchema),
  batch_id: z.string(),
});
