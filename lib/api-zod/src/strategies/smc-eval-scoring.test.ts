/**
 * Tests for SMC-EVAL 100-point scoring engine.
 *
 * Verifies each dimension scorer returns correct ranges and that
 * the composite score matches the specification.
 *
 * Run with: npx vitest run
 */

import { describe, it, expect } from "vitest";
import {
  scoreStructuralAccuracy,
  scoreModelAlignment,
  scoreConfluenceReasoning,
  scoreTradePrecision,
  scoreHallucinationAvoidance,
  computeSmcEvalScore,
  classifyModelMatch,
} from "./smc-eval-scoring";
import type { SMCGroundTruth, SMCEvent } from "./smc-eval-types";

const mockGroundTruth: SMCGroundTruth = {
  scenarioId: "SMC-EVAL-000001",
  market: { asset: "BTCUSDT", session: "LONDON_OPEN", timestamp: "2026-07-18T00:00:00Z" },
  structure: {
    direction: "BULLISH",
    events: [
      { type: "LIQUIDITY_SWEEP", timeframe: "5m", direction: "bearish" },
      { type: "MSS", timeframe: "5m", direction: "bullish" },
      { type: "BOS", timeframe: "1h", direction: "bullish" },
    ],
  },
  liquidity: { swept: "sell_side", remaining: [{ type: "BSL", price: 65800 }] },
  concepts: ["fvg", "bos", "mss", "orderblock", "liquidity"],
  models: {
    primary: { id: "smc-confluence-1", name: "HTF POI + BOS + FVG", ontology: "EXECUTION_MODEL", confidence: 0.85 },
    alternatives: [
      { id: "smc-confluence-2", name: "HTF POI + BOS + IDM + FVG", ontology: "EXECUTION_MODEL", confidence: 0.70 },
    ],
    rejected: [{ id: "mmxm-mmsm", name: "Market Maker Sell Model", ontology: "MARKET_CYCLE", confidence: 0 }],
  },
  timeframeAlignment: [
    { higherTf: "4h", lowerTf: "1h", alignment: "BULLISH" },
    { higherTf: "1h", lowerTf: "5m", alignment: "BULLISH" },
  ],
  execution: { direction: "LONG", entryTrigger: "5m FVG", stopLevel: "below sweep", targetLevel: "BSL 65800", minimumRR: 2, invalidation: "close below sweep" },
  evaluation: { evaluator: "DETERMINISTIC", version: "1.0", timestamp: "2026-07-18T00:00:00Z", scenarioId: "SMC-EVAL-000001" },
};

describe("scoreStructuralAccuracy", () => {
  it("returns full marks when all events match", () => {
    const events: SMCEvent[] = [
      { type: "LIQUIDITY_SWEEP", timeframe: "5m", direction: "bearish" },
      { type: "MSS", timeframe: "5m", direction: "bullish" },
      { type: "BOS", timeframe: "1h", direction: "bullish" },
    ];
    const r = scoreStructuralAccuracy(mockGroundTruth, events);
    expect(r.marketStructureDirection).toBe(8);
    expect(r.total).toBeGreaterThanOrEqual(20);
  });

  it("penalizes wrong direction", () => {
    const events: SMCEvent[] = [{ type: "BOS", timeframe: "1h", direction: "bearish" }];
    const r = scoreStructuralAccuracy(mockGroundTruth, events);
    expect(r.marketStructureDirection).toBe(0);
  });

  it("returns partial credit for partial matches", () => {
    const r = scoreStructuralAccuracy(mockGroundTruth, []);
    expect(r.bosMssChoCh).toBe(0);
    expect(r.total).toBeLessThan(30);
  });
});

describe("scoreModelAlignment", () => {
  it("full marks for correct primary + no false positives", () => {
    const ai = [{ id: "smc-confluence-1", name: "HTF POI + BOS + FVG", ontology: "EXECUTION_MODEL", confidence: 0.85 }];
    const r = scoreModelAlignment(mockGroundTruth, ai);
    expect(r.primaryModel).toBe(12);
    expect(r.modelDiscrimination).toBe(3);
  });

  it("penalizes false positive models", () => {
    const ai = [
      { id: "smc-confluence-1", name: "HTF POI + BOS + FVG", ontology: "EXECUTION_MODEL", confidence: 0.85 },
      { id: "fake-model", name: "Fake Model", ontology: "EXECUTION_MODEL", confidence: 0.5 },
    ];
    const r = scoreModelAlignment(mockGroundTruth, ai);
    expect(r.modelDiscrimination).toBeLessThan(3);
  });
});

describe("scoreTradePrecision", () => {
  it("full marks for complete trade parameters", () => {
    const r = scoreTradePrecision("5m FVG retest at 64500", "below sweep low at 64200", "BSL at 65800", 2.5, "close below 64200");
    expect(r.total).toBeGreaterThanOrEqual(12);
  });

  it("zero for empty parameters", () => {
    const r = scoreTradePrecision("", "", "", null, "");
    expect(r.total).toBe(0);
  });
});

describe("scoreHallucinationAvoidance", () => {
  it("penalizes wholly fabricated models", () => {
    const r = scoreHallucinationAvoidance(mockGroundTruth, ["nonexistent-model", "also-fake"], ["smc-confluence-1", "smc-confluence-2"]);
    expect(r.noFabricatedModel).toBe(0);
  });
});

describe("computeSmcEvalScore", () => {
  it("produces a valid composite score with classification", () => {
    const r = computeSmcEvalScore({
      groundTruth: mockGroundTruth,
      detectedEvents: [
        { type: "LIQUIDITY_SWEEP", timeframe: "5m", direction: "bearish" },
        { type: "MSS", timeframe: "5m", direction: "bullish" },
        { type: "BOS", timeframe: "1h", direction: "bullish" },
      ],
      aiModels: [{ id: "smc-confluence-1", name: "HTF POI + BOS + FVG", ontology: "EXECUTION_MODEL", confidence: 0.85 }],
      reasoningText: "HTF is bullish. LTF shows a liquidity sweep followed by an MSS. BOS confirmed on 1h. This is a confluence setup with strong causal structure because the sweep provides fuel for continuation.",
      aiEntry: "5m FVG retest at 64500",
      aiStop: "below sweep low at 64200",
      aiTarget: "BSL at 65800",
      aiRR: 2.5,
      aiInvalidation: "close below 64200",
      allModelIds: ["smc-confluence-1", "smc-confluence-2"],
    });
    expect(r.total).toBeGreaterThanOrEqual(50);
    expect(r.total).toBeLessThanOrEqual(100);
    expect(r.classification).toBeDefined();
    expect(r.structuralAccuracy.total).toBeLessThanOrEqual(30);
    expect(r.modelAlignment.total).toBeLessThanOrEqual(25);
    expect(r.confluenceReasoning.total).toBeLessThanOrEqual(20);
    expect(r.tradePrecision.total).toBeLessThanOrEqual(15);
    expect(r.hallucinationAvoidance.total).toBeLessThanOrEqual(10);
  });
});

describe("classifyModelMatch", () => {
  it("returns PRIMARY when AI matches ground truth primary (single model)", () => {
    const { classification } = classifyModelMatch(["smc-confluence-1"], mockGroundTruth);
    expect(classification).toBe("PRIMARY");
  });

  it("returns PRIMARY even when alternatives are also listed", () => {
    const { classification, alternativeAwareness } = classifyModelMatch(
      ["smc-confluence-1", "smc-confluence-2", "mmxm-mmsm"],
      mockGroundTruth,
    );
    expect(classification).toBe("PRIMARY");
    expect(alternativeAwareness).toBe(true);
  });

  it("returns PARTIAL when primary miss but alternatives found", () => {
    const { classification } = classifyModelMatch(["smc-confluence-2"], mockGroundTruth);
    expect(classification).toBe("PARTIAL");
  });

  it("returns HALLUCINATED for fabricated models", () => {
    const { classification, failureFlags } = classifyModelMatch(["fake-model"], mockGroundTruth);
    expect(classification).toBe("HALLUCINATED");
    expect(failureFlags).toContain("MODEL_HALLUCINATION");
  });
});
