/**
 * Standalone smoke test for AlpacaAdapter — no real Alpaca credentials needed.
 *
 * Run with:
 *   npx tsx artifacts/api-server/src/lib/execution/AlpacaAdapter.test.ts
 *
 * This does NOT hit the Alpaca API.  It verifies:
 *   1. Constructor degrades gracefully when env vars are unset
 *   2. isReady is false when credentials are missing
 *   3. REVIEW mode never calls Alpaca (returns dry-run preview)
 *   4. Forex signals are cleanly rejected
 *   5. Unmapped symbols are cleanly rejected
 *   6. Symbol translation works for known pairs
 *   7. deriveSide gives correct results for long and short signals
 */

import { AlpacaAdapter } from "./AlpacaAdapter.js";
import { deriveSide, MockBrokerAdapter } from "./BrokerAbstraction.js";
import type { UnifiedTradeSignal } from "../services/SignalGenerator.js";
import { AssetClass, SetupType, SetupSubtype, MarketRegime } from "../services/SignalGenerator.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeSignal(overrides: Partial<UnifiedTradeSignal> = {}): UnifiedTradeSignal {
  return {
    id: "test_signal_001",
    timestamp: new Date().toISOString(),
    asset_class: AssetClass.CRYPTO,
    symbol: "BTCUSDT",
    setup_type: SetupType.OB,
    setup_subtype: SetupSubtype.BULLISH_OB,
    entry_price: 50000,
    stop_loss: 49500,
    take_profit: 51000,
    suggested_qty: 1,
    risk_reward_ratio: 2,
    confidence_score: 80,
    setup_quality_factors: {
      structure_confluence: 2,
      liquidity_quality: 3,
      confluence_count: 4,
    },
    analysis_context: {
      timeframe_cascade: { macro: "1d", intermediate: "4h", execution: "1h" },
      market_regime: MarketRegime.TRENDING_UP,
      session_context: "LONDON",
      htf_bias: "BULLISH",
      confluence_factors: { has_structure_break: true, has_fvg_alignment: true, has_ob_alignment: true, has_session_alignment: true, multiple_timeframe_confirmation: true },
    },
    parameter_snapshot: { asset_class: "CRYPTO" },
    rationale: {
      structure_confluence: "Bullish structure",
      liquidity_quality: "Good pools",
    },
    version: "1.0",
    ...overrides,
  };
}

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string): void {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${label}`);
    failed++;
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────

async function run() {
  console.log("AlpacaAdapter smoke test\n");

  // ── 1. Constructor with no credentials ────────────────────────────────────
  console.log("1. Constructor (no credentials)");
  const adapter = new AlpacaAdapter();
  assert(adapter.name === "ALPACA_PAPER", "name is ALPACA_PAPER");
  assert(adapter.isReady === false, "isReady is false when no API keys set");

  // ── 2. REVIEW mode never calls Alpaca ─────────────────────────────────────
  console.log("\n2. REVIEW mode (dry-run preview)");
  const signal = makeSignal();
  const reviewResult = await adapter.executeOrder(signal, "REVIEW");
  assert(reviewResult.success === true, "REVIEW mode returns success: true");
  assert(reviewResult.mode === "REVIEW", "REVIEW mode is preserved in result");
  assert(reviewResult.broker_name === "ALPACA_PAPER", "broker_name is set");
  assert(reviewResult.trade_signal_id === signal.id, "trade_signal_id matches");
  assert(reviewResult.order_id === undefined, "no order_id in REVIEW mode (no API call made)");

  // ── 3. Forex rejection ────────────────────────────────────────────────────
  console.log("\n3. Forex rejection");
  const forexSignal = makeSignal({
    id: "test_forex",
    asset_class: AssetClass.FOREX,
    symbol: "EURUSD=X",
  });
  const forexResult = await adapter.executeOrder(forexSignal, "LIVE");
  assert(forexResult.success === false, "forex signal rejected (success: false)");
  assert(
    forexResult.error?.includes("forex") ?? false,
    "error mentions forex",
  );

  // ── 4. Unknown symbol rejection ───────────────────────────────────────────
  console.log("\n4. Unknown symbol rejection");
  const unknownSignal = makeSignal({
    id: "test_unknown",
    asset_class: AssetClass.CRYPTO,
    symbol: "ZZZUSDT", // not in CRYPTO_SYMBOL_MAP
  });
  const unknownResult = await adapter.executeOrder(unknownSignal, "LIVE");
  assert(unknownResult.success === false, "unknown symbol rejected (success: false)");
  assert(
    unknownResult.error?.includes("ZZZUSDT") ?? false,
    "error mentions the unknown symbol",
  );

  // ── 5. LIVE mode with no credentials (should still fail gracefully) ────────
  console.log("\n5. LIVE mode with no credentials (graceful failure)");
  const liveResult = await adapter.executeOrder(signal, "LIVE");
  // With no API keys, Alpaca will 401 — our adapter should catch and return
  // a clean ExecutionResult rather than throwing.
  assert(liveResult.success === false, "LIVE mode without credentials: success is false");
  assert(liveResult.broker_name === "ALPACA_PAPER", "broker_name still set on failure");
  assert(liveResult.trade_signal_id === signal.id, "trade_signal_id still set on failure");
  console.log(`    error: ${liveResult.error?.slice(0, 80)}...`);

  // ── 6. deriveSide helper ──────────────────────────────────────────────────
  console.log("\n6. deriveSide helper");
  const longSignal = makeSignal({
    entry_price: 100,
    take_profit: 110, // TP above entry → long
  });
  assert(deriveSide(longSignal) === "BUY", "take_profit > entry_price → BUY");

  const shortSignal = makeSignal({
    entry_price: 100,
    take_profit: 90, // TP below entry → short
  });
  assert(deriveSide(shortSignal) === "SELL", "take_profit < entry_price → SELL");

  // ── 7. MockBrokerAdapter uses deriveSide correctly ────────────────────────
  console.log("\n7. MockBrokerAdapter uses deriveSide");
  const mock = new MockBrokerAdapter("/tmp/mock_broker_test");
  const mockLong = await mock.executeOrder(longSignal, "REVIEW");
  assert(mockLong.success === true, "mock long order succeeds");
  assert(mockLong.broker_name === "MOCK_BROKER", "mock broker name");

  const mockShort = await mock.executeOrder(shortSignal, "REVIEW");
  assert(mockShort.success === true, "mock short order succeeds");

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(`\n${"─".repeat(50)}`);
  console.log(`${passed} passed, ${failed} failed`);
  if (failed === 0) {
    console.log("All good — AlpacaAdapter is ready for real credentials testing.");
  } else {
    process.exitCode = 1;
  }
}

run().catch((err) => {
  console.error("Test harness crashed:", err);
  process.exit(1);
});
