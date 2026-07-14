/**
 * Comparison Engine — Phase 2
 *
 * Compares TradingView/Pine outputs vs Internal SMC Engine outputs
 * for every detection type across every market event.
 *
 * Every comparison produces structured evidence: never plain strings.
 */

import { z } from "zod";
import { logger } from "../logger.js";
import { evaluate, safeString, KNOWN_PATHS } from "../integrations/tradingview-desktop/core/connection.js";

// ─── Detection Types ────────────────────────────────────────────────────

export const DETECTION_TYPES = [
  "OB", "FVG", "BOS", "CHOCH", "MSS",
  "LIQUIDITY_SWEEP", "EQH", "EQL",
  "PREMIUM", "DISCOUNT", "SMT",
  "SESSION_BREAKOUT", "DISPLACEMENT", "BIAS",
] as const;

export type DetectionType = typeof DETECTION_TYPES[number];

// ─── Comparison Result ──────────────────────────────────────────────────

export interface DetectionPoint {
  detectionType: DetectionType;
  price: number;
  confidence: number;
  metadata: Record<string, any>;
}

export interface ComparisonRecord {
  symbol: string;
  timeframe: string;
  market: string;
  detectionType: DetectionType;
  priceLevel: number;
  tv: { detected: boolean; confidence: number | null; price: number | null; metadata: Record<string, any> };
  engine: { detected: boolean; confidence: number | null; price: number | null; metadata: Record<string, any> };
  agreement: "BOTH_DETECTED" | "TV_ONLY" | "ENGINE_ONLY" | "NEITHER";
  priceDiscrepancyPct: number | null;
  confidenceGap: number | null;
  candleTime: Date;
  signalId: string | null;
}

// ─── Pine Indicator Reader ──────────────────────────────────────────────

/**
 * Extract detection points from a TradingView indicator.
 * Reads the indicator's current computed values from the chart.
 * @param indicatorName — Case-insensitive indicator name to search for
 */
export async function readPineDetections(indicatorName: string): Promise<DetectionPoint[]> {
  const results: DetectionPoint[] = [];
  const studies = await evaluate(`
    (function() {
      var chart = ${KNOWN_PATHS.CHART_API}._chartWidget;
      var model = chart.model();
      var sources = model.model().dataSources();
      var target = [];
      var filter = ${safeString(indicatorName.toLowerCase())};
      for (var si = 0; si < sources.length; si++) {
        var s = sources[si];
        if (!s.metaInfo) continue;
        try {
          var meta = s.metaInfo();
          var name = (meta.description || meta.shortDescription || '').toLowerCase();
          if (name.indexOf(filter) === -1) continue;
          var values = {};
          try {
            var dwv = s.dataWindowView();
            if (dwv) {
              var items = dwv.items();
              for (var i = 0; i < items.length; i++) {
                var item = items[i];
                if (item._value && item._value !== '∅' && item._title) values[item._title] = item._value;
              }
            }
          } catch(e) {}
          target.push({ name: name, values: values, inputs: s.inputs ? s.inputs() : null });
        } catch(e) {}
      }
      return JSON.stringify(target);
    })()
  `) as string | null;

  if (!studies) return [];
  try {
    const parsed = JSON.parse(studies);
    for (const study of parsed) {
      for (const [key, val] of Object.entries(study.values)) {
        // Strip locale formatting (commas) before parse — e.g. "64,515.47" -> 64515.47
        const cleanedVal = typeof val === "string" ? val.replace(/,/g, "") : val;
        const numericVal = typeof cleanedVal === "number" ? cleanedVal : parseFloat(String(cleanedVal));
        if (!isNaN(numericVal)) {
          results.push({
            detectionType: mapPineLabelToType(key, study.name),
            price: numericVal,
            confidence: 0.8, // Default — TV indicators don't output confidence natively
            metadata: { indicator: study.name, label: key, rawValue: val },
          });
        }
      }
    }
  } catch { /* ignore parse errors */ }
  return results;
}

/**
 * Read Pine Script horizontal lines from indicator graphics.
 * More reliable than dataWindowView for levels.
 */
export async function readPineLineLevels(studyFilter?: string): Promise<DetectionPoint[]> {
  const levels: DetectionPoint[] = [];
  const raw = await evaluate(`
    (function() {
      var chart = ${KNOWN_PATHS.CHART_API}._chartWidget;
      var model = chart.model();
      var sources = model.model().dataSources();
      var results = [];
      var filter = ${safeString(studyFilter || '')};
      for (var si = 0; si < sources.length; si++) {
        var s = sources[si]; if (!s.metaInfo) continue;
        try {
          var meta = s.metaInfo();
          var name = (meta.description || meta.shortDescription || '').toLowerCase();
          if (!name) continue;
          if (filter && name.indexOf(filter.toLowerCase()) === -1) continue;
          var g = s._graphics; if (!g || !g._primitivesCollection) continue;
          var outer = g._primitivesCollection.dwglines;
          if (!outer) continue;
          var inner = outer.get('lines'); if (!inner) continue;
          var coll = inner.get(false);
          if (!coll || !coll._primitivesDataById) continue;
          coll._primitivesDataById.forEach(function(v, id) {
            if (v.y1 != null && v.y1 === v.y2) {
              results.push({ level: v.y1, color: v.ci, indicator: name });
            }
          });
        } catch(e) {}
      }
      return JSON.stringify(results);
    })()
  `) as string | null;

  if (!raw) return levels;
  try {
    const parsed = JSON.parse(raw);
    for (const item of parsed) {
      levels.push({
        detectionType: mapPineLineToType(item.indicator, item.color),
        price: item.level,
        confidence: 0.75,
        metadata: { indicator: item.indicator, color: item.color },
      });
    }
  } catch { /* ignore */ }
  return levels;
}

// ─── Engine Reading ────────────────────────────────────────────────────

/**
 * Extract detection points from the internal SMC Engine's SmcReport.
 */
export function extractEngineDetections(report: {
  structure: { bias: string; trend: string; confidence: number; pivots: any[]; breaks: any[]; phase: string };
  liquidity: { pools: any[]; nearestBSL: any; nearestSSL: any };
  orderBlocks: any[];
  fvg: any[];
  pdArray: { currentBias: string; dealingRange: { high: number; low: number }; equilibrium: number };
  dailyBias: { bias: string; strength: number };
  smt: { detected: boolean; type: string | null; confidence: number };
  draw: any[];
}): DetectionPoint[] {
  const detections: DetectionPoint[] = [];

  // Structure bias
  if (report.structure.bias !== "neutral") {
    detections.push({
      detectionType: "BIAS",
      price: 0,
      confidence: report.structure.confidence,
      metadata: { bias: report.structure.bias, trend: report.structure.trend, phase: report.structure.phase },
    });
  }

  // Order blocks
  for (const ob of report.orderBlocks.filter((o: any) => o.valid && !o.isMitigated)) {
    detections.push({
      detectionType: "OB",
      price: ob.proximal,
      confidence: ob.confidence,
      metadata: { type: ob.type, distal: ob.distal, isBreaker: ob.isBreaker, hasFvg: ob.hasFvg },
    });
  }

  // FVGs
  for (const fvg of report.fvg.filter((g: any) => g.fillFraction < 0.5)) {
    detections.push({
      detectionType: "FVG",
      price: (fvg.top + fvg.bottom) / 2,
      confidence: 1 - fvg.fillFraction,
      metadata: { type: fvg.type, top: fvg.top, bottom: fvg.bottom, isInversion: fvg.isInversion },
    });
  }

  // Liquidity levels
  if (report.liquidity.nearestBSL) {
    detections.push({
      detectionType: "LIQUIDITY_SWEEP",
      price: report.liquidity.nearestBSL.price,
      confidence: report.liquidity.nearestBSL.probabilityOfSweep,
      metadata: { poolType: "BSL", score: report.liquidity.nearestBSL.score },
    });
  }
  if (report.liquidity.nearestSSL) {
    detections.push({
      detectionType: "LIQUIDITY_SWEEP",
      price: report.liquidity.nearestSSL.price,
      confidence: report.liquidity.nearestSSL.probabilityOfSweep,
      metadata: { poolType: "SSL", score: report.liquidity.nearestSSL.score },
    });
  }

  // Structure breaks
  for (const brk of report.structure.breaks.slice(-3)) {
    detections.push({
      detectionType: brk.type === "BOS" ? "BOS" : "CHOCH",
      price: brk.price,
      confidence: report.structure.confidence,
      metadata: { direction: brk.direction, time: brk.time },
    });
  }

  // PD Array
  if (report.pdArray.currentBias !== "equilibrium") {
    detections.push({
      detectionType: report.pdArray.currentBias === "premium" ? "PREMIUM" : "DISCOUNT",
      price: report.pdArray.equilibrium,
      confidence: 0.7,
      metadata: { zone: report.pdArray.currentBias },
    });
  }

  // SMT
  if (report.smt.detected) {
    detections.push({
      detectionType: "SMT",
      price: 0,
      confidence: report.smt.confidence,
      metadata: { divergenceType: report.smt.type },
    });
  }

  return detections;
}

// ─── Core Comparison ───────────────────────────────────────────────────

/**
 * Compare TV/Pine detections against Internal Engine detections
 * and produce structured ComparisonRecords.
 */
export function compareDetections(
  symbol: string,
  timeframe: string,
  market: string,
  tvDetections: DetectionPoint[],
  engineDetections: DetectionPoint[],
  candleTime: Date,
  signalId: string | null = null,
): ComparisonRecord[] {
  const records: ComparisonRecord[] = [];
  const processed = new Set<string>();

  // Group both arrays by detection type
  const tvByType = groupByType(tvDetections);
  const engineByType = groupByType(engineDetections);

  const allTypes = new Set([...tvByType.keys(), ...engineByType.keys()]);

  for (const dType of allTypes) {
    const tvPoints = tvByType.get(dType as DetectionType) || [];
    const enginePoints = engineByType.get(dType as DetectionType) || [];

    // Match nearest TV-to-Engine by price proximity
    const matchedPairs: Array<{ tv: DetectionPoint | null; engine: DetectionPoint | null }> = [];
    const tvUsed = new Set<number>();
    const engineUsed = new Set<number>();

    for (let ti = 0; ti < tvPoints.length; ti++) {
      let bestDist = Infinity;
      let bestEi = -1;
      for (let ei = 0; ei < enginePoints.length; ei++) {
        if (engineUsed.has(ei)) continue;
        const dist = Math.abs(tvPoints[ti].price - enginePoints[ei].price);
        if (dist < bestDist && dist < 0.005) { // within 0.5% price proximity
          bestDist = dist;
          bestEi = ei;
        }
      }
      if (bestEi >= 0) {
        tvUsed.add(ti);
        engineUsed.add(bestEi);
        matchedPairs.push({ tv: tvPoints[ti], engine: enginePoints[bestEi] });
      } else {
        matchedPairs.push({ tv: tvPoints[ti], engine: null });
      }
    }
    // Unmatched engine points
    for (let ei = 0; ei < enginePoints.length; ei++) {
      if (!engineUsed.has(ei)) {
        matchedPairs.push({ tv: null, engine: enginePoints[ei] });
      }
    }

    // Build records
    for (const pair of matchedPairs) {
      const priceLevel = pair.engine?.price ?? pair.tv?.price ?? 0;
      const priceDisc = (pair.tv && pair.engine)
        ? Math.abs(pair.tv.price - pair.engine.price) / Math.max(Math.abs(pair.tv.price), 0.0001)
        : null;
      const confGap = (pair.tv?.confidence != null && pair.engine?.confidence != null)
        ? pair.tv.confidence - pair.engine.confidence
        : null;

      let agreement: ComparisonRecord["agreement"] = "NEITHER";
      if (pair.tv && pair.engine) agreement = "BOTH_DETECTED";
      else if (pair.tv && !pair.engine) agreement = "TV_ONLY";
      else if (!pair.tv && pair.engine) agreement = "ENGINE_ONLY";

      records.push({
        symbol,
        timeframe,
        market,
        detectionType: dType as DetectionType,
        priceLevel,
        tv: {
          detected: !!pair.tv,
          confidence: pair.tv?.confidence ?? null,
          price: pair.tv?.price ?? null,
          metadata: pair.tv?.metadata ?? {},
        },
        engine: {
          detected: !!pair.engine,
          confidence: pair.engine?.confidence ?? null,
          price: pair.engine?.price ?? null,
          metadata: pair.engine?.metadata ?? {},
        },
        agreement,
        priceDiscrepancyPct: priceDisc != null ? Math.round(priceDisc * 10000) / 10000 : null,
        confidenceGap: confGap != null ? Math.round(confGap * 10000) / 10000 : null,
        candleTime,
        signalId,
      });
    }
  }

  return records;
}

// ─── Helpers ───────────────────────────────────────────────────────────

function groupByType(detections: DetectionPoint[]): Map<string, DetectionPoint[]> {
  const map = new Map<string, DetectionPoint[]>();
  for (const d of detections) {
    const key = d.detectionType;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(d);
  }
  return map;
}

function mapPineLabelToType(label: string, indicatorName: string): DetectionType {
  const l = label.toLowerCase();
  const n = indicatorName.toLowerCase();
  if (l.includes("ob") || l.includes("order block") || l.includes("orderblock")) return "OB";
  if (l.includes("fvg") || l.includes("fair value") || l.includes("imbalance")) return "FVG";
  if (l.includes("bos") || l.includes("break of structure")) return "BOS";
  if (l.includes("choch") || l.includes("change of character")) return "CHOCH";
  if (l.includes("mss") || l.includes("market structure")) return "MSS";
  if (l.includes("bsl") || l.includes("buy side") || l.includes("liquidity above")) return "LIQUIDITY_SWEEP";
  if (l.includes("ssl") || l.includes("sell side") || l.includes("liquidity below")) return "LIQUIDITY_SWEEP";
  if (l.includes("eqh") || l.includes("equal high")) return "EQH";
  if (l.includes("eql") || l.includes("equal low")) return "EQL";
  if (l.includes("premium") || l.includes("prem")) return "PREMIUM";
  if (l.includes("discount") || l.includes("disc")) return "DISCOUNT";
  if (l.includes("smt") || l.includes("divergence")) return "SMT";
  if (l.includes("bias")) return "BIAS";
  return "DISPLACEMENT";
}

function mapPineLineToType(indicator: string, color: string): DetectionType {
  const i = indicator.toLowerCase();
  if (i.includes("ob") || i.includes("order")) return "OB";
  if (i.includes("fvg") || i.includes("gap")) return "FVG";
  if (i.includes("liquidity") || i.includes("pool")) return "LIQUIDITY_SWEEP";
  if (color === "#22c55e" || color === "#00ff00") return "OB"; // green = bullish
  if (color === "#ef4444" || color === "#ff0000") return "OB"; // red = bearish
  return "DISPLACEMENT";
}

/**
 * Calculate aggregate comparison metrics from an array of records.
 */
export function calculateComparisonMetrics(records: ComparisonRecord[]) {
  if (records.length === 0) return {
    total: 0, bothDetected: 0, tvOnly: 0, engineOnly: 0, neither: 0,
    agreementRate: 0, avgPriceDiscrepancy: 0, avgConfidenceGap: 0,
    byType: {} as Record<string, any>,
  };

  const both = records.filter(r => r.agreement === "BOTH_DETECTED").length;
  const tvOnly = records.filter(r => r.agreement === "TV_ONLY").length;
  const engineOnly = records.filter(r => r.agreement === "ENGINE_ONLY").length;
  const neither = records.filter(r => r.agreement === "NEITHER").length;

  const byType: Record<string, { total: number; matched: number; engineOnly: number; tvOnly: number }> = {};
  for (const r of records) {
    if (!byType[r.detectionType]) byType[r.detectionType] = { total: 0, matched: 0, engineOnly: 0, tvOnly: 0 };
    byType[r.detectionType].total++;
    if (r.agreement === "BOTH_DETECTED") byType[r.detectionType].matched++;
    else if (r.agreement === "ENGINE_ONLY") byType[r.detectionType].engineOnly++;
    else if (r.agreement === "TV_ONLY") byType[r.detectionType].tvOnly++;
  }

  const priceDiscs = records.filter(r => r.priceDiscrepancyPct != null).map(r => r.priceDiscrepancyPct!);
  const confGaps = records.filter(r => r.confidenceGap != null).map(r => r.confidenceGap!);

  return {
    total: records.length,
    bothDetected: both,
    tvOnly,
    engineOnly,
    neither,
    agreementRate: Math.round((both / records.length) * 10000) / 100,
    avgPriceDiscrepancy: priceDiscs.length ? Math.round((priceDiscs.reduce((a, b) => a + b, 0) / priceDiscs.length) * 10000) / 10000 : 0,
    avgConfidenceGap: confGaps.length ? Math.round((confGaps.reduce((a, b) => a + b, 0) / confGaps.length) * 10000) / 10000 : 0,
    byType,
  };
}
