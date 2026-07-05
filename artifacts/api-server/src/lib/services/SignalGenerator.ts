import type { SmcReport, DrawTarget, Market } from "../smc/types.js";

// ─── Enums (mirrored for server-side use without zod dependency) ───

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
  BULLISH_OB = "BULLISH_OB",
  BEARISH_OB = "BEARISH_OB",
  BREAKER_BLOCK = "BREAKER_BLOCK",
  FVG_MITIGATION = "FVG_MITIGATION",
  FVG_FILL = "FVG_FILL",
  BULLISH_MSS = "BULLISH_MSS",
  BEARISH_MSS = "BEARISH_MSS",
  BULLISH_CHOCH = "BULLISH_CHOCH",
  BEARISH_CHOCH = "BEARISH_CHOCH",
  BULLISH_BOS = "BULLISH_BOS",
  BEARISH_BOS = "BEARISH_BOS",
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

// ─── Signal Generator Types ───

export interface UnifiedTradeSignal {
  id: string;
  timestamp: string;
  asset_class: AssetClass;
  symbol: string;
  setup_type: SetupType;
  setup_subtype: SetupSubtype;
  entry_price: number;
  stop_loss: number;
  take_profit: number;
  suggested_qty?: number;
  risk_reward_ratio: number;
  confidence_score: number;
  setup_quality_factors: {
    structure_confluence: number;
    liquidity_quality: number;
    confluence_count: number;
  };
  analysis_context: {
    timeframe_cascade: { macro: string; intermediate: string; execution: string };
    market_regime: MarketRegime;
    session_context: string;
    htf_bias: "BULLISH" | "BEARISH" | "NEUTRAL";
    confluence_factors: Record<string, boolean>;
  };
  parameter_snapshot: Record<string, any>;
  rationale: {
    structure_confluence: string;
    liquidity_quality: string;
    session_context_reason?: string;
  };
  outcome?: {
    actual_entry_price: number;
    actual_exit_price: number;
    pnl: number;
    pnl_percent: number;
    win: boolean;
    exit_reason: "TP_HIT" | "SL_HIT" | "TIMEOUT" | "MARKET_CLOSE" | "PENDING";
    bars_to_exit: number;
    closed_at?: string;
  };
  version: string;
  source?: string;
}

export interface SignalBatch {
  generated_at: string;
  signals: UnifiedTradeSignal[];
  batch_id: string;
}

// ─── Helpers ───

function detectMarketRegime(
  report: SmcReport
): MarketRegime {
  const phase = report.structure.phase;
  if (phase === "expansion") return MarketRegime.TRENDING_UP;
  if (phase === "distribution") return MarketRegime.TRENDING_DOWN;
  if (phase === "accumulation" || phase === "manipulation") return MarketRegime.RANGING;
  if (phase === "continuation") {
    return report.structure.bias === "bullish"
      ? MarketRegime.TRENDING_UP
      : report.structure.bias === "bearish"
        ? MarketRegime.TRENDING_DOWN
        : MarketRegime.RANGING;
  }
  return MarketRegime.VOLATILE;
}

function detectSetupType(report: SmcReport): { type: SetupType; subtype: SetupSubtype } {
  const liveOBs = report.orderBlocks.filter((ob) => ob.valid && !ob.isMitigated);
  const unfilledFVGs = report.fvg.filter((g) => g.fillFraction < 0.5);
  const breaks = report.structure.breaks;

  // Prioritize: OB > FVG > CHoCH > BOS > MSS > LIQUIDITY_SWEEP > SESSION_BREAKOUT
  if (liveOBs.length > 0) {
    const bestOB = liveOBs.sort((a, b) => b.confidence - a.confidence)[0];
    if (bestOB.isBreaker) {
      return { type: SetupType.OB, subtype: SetupSubtype.BREAKER_BLOCK };
    }
    return {
      type: SetupType.OB,
      subtype: bestOB.type === "bullish" ? SetupSubtype.BULLISH_OB : SetupSubtype.BEARISH_OB,
    };
  }

  if (unfilledFVGs.length > 0) {
    const bestFVG = unfilledFVGs.sort((a, b) => b.fillFraction - a.fillFraction)[0];
    return {
      type: SetupType.FVG,
      subtype: bestFVG.fillFraction > 0 ? SetupSubtype.FVG_MITIGATION : SetupSubtype.FVG_FILL,
    };
  }

  if (breaks.length > 0) {
    const lastBreak = breaks[breaks.length - 1];
    if (lastBreak.type === "CHoCH") {
      return {
        type: SetupType.CHoCH,
        subtype:
          lastBreak.direction === "bullish"
            ? SetupSubtype.BULLISH_CHOCH
            : SetupSubtype.BEARISH_CHOCH,
      };
    }
    if (lastBreak.type === "BOS") {
      return {
        type: SetupType.BOS,
        subtype:
          lastBreak.direction === "bullish"
            ? SetupSubtype.BULLISH_BOS
            : SetupSubtype.BEARISH_BOS,
      };
    }
  }

  // Fallback: check for liquidity sweeps
  const sweptPools = report.liquidity.pools.filter((p) => p.wasSwept);
  if (sweptPools.length > 0) {
    return { type: SetupType.LIQUIDITY_SWEEP, subtype: SetupSubtype.BULLISH_CHOCH };
  }

  return { type: SetupType.SESSION_BREAKOUT, subtype: SetupSubtype.LONDON_OPEN };
}

function deriveBias(report: SmcReport): "BULLISH" | "BEARISH" | "NEUTRAL" {
  const structBias = report.structure.bias;
  const dailyBias = report.dailyBias.bias;

  if (structBias !== "neutral") return structBias.toUpperCase() as "BULLISH" | "BEARISH";
  if (dailyBias !== "neutral") return dailyBias.toUpperCase() as "BULLISH" | "BEARISH";
  return "NEUTRAL";
}

function detectSessionContext(report: SmcReport): string {
  return report.sessionState || "OFF_HOURS";
}

// ICT-style timeframe cascade: higher TFs set bias, execution TF triggers entry.
// macro = 2 steps above execution, intermediate = 1 step above execution.
const TF_STEPS = ["1m", "5m", "15m", "1h", "4h", "1d", "1w"];

function computeCascade(executionTf: string): { macro: string; intermediate: string; execution: string } {
  const idx = TF_STEPS.indexOf(executionTf);
  if (idx < 0) return { macro: "D1", intermediate: "1h", execution: executionTf };

  // Go UP in timeframe: intermediate = 1 step larger, macro = 2 steps larger
  const intermediate = idx + 1 < TF_STEPS.length ? TF_STEPS[idx + 1] : executionTf;
  const macro = idx + 2 < TF_STEPS.length ? TF_STEPS[idx + 2] : intermediate;
  return { macro, intermediate, execution: executionTf };
}

// ─── Main Signal Generator ───

/**
 * Generates UnifiedTradeSignal objects from an SmcReport.
 *
 * Extracts and formalizes the trade setup derivation logic from the frontend
 * IntelligenceSheet and ConfluenceSheet components into a reusable service.
 */
export class SignalGenerator {
  private idCounter = 0;

  /**
   * Generate a single-tf trade signal from an SmcReport.
   * Mirrors the logic in IntelligenceSheet.tsx:deriveSetup()
   */
  generateFromReport(
    report: SmcReport,
    market: Market,
    options?: {
      qty?: number;
      source?: string;
    }
  ): UnifiedTradeSignal | null {
    const bias = deriveBias(report);
    const direction = bias === "BULLISH" ? "long" : bias === "BEARISH" ? "short" : null;
    if (!direction) return null;

    const liveOBs = report.orderBlocks.filter((ob) => ob.valid && !ob.isMitigated);
    const unfilledFVGs = report.fvg.filter((g) => g.fillFraction < 0.5);

    // ── Entry zone ──
    let entryLow: number | null = null;
    let entryHigh: number | null = null;
    let entrySource = "";

    if (direction === "long") {
      const ob = liveOBs
        .filter((ob) => ob.type === "bullish" && ob.proximal < report.currentPrice)
        .sort((a, b) => b.proximal - a.proximal)[0];
      const fvg = unfilledFVGs
        .filter((g) => g.type === "bullish" && g.top < report.currentPrice)
        .sort((a, b) => b.top - a.top)[0];
      if (ob) {
        entryLow = Math.min(ob.proximal, ob.distal);
        entryHigh = Math.max(ob.proximal, ob.distal);
        entrySource = ob.hasFvg ? "OB + FVG" : "Order Block";
      } else if (fvg) {
        entryLow = fvg.bottom;
        entryHigh = fvg.top;
        entrySource = "FVG";
      }
    } else {
      const ob = liveOBs
        .filter((ob) => ob.type === "bearish" && ob.proximal > report.currentPrice)
        .sort((a, b) => a.proximal - b.proximal)[0];
      const fvg = unfilledFVGs
        .filter((g) => g.type === "bearish" && g.bottom > report.currentPrice)
        .sort((a, b) => a.bottom - b.bottom)[0];
      if (ob) {
        entryLow = Math.min(ob.proximal, ob.distal);
        entryHigh = Math.max(ob.proximal, ob.distal);
        entrySource = ob.hasFvg ? "OB + FVG" : "Order Block";
      } else if (fvg) {
        entryLow = fvg.bottom;
        entryHigh = fvg.top;
        entrySource = "FVG";
      }
    }

    if (entryLow === null || entryHigh === null) return null;

    const entryPrice = (entryLow + entryHigh) / 2;

    // ── Stop Loss ──
    let stopLoss: number | null = null;
    if (direction === "long") {
      const sslPrice = report.liquidity.nearestSSL?.price;
      if (sslPrice && sslPrice < report.currentPrice) {
        stopLoss = sslPrice * 0.9995;
      } else {
        stopLoss = entryLow * 0.9985;
      }
    } else {
      const bslPrice = report.liquidity.nearestBSL?.price;
      if (bslPrice && bslPrice > report.currentPrice) {
        stopLoss = bslPrice * 1.0005;
      } else {
        stopLoss = entryHigh * 1.0015;
      }
    }

    // ── Take Profit ──
    const tp1 = report.draw[0] ?? null;
    const takeProfit = tp1?.price ?? (direction === "long" ? entryPrice * 1.02 : entryPrice * 0.98);

    // ── R:R ──
    const risk = Math.abs(entryPrice - stopLoss);
    const reward = Math.abs(takeProfit - entryPrice);
    const rrRatio = risk > 0 ? reward / risk : 1;

    // ── Setup detection ──
    const { type: setupType, subtype: setupSubtype } = detectSetupType(report);
    const regime = detectMarketRegime(report);
    const htfBias = deriveBias(report);
    const sessionContext = detectSessionContext(report);

    // ── Confluence checklist ──
    const hasStructureAlign = report.structure.bias !== "neutral";
    const hasFvgAlign = unfilledFVGs.length > 0;
    const hasOBAlign = liveOBs.length > 0;
    const correctPDZone =
      direction === "long"
        ? report.pdArray.currentBias === "discount"
        : report.pdArray.currentBias === "premium";
    const hasDraw = report.draw.length > 0;
    const smtSupports = report.smt.detected;

    const confluenceCount = [
      hasStructureAlign,
      hasFvgAlign,
      hasOBAlign,
      correctPDZone,
      hasDraw,
      smtSupports,
    ].filter(Boolean).length;

    const confidenceScore = Math.round(
      (report.structure.confidence * 30 +
        (confluenceCount / 6) * 40 +
        (liveOBs.length > 0 ? liveOBs[0].confidence * 30 : 15))
    );

    const id = `${report.symbol}_${report.timeframe}_${Date.now()}_${++this.idCounter}`;

    const signal: UnifiedTradeSignal = {
      id,
      timestamp: new Date(report.generatedAt * 1000).toISOString(),
      asset_class: market === "crypto" ? AssetClass.CRYPTO : AssetClass.FOREX,
      symbol: report.symbol,
      setup_type: setupType,
      setup_subtype: setupSubtype,
      entry_price: entryPrice,
      stop_loss: stopLoss,
      take_profit: takeProfit,
      suggested_qty: options?.qty ?? 100,
      risk_reward_ratio: Math.round(rrRatio * 100) / 100,
      confidence_score: Math.min(100, Math.max(0, confidenceScore)),
      setup_quality_factors: {
        structure_confluence: hasStructureAlign ? (report.structure.confidence > 0.7 ? 2 : 1) : 0,
        liquidity_quality: report.liquidity.pools.length > 0 ? 3 : 1,
        confluence_count: confluenceCount,
      },
      analysis_context: {
        timeframe_cascade: computeCascade(report.timeframe),
        market_regime: regime,
        session_context: sessionContext,
        htf_bias: htfBias,
        confluence_factors: {
          has_structure_break: report.structure.breaks.length > 0,
          has_fvg_alignment: hasFvgAlign,
          has_ob_alignment: hasOBAlign,
          has_session_alignment: sessionContext !== "OFF_HOURS",
          multiple_timeframe_confirmation: confluenceCount >= 4,
        },
      },
      parameter_snapshot: {
        asset_class: market === "crypto" ? AssetClass.CRYPTO : AssetClass.FOREX,
        setup_type: setupType,
        confluence_requirement: 3,
        confidence_floor: 60,
        session_filter_active: true,
      },
      rationale: {
        structure_confluence: hasStructureAlign
          ? `Structure bias ${report.structure.bias} with ${Math.round(report.structure.confidence * 100)}% confidence`
          : "Structure neutral — relying on other factors",
        liquidity_quality:
          report.liquidity.pools.length > 0
            ? `${report.liquidity.pools.length} liquidity pools identified`
            : "No clear liquidity pools",
        session_context_reason: sessionContext,
      },
      version: "1.0",
      source: options?.source ?? "SIGNAL_GENERATOR",
    };

    return signal;
  }

  /**
   * Generate signals from multiple SmcReports (multi-TF cascade).
   * Mirrors the logic in ConfluenceSheet.tsx:deriveMultiTfSetup()
   */
  generateFromCascade(
    sortedReports: Array<{ tf: string; report: SmcReport; role: string }>,
    market: Market,
    options?: { qty?: number; source?: string }
  ): UnifiedTradeSignal | null {
    const anchorItem = sortedReports.find((r) => r.role === "BIAS SETTER") ?? sortedReports[0];
    const confirmItem =
      sortedReports.find((r) => r.role === "CONFIRMATION") ??
      sortedReports[Math.floor(sortedReports.length / 2)];
    const entryItem =
      [...sortedReports].reverse().find((r) => r.role === "ENTRY TRIGGER") ??
      sortedReports[sortedReports.length - 1];

    const anchorBias = deriveBias(anchorItem.report);
    const direction = anchorBias === "BULLISH" ? "long" : anchorBias === "BEARISH" ? "short" : null;
    if (!direction) return null;

    const entryReport = entryItem.report;
    const confirmReport = confirmItem.report;
    const anchorReport = anchorItem.report;

    const liveOBs = entryReport.orderBlocks.filter((ob) => ob.valid && !ob.isMitigated);
    const unfilledFVGs = entryReport.fvg.filter((g) => g.fillFraction < 0.5);

    // Entry zone from entry TF
    let entryLow: number | null = null;
    let entryHigh: number | null = null;
    let entrySource = "";

    if (direction === "long") {
      const ob = liveOBs
        .filter((ob) => ob.type === "bullish" && ob.proximal < entryReport.currentPrice)
        .sort((a, b) => b.proximal - a.proximal)[0];
      const fvg = unfilledFVGs
        .filter((g) => g.type === "bullish" && g.top < entryReport.currentPrice)
        .sort((a, b) => b.top - a.top)[0];
      if (ob) {
        entryLow = Math.min(ob.proximal, ob.distal);
        entryHigh = Math.max(ob.proximal, ob.distal);
        entrySource = ob.hasFvg ? "OB + FVG (entry TF)" : `Order Block (${entryItem.tf})`;
      } else if (fvg) {
        entryLow = fvg.bottom;
        entryHigh = fvg.top;
        entrySource = `FVG (${entryItem.tf})`;
      }
    } else {
      const ob = liveOBs
        .filter((ob) => ob.type === "bearish" && ob.proximal > entryReport.currentPrice)
        .sort((a, b) => a.proximal - b.proximal)[0];
      const fvg = unfilledFVGs
        .filter((g) => g.type === "bearish" && g.bottom > entryReport.currentPrice)
        .sort((a, b) => a.bottom - b.bottom)[0];
      if (ob) {
        entryLow = Math.min(ob.proximal, ob.distal);
        entryHigh = Math.max(ob.proximal, ob.distal);
        entrySource = ob.hasFvg ? "OB + FVG (entry TF)" : `Order Block (${entryItem.tf})`;
      } else if (fvg) {
        entryLow = fvg.bottom;
        entryHigh = fvg.top;
        entrySource = `FVG (${entryItem.tf})`;
      }
    }

    if (entryLow === null || entryHigh === null) return null;

    const entryPrice = (entryLow + entryHigh) / 2;

    // SL from entry TF liquidity
    let stopLoss: number;
    if (direction === "long") {
      const ssl = entryReport.liquidity.nearestSSL?.price;
      stopLoss = ssl && ssl < entryReport.currentPrice ? ssl * 0.9995 : entryLow * 0.9985;
    } else {
      const bsl = entryReport.liquidity.nearestBSL?.price;
      stopLoss = bsl && bsl > entryReport.currentPrice ? bsl * 1.0005 : entryHigh * 1.0015;
    }

    // TP1 from confirmation TF, TP2 from anchor TF
    const tp1 = confirmReport.draw[0] ?? entryReport.draw[0] ?? null;
    const takeProfit = tp1?.price ?? (direction === "long" ? entryPrice * 1.02 : entryPrice * 0.98);

    const risk = Math.abs(entryPrice - stopLoss);
    const reward = Math.abs(takeProfit - entryPrice);
    const rrRatio = risk > 0 ? reward / risk : 1;

    // Multi-TF confluence
    const htfAligned = deriveBias(anchorReport) === anchorBias;
    const mtfAligned = deriveBias(confirmReport) === anchorBias;
    const ltfAligned = deriveBias(entryReport) === anchorBias;
    const correctPDZone =
      direction === "long"
        ? entryReport.pdArray.currentBias === "discount"
        : entryReport.pdArray.currentBias === "premium";
    const hasDraw = entryReport.draw.length > 0;
    const smtSupports = sortedReports.some((r) => r.report.smt.detected);

    const confluenceCount = [
      htfAligned,
      mtfAligned,
      ltfAligned,
      correctPDZone,
      hasDraw,
      smtSupports,
    ].filter(Boolean).length;

    const confidenceScore = Math.round((confluenceCount / 6) * 100);

    const { type: setupType, subtype: setupSubtype } = detectSetupType(entryReport);
    const regime = detectMarketRegime(entryReport);

    const id = `${entryReport.symbol}_CASCADE_${Date.now()}_${++this.idCounter}`;

    const signal: UnifiedTradeSignal = {
      id,
      timestamp: new Date().toISOString(),
      asset_class: market === "crypto" ? AssetClass.CRYPTO : AssetClass.FOREX,
      symbol: entryReport.symbol,
      setup_type: setupType,
      setup_subtype: setupSubtype,
      entry_price: entryPrice,
      stop_loss: stopLoss,
      take_profit: takeProfit,
      suggested_qty: options?.qty ?? 100,
      risk_reward_ratio: Math.round(rrRatio * 100) / 100,
      confidence_score: Math.min(100, Math.max(0, confidenceScore)),
      setup_quality_factors: {
        structure_confluence: htfAligned ? (mtfAligned ? 3 : 2) : 1,
        liquidity_quality: entryReport.liquidity.pools.length > 0 ? 3 : 1,
        confluence_count: confluenceCount,
      },
      analysis_context: {
        timeframe_cascade: {
          macro: anchorItem.tf,
          intermediate: confirmItem.tf,
          execution: entryItem.tf,
        },
        market_regime: regime,
        session_context: detectSessionContext(entryReport),
        htf_bias: anchorBias,
        confluence_factors: {
          has_structure_break: entryReport.structure.breaks.length > 0,
          has_fvg_alignment: unfilledFVGs.length > 0,
          has_ob_alignment: liveOBs.length > 0,
          has_session_alignment: true,
          multiple_timeframe_confirmation: htfAligned && mtfAligned && ltfAligned,
        },
      },
      parameter_snapshot: {
        asset_class: market === "crypto" ? AssetClass.CRYPTO : AssetClass.FOREX,
        setup_type: setupType,
        confluence_requirement: 4,
        confidence_floor: 60,
        session_filter_active: true,
      },
      rationale: {
        structure_confluence: `HTF ${anchorItem.tf} bias: ${anchorBias}, MTF ${confirmItem.tf} ${mtfAligned ? "confirms" : "diverges"}`,
        liquidity_quality:
          entryReport.liquidity.pools.length > 0
            ? `${entryReport.liquidity.pools.length} pools on entry TF`
            : "No clear pools",
        session_context_reason: detectSessionContext(entryReport),
      },
      version: "1.0",
      source: options?.source ?? "MULTI_TF_CASCADE",
    };

    return signal;
  }
}
