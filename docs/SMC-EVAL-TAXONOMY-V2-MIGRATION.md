# SMC Model Taxonomy v2 — Audit & Migration Plan

**Audit against SMC-EVAL Benchmark Ontology**
**Date:** 2026-07-18
**Scope:** 41 existing StrategyDefinition models → 7-layer SMC-EVAL taxonomy

---

## Table of Contents

1. [Current State: Taxonomy v1 Audit](#1-current-state-taxonomy-v1-audit)
2. [SMC-EVAL Ontology Mapping](#2-smc-eval-ontology-mapping)
3. [Category Errors Identified](#3-category-errors-identified)
4. [Missing Models & Concepts](#4-missing-models--concepts)
5. [Taxonomy v2: Proposed Schema](#5-taxonomy-v2-proposed-schema)
6. [Architecture Changes Required](#6-architecture-changes-required)
7. [Model Reclassification Table](#7-model-reclassification-table)
8. [Migration Phases](#8-migration-phases)
9. [Ground-Truth Integration with SMC-EVAL](#9-ground-truth-integration-with-smc-eval)

---

## 1. Current State: Taxonomy v1 Audit

The existing `model_definitions` table and `StrategyDefinition` schema use five flat categories:

| Current Category | Count | IDs |
|---|---|---|
| `classical-horizon` | 12 | classical-01 through classical-12 |
| `charter-blueprint` | 12 | charter-01 through charter-12 |
| `modern-confluence` | 5 | smc-confluence-1 through smc-confluence-5 |
| `market-maker-cycle` | 2 | mmxm-mmsm, mmxm-mmbm |
| `temporal-reversal` | 11 | temporal-silver-bullet-*, temporal-judas-swing, temporal-power-of-three, reversal-*, framework-* |

### Current `StrategyDefinition` schema:

```ts
{
  id: string;
  name: string;
  description: string;
  version: string;
  rule: Rule;                // RECURSIVE: predicate | and | or | not
  tags: string[];            // flat list
  requiredTimeframes: string[];
}
```

### What's wrong with this:

1. **Flat categories mix ontology layers** — `temporal-reversal` contains both temporal execution models (Silver Bullet) and structural reversal models (Turtle Soup, Unicorn) that belong to different ontology layers
2. **No concept/primitive layer** — pure ICT concepts (FVG, OB, Liquidity) aren't modeled as first-class entries; they're just predicate function names
3. **No structural patterns** — concepts like "liquidity sweep", "displacement", "inducement" are predicates but aren't addressable as model entries
4. **Horizon mixed with execution** — `classical-horizon` contains both horizon classifiers (Model 1 = Intraday, Model 3 = Swing) and execution setups (Model 9 = OSOK, Model 12 = Core Scalping)
5. **Tags are unstructured** — no category hierarchy, no classification metadata
6. **No temporal/session constraints** — `timeWindow` exists in the DB schema but isn't in `StrategyDefinition`
7. **No confidence/priority** — no way to express that Model 1 should be preferred over Model 4 for a given pattern
8. **No invalidation rules** — models describe what MUST match but not what MUST NOT match

---

## 2. SMC-EVAL Ontology Mapping

SMC-EVAL defines seven distinct knowledge layers:

| SMC-EVAL Layer | Purpose | Examples | Currently Modeled? |
|---|---|---|---|
| **CONCEPT** | Primitive market concepts | FVG, BOS, MSS, CHoCH, OB, Liquidity, SMT, OTE, Premium, Discount, Dealing Range | ❌ — only as predicate names |
| **STRUCTURAL_PATTERN** | Events from multiple concepts | Liquidity Sweep, Displacement, Inducement, Breaker Formation, Internal/External Liquidity Raid | ❌ — predicates exist but no first-class entries |
| **EXECUTION_MODEL** | Specific trade-execution setups | Silver Bullet, Unicorn, Turtle Soup, SCOB, Sharp Turn, 2 FVG, Modern Confluence | ⚠️ — partial (confluence models exist, Silver Bullet misclassified) |
| **TEMPORAL_MODEL** | Strict time/session constraints | London/NY Silver Bullet, Judas Swing, PO3, TGIF | ⚠️ — mixed in temporal-reversal |
| **MARKET_CYCLE** | Broader price delivery cycles | MMBM, MMSM, PO3 | ✅ — two MMXM models exist, PO3 duplicated |
| **TRADING_HORIZON** | Holding-period classifications | Scalping, Intraday, Swing, Position Trading | ❌ — mixed into classical-horizon as if they're models |
| **CURRICULUM** | Educational/mentorship frameworks | Classical PA series, Charter Blueprint series | ⚠️ — exist as models but shouldn't match as execution setups |

---

## 3. Category Errors Identified

### Critical Errors

| Model ID | Current Category | Actual SMC-EVAL Layer | Problem |
|---|---|---|---|
| `classical-01` (Intraday Scalping) | classical-horizon | **TRADING_HORIZON** | A horizon, not an execution model. Cannot be "detected" by a predicate rule tree. |
| `classical-02` (Short-Term Trading) | classical-horizon | **TRADING_HORIZON** | Same — a time horizon, not a matchable pattern |
| `classical-03` (Swing Trading) | classical-horizon | **TRADING_HORIZON** | Same |
| `classical-04` (Position Trading) | classical-horizon | **TRADING_HORIZON** | Same |
| `classical-05` (Advanced Session) | classical-horizon | **EXECUTION_MODEL** | Actually an execution setup — should be reclassified |
| `classical-06` (Universal Buy) | classical-horizon | **EXECUTION_MODEL** | Directional bias pattern, not a horizon |
| `classical-07` (Universal Sell) | classical-horizon | **EXECUTION_MODEL** | Same |
| `classical-08` (Weekly Range) | classical-horizon | **TEMPORAL_MODEL** | Weekly-specific temporal constraints |
| `classical-09` (OSOK) | classical-horizon | **EXECUTION_MODEL** | Distinct execution setup, not a horizon |
| `classical-10` (Swing Stalking) | classical-horizon | **EXECUTION_MODEL** | Execution pattern |
| `classical-11` (Daily Range Scalping) | classical-horizon | **EXECUTION_MODEL** | Execution pattern |
| `classical-12` (Core Scalping) | classical-horizon | **CONCEPT** | Pure FVG-after-displacement — a concept application, not a model |
| `temporal-power-of-three` | temporal-reversal | **MARKET_CYCLE** (or TEMPORAL_MODEL) | PO3 describes a candle lifecycle cycle, not a reversal. Duplicate with market-maker-cycle semantics. |
| `reversal-turtle-soup` | temporal-reversal | **EXECUTION_MODEL** | Not temporal — has no time constraints |
| `reversal-unicorn` | temporal-reversal | **EXECUTION_MODEL** | Not temporal — pure structural overlap |
| `reversal-scob` | temporal-reversal | **EXECUTION_MODEL** | Not temporal — micro-entry refinement |
| `framework-sharp-turn` | temporal-reversal | **EXECUTION_MODEL** | Multi-TF alignment framework |
| `framework-2fvg` | temporal-reversal | **EXECUTION_MODEL** | Multi-TF entry framework |

### Moderate Errors

| Model ID | Issue |
|---|---|
| `charter-01` through `charter-12` | These are educational curriculum steps. They have valid predicate rules but should not participate in `detectAll()` as execution candidates — they represent learning progression, not tradeable setups |
| `classical-01` through `classical-04` | The horizon classification has value for filtering, but not as detected models. A trade can be "scalping" or "swing" but the engine shouldn't report "Model 1 matched" as if it's a setup |

### Missing from Taxonomy

| Missing | SMC-EVAL Layer | Notes |
|---|---|---|
| TGIF Setup | TEMPORAL_MODEL | Mentioned in SMC-EVAL, not in our seed |
| Internal/External Liquidity Raid | STRUCTURAL_PATTERN | Explicit in SMC-EVAL Task 2, not modeled |
| Breaker Formation | STRUCTURAL_PATTERN | `hasBreakerBlock` exists as predicate but no model entry |
| All 11 primitive CONCEPT entries | CONCEPT | FVG, OB, BOS, MSS, CHoCH, Liquidity, SMT, OTE, Premium, Discount, Dealing Range exist only as predicate names |
| SMC-EVAL GroundTruth schema | EVALUATION | No interface matches the benchmark's `SMCGroundTruth` |

---

## 4. Missing Models & Concepts

### From SMC-EVAL Section 6 Ontology

**Concepts (0 of 11 modeled):**
- ❌ Fair Value Gap → only a predicate
- ❌ Break of Structure → only a predicate  
- ❌ Market Structure Shift → only a predicate
- ❌ Change of Character → only a predicate
- ❌ Order Block → only a predicate
- ❌ Liquidity → only a predicate
- ❌ SMT Divergence → only a predicate
- ❌ Optimal Trade Entry → only a predicate
- ❌ Premium → only a predicate
- ❌ Discount → only a predicate
- ❌ Dealing Range → only a predicate

**Structural Patterns (0 of 6 modeled):**
- ❌ Liquidity Sweep → predicate exists
- ❌ Displacement → predicate exists
- ❌ Inducement → predicate exists
- ❌ Breaker Formation → predicate exists
- ❌ Internal Liquidity Raid → not implemented
- ❌ External Liquidity Raid → not implemented

**Temporal Models (missing 1 of 6):**
- ❌ TGIF Setup → not in seed

**Market Cycles (missing 1 of 3):**
- ❌ PO3 as a distinct market-cycle entry (currently classified as temporal-reversal)

**SMC-EVAL Task Entities (missing):**
- ❌ `SMCGroundTruth` interface — not implemented anywhere
- ❌ `ModelRequirement`, `TimeframeRule`, `TemporalRule` — richer constraint types
- ❌ Model discrimination metadata — which models are easily confused with which
- ❌ Hallucination guard — invalid concept lists per scenario

---

## 5. Taxonomy v2: Proposed Schema

### New `StrategyDefinition` Schema (extended)

```ts
/* ── SMC-EVAL Ontology Category ── */
type OntologyCategory =
  | "CONCEPT"            // Primitive: FVG, OB, BOS, MSS, CHoCH, Liquidity, SMT, OTE
  | "STRUCTURAL_PATTERN" // Composite: LiquiditySweep, Displacement, Inducement, Breaker
  | "EXECUTION_MODEL"    // Tradable: SilverBullet, Unicorn, TurtleSoup, ModernConfluence
  | "TEMPORAL_MODEL"     // Time-bound: LondonSB, JudasSwing, TGIF
  | "MARKET_CYCLE"       // Cycle: MMBM, MMSM, PO3
  | "TRADING_HORIZON"    // Holding period: Scalping, Intraday, Swing, Position
  | "CURRICULUM";        // Educational: ClassicalPA, CharterBP

/* ── Model Priority — affects ranking when multiple match ── */
type ModelPriority = "PRIMARY" | "ALTERNATIVE" | "INFORMATIONAL";

/* ── Invalidation Rule — conditions that MUST NOT be true ── */
interface InvalidationRule {
  predicate: string;       // predicate function name
  timeframe?: string;
  args?: unknown[];
  reason: string;          // human-readable explanation
}

/* ── Confusion Guard — pairwise discrimination metadata ── */
interface ConfusionGuard {
  similarTo: string[];     // model IDs this is often confused with
  discriminator: string;   // predicate name that distinguishes them
  discriminatorArgs?: unknown[];
}

/* ── Taxonomy v2 StrategyDefinition ── */
interface StrategyDefinitionV2 {
  // Core identity (unchanged)
  id: string;
  name: string;
  description: string;
  version: string;

  // Ontology classification (NEW)
  ontology: OntologyCategory;
  priority: ModelPriority;

  // Rule tree (unchanged)
  rule: Rule;

  // Invalidation (NEW)
  invalidation?: InvalidationRule[];

  // Constraints (expanded)
  requiredTimeframes: string[];
  temporalRules?: {
    session?: string[];      // e.g. ["LONDON_OPEN", "NY_AM"]
    window?: { before?: number; after?: number };
  };

  // Discrimination (NEW)
  confusionGuards?: ConfusionGuard[];

  // Metadata
  tags: string[];
  prerequisites?: string[];  // concept/predicate IDs that must be understood first
}
```

### New `model_categories` Table (for layered queries)

```ts
// Separate table so a model can exist in multiple views
const modelCategories = pgTable("model_categories", {
  modelId: text("model_id").references(() => modelDefinitions.id),
  ontology: text("ontology").notNull(),      // the 7-layer category
  subcategory: text("subcategory"),          // e.g. "SCALPING", "INTRADAY" for horizons
  priority: text("priority").default("INFORMATIONAL"),
});
```

---

## 6. Architecture Changes Required

### 6.1 Schema Changes (`lib/db/src/schema/`)

| Change | File | Description |
|---|---|---|
| Add `ontology` column | `model-definitions.ts` | VARCHAR, one of 7 SMC-EVAL categories |
| Add `priority` column | `model-definitions.ts` | VARCHAR: PRIMARY, ALTERNATIVE, INFORMATIONAL |
| Add `invalidation` column | `model-definitions.ts` | JSONB array of InvalidationRule |
| Add `temporalRules` column | `model-definitions.ts` | JSONB (session, window constraints) |
| Add `confusionGuards` column | `model-definitions.ts` | JSONB array of ConfusionGuard |
| Add `prerequisites` column | `model-definitions.ts` | TEXT[] of concept/predicate IDs |
| Create `model_categories` table | NEW | Join table for multi-ontology classification |
| Generate migration | `drizzle/0002` | Additive — does not break existing rows |

### 6.2 Zod Schema Changes (`lib/api-zod/src/strategies/rules.ts`)

```ts
// New: OntologyCategory enum
const ontologyCategorySchema = z.enum([
  "CONCEPT", "STRUCTURAL_PATTERN", "EXECUTION_MODEL",
  "TEMPORAL_MODEL", "MARKET_CYCLE", "TRADING_HORIZON", "CURRICULUM",
]);

// New: InvalidationRule schema
const invalidationRuleSchema = z.object({
  predicate: z.string().min(1),
  timeframe: z.string().optional(),
  args: z.array(z.unknown()).optional(),
  reason: z.string(),
});

// Extended StrategyDefinition
const strategyDefinitionV2Schema = strategyDefinitionSchema.extend({
  ontology: ontologyCategorySchema,
  priority: z.enum(["PRIMARY", "ALTERNATIVE", "INFORMATIONAL"]).default("ALTERNATIVE"),
  invalidation: z.array(invalidationRuleSchema).optional(),
  temporalRules: z.object({
    session: z.array(z.string()).optional(),
    window: z.object({ before: z.number(), after: z.number() }).optional(),
  }).optional(),
  confusionGuards: z.array(z.object({
    similarTo: z.array(z.string()),
    discriminator: z.string(),
    discriminatorArgs: z.array(z.unknown()).optional(),
  })).optional(),
  prerequisites: z.array(z.string()).optional(),
});
```

### 6.3 Evaluator Changes (`evaluator.ts`)

| Change | Description |
|---|---|
| **Invalidation-aware evaluation** | Before reporting `matched: true`, check that no invalidation rule matches. If any invalidation matches, downgrade to `matched: false` with reason |
| **Priority-aware ranking** | Split `detectAll()` results into PRIMARY, ALTERNATIVE, INFORMATIONAL tiers before score-sorting |
| **Curriculum filtering** | Add `filterCategory()` to registry — allow `detectAll()` to exclude CURRICULUM and TRADING_HORIZON entries by default |
| **Confusion guard injection** | When a model matches, check its confusion guards — if a similar model also matches, log a discrimination flag |
| **Horizon detection** | TRADING_HORIZON models use a different matching strategy (timeframe-based heuristic rather than predicate rules) |

### 6.4 Registry Changes (`registry.ts`)

```ts
// New filtering methods
class StrategyRegistry {
  // Existing: detectAll(reports) → detectAll categories
  detectAll(reports, options?: {
    categories?: OntologyCategory[];   // filter to these ontology layers
    minPriority?: ModelPriority;        // minimum priority level
    includeCurriculum?: boolean;        // default false
    includeHorizons?: boolean;          // default false — detected separately
  }): Map<string, DetectionResult>;

  // New: detectHorizons(reports) — returns TRADING_HORIZON matches only
  detectHorizons(reports): HorizonResult;

  // New: getConflicts(modelId) — returns confusion guard info
  getConflicts(modelId: string): ConfusionGuard[];
}
```

### 6.5 Seed Data Restructuring

The seed file splits into 7 files mirroring the ontology:

```
lib/db/seeds/taxonomy-v2/
├── 01-concepts.ts           # 11 primitive concept entries
├── 02-structural-patterns.ts # 6 structural pattern entries
├── 03-execution-models.ts   # Modern Confluence + Turtle Soup + Unicorn + SCOB + ST + 2FVG + Silver Bullet
├── 04-temporal-models.ts    # Silver Bullet variants + Judas Swing + TGIF + Weekly Range
├── 05-market-cycles.ts      # MMBM + MMSM + PO3
├── 06-trading-horizons.ts   # Scalping, Intraday, Swing, Position
├── 07-curriculum.ts         # Classical PA series + Charter BP series
└── index.ts                 # Loads all 7 files
```

---

## 7. Model Reclassification Table

### 7.1 Classical Horizon → Reclassified

| Current ID | Current Name | v1 Category | v2 Ontology | v2 Priority | Notes |
|---|---|---|---|---|---|
| `classical-01` | Intraday Scalping | classical-horizon | **TRADING_HORIZON** | INFORMATIONAL | Not a matchable pattern |
| `classical-02` | Short-Term Trading | classical-horizon | **TRADING_HORIZON** | INFORMATIONAL | Same |
| `classical-03` | Swing Trading | classical-horizon | **TRADING_HORIZON** | INFORMATIONAL | Same |
| `classical-04` | Position Trading | classical-horizon | **TRADING_HORIZON** | INFORMATIONAL | Same |
| `classical-05` | Advanced Session Setup | classical-horizon | **EXECUTION_MODEL** | ALTERNATIVE | Session-based expansion |
| `classical-06` | Universal Buy Model | classical-horizon | **EXECUTION_MODEL** | ALTERNATIVE | Directional buy setup |
| `classical-07` | Universal Sell Model | classical-horizon | **EXECUTION_MODEL** | ALTERNATIVE | Directional sell setup |
| `classical-08` | Weekly Range Strategy | classical-horizon | **TEMPORAL_MODEL** | ALTERNATIVE | Weekly-specific |
| `classical-09` | One Shot One Kill | classical-horizon | **EXECUTION_MODEL** | PRIMARY | High-conviction single setup |
| `classical-10` | Swing Stalking | classical-horizon | **EXECUTION_MODEL** | ALTERNATIVE | Range liquidity run |
| `classical-11` | Daily Range Scalping | classical-horizon | **EXECUTION_MODEL** | ALTERNATIVE | Range-scalp |
| `classical-12` | Core Scalping Model | classical-horizon | **CONCEPT** (or EXECUTION_MODEL) | INFORMATIONAL | Pure FVG-after-displacement |

### 7.2 Charter Blueprint → Reclassified

| Current ID | Current Name | v2 Ontology | v2 Priority | Notes |
|---|---|---|---|---|
| `charter-01` through `charter-12` | Charter Models 1-12 | **CURRICULUM** | INFORMATIONAL | Educational series — excluded from `detectAll()` by default |

### 7.3 Modern Confluence → Keep as EXECUTION_MODEL

| Current ID | Current Name | v2 Ontology | v2 Priority | Notes |
|---|---|---|---|---|
| `smc-confluence-1` | HTF+BOS+FVG | **EXECUTION_MODEL** | PRIMARY | Foundational execution model |
| `smc-confluence-2` | +IDM | **EXECUTION_MODEL** | PRIMARY | Higher confluence |
| `smc-confluence-3` | +OTE | **EXECUTION_MODEL** | PRIMARY | OTE refinement |
| `smc-confluence-4` | +IDM+OTE | **EXECUTION_MODEL** | PRIMARY | Highest confluence |
| `smc-confluence-5` | Five Box Setup | **EXECUTION_MODEL** | PRIMARY | Unique reversal pattern |

### 7.4 Market Maker Cycles → Keep

| Current ID | Current Name | v2 Ontology | v2 Priority | Notes |
|---|---|---|---|---|
| `mmxm-mmsm` | Market Maker Sell Model | **MARKET_CYCLE** | PRIMARY | Full sell-cycle |
| `mmxm-mmbm` | Market Maker Buy Model | **MARKET_CYCLE** | PRIMARY | Full buy-cycle |

### 7.5 Temporal & Reversal → Split

| Current ID | Current Name | v2 Ontology | v2 Priority | Notes |
|---|---|---|---|---|
| `temporal-silver-bullet-london` | Silver Bullet — London | **TEMPORAL_MODEL** | PRIMARY | Keep temporal |
| `temporal-silver-bullet-nyam` | Silver Bullet — NY AM | **TEMPORAL_MODEL** | PRIMARY | Keep temporal |
| `temporal-silver-bullet-nypm` | Silver Bullet — NY PM | **TEMPORAL_MODEL** | PRIMARY | Keep temporal |
| `temporal-judas-swing` | Judas Swing | **TEMPORAL_MODEL** | PRIMARY | Session-manipulation model |
| `temporal-power-of-three` | Power of Three | **MARKET_CYCLE** | PRIMARY | Move to market-cycle (PO3 describes a lifecycle, not just a time slot) |
| `reversal-turtle-soup` | Turtle Soup | **EXECUTION_MODEL** | PRIMARY | Move to execution |
| `reversal-unicorn` | Unicorn Model | **EXECUTION_MODEL** | PRIMARY | Move to execution |
| `reversal-scob` | Single Candle OB | **EXECUTION_MODEL** | PRIMARY | Move to execution |
| `framework-sharp-turn` | Sharp Turn | **EXECUTION_MODEL** | ALTERNATIVE | Move to execution |
| `framework-2fvg` | 2 FVG Model | **EXECUTION_MODEL** | ALTERNATIVE | Move to execution |

### 7.6 New Models to Add

| New ID | Name | v2 Ontology | v2 Priority | Notes |
|---|---|---|---|---|
| `concept-fvg` | Fair Value Gap | **CONCEPT** | INFORMATIONAL | Primitive |
| `concept-bos` | Break of Structure | **CONCEPT** | INFORMATIONAL | Primitive |
| `concept-mss` | Market Structure Shift | **CONCEPT** | INFORMATIONAL | Primitive |
| `concept-cho-ch` | Change of Character | **CONCEPT** | INFORMATIONAL | Primitive |
| `concept-ob` | Order Block | **CONCEPT** | INFORMATIONAL | Primitive |
| `concept-liquidity` | Liquidity Pool | **CONCEPT** | INFORMATIONAL | Primitive |
| `concept-smt` | SMT Divergence | **CONCEPT** | INFORMATIONAL | Primitive |
| `concept-ote` | Optimal Trade Entry | **CONCEPT** | INFORMATIONAL | Primitive |
| `concept-premium` | Premium Zone | **CONCEPT** | INFORMATIONAL | Primitive |
| `concept-discount` | Discount Zone | **CONCEPT** | INFORMATIONAL | Primitive |
| `concept-dealing-range` | Dealing Range | **CONCEPT** | INFORMATIONAL | Primitive |
| `pattern-liquidity-sweep` | Liquidity Sweep | **STRUCTURAL_PATTERN** | INFORMATIONAL | Composite event |
| `pattern-displacement` | Displacement | **STRUCTURAL_PATTERN** | INFORMATIONAL | Composite event |
| `pattern-inducement` | Inducement | **STRUCTURAL_PATTERN** | INFORMATIONAL | Composite event |
| `pattern-breaker` | Breaker Formation | **STRUCTURAL_PATTERN** | INFORMATIONAL | Composite event |
| `pattern-internal-raid` | Internal Liquidity Raid | **STRUCTURAL_PATTERN** | INFORMATIONAL | Composite event |
| `pattern-external-raid` | External Liquidity Raid | **STRUCTURAL_PATTERN** | INFORMATIONAL | Composite event |
| `horizon-scalping` | Scalping Horizon | **TRADING_HORIZON** | INFORMATIONAL | Timeframe heuristic |
| `horizon-intraday` | Intraday Horizon | **TRADING_HORIZON** | INFORMATIONAL | Timeframe heuristic |
| `horizon-swing` | Swing Horizon | **TRADING_HORIZON** | INFORMATIONAL | Timeframe heuristic |
| `horizon-position` | Position Horizon | **TRADING_HORIZON** | INFORMATIONAL | Timeframe heuristic |

---

## 8. Migration Phases

### Phase 1 — Schema Extension (no breaking changes)
**Estimated effort:** 1 session  
**Risk:** Low — all additions are nullable/optional

- [ ] Add `ontology` column to `model_definitions` (nullable, backfill after Phase 2)
- [ ] Add `priority` column (default `ALTERNATIVE`)
- [ ] Add `invalidation` column (JSONB, nullable)
- [ ] Add `temporalRules` column (JSONB, nullable)
- [ ] Add `confusionGuards` column (JSONB, nullable)
- [ ] Add `prerequisites` column (TEXT[], nullable)
- [ ] Create `model_categories` join table
- [ ] Generate Drizzle migration
- [ ] Extend `StrategyDefinition` Zod schema in `rules.ts`
- [ ] Build and typecheck — no existing code should break

### Phase 2 — Reclassify Existing Models
**Estimated effort:** 1 session  
**Risk:** Low — seed data only, no runtime impact

- [ ] Restructure seed into `taxonomy-v2/` directory with 7 files
- [ ] Set `ontology` and `priority` on every model per §7 table
- [ ] Add invalidation rules to execution models (e.g. Silver Bullet invalid if outside time window)
- [ ] Add confusion guards (e.g. Silver Bullet ↔ Confluence Model 1)
- [ ] Add curriculum models marked `priority: INFORMATIONAL`
- [ ] Add TRADING_HORIZON models with timeframe-based implicit rules
- [ ] Add CONCEPT entries (11 primitive concepts)
- [ ] Add STRUCTURAL_PATTERN entries (6 composite events)
- [ ] Add missing temporal model (TGIF)
- [ ] Re-run seed, verify `detectAll()` still returns same results for existing code paths

### Phase 3 — Evaluator Upgrades
**Estimated effort:** 1-2 sessions  
**Risk:** Medium — affects core matching logic

- [ ] **Invalidation-aware evaluation:** Before returning `matched: true`, run invalidation rules. If any matches, return `matched: false` with `evidence: ["Invalidated by: ..."]`.
- [ ] **Priority-aware ranking:** Modify `detectAll()` sort to group by priority tier first, then by score.
- [ ] **Category filtering:** Add `options.categories` and `options.minPriority` to `detectAll()`.
- [ ] **Curriculum filtering:** Exclude `CURRICULUM` and `TRADING_HORIZON` from default `detectAll()`.
- [ ] **Horizon detection:** Add `detectHorizons(reports)` that uses timeframe-based heuristics (not predicate rules) to determine the active trading horizon.
- [ ] **Confusion guard injection:** When a model matches, check if any of its `similarTo` models also matched — if so, add a `discrimination` flag to the result.
- [ ] Update `DetectionResult` type to include `discrimination?` and `invalidatedBy?` fields.

### Phase 4 — Ground-Truth Integration with SMC-EVAL
**Estimated effort:** 2 sessions  
**Risk:** Medium — new surface area

- [ ] Implement `SMCGroundTruth` interface matching the benchmark spec:

```ts
interface SMCGroundTruth {
  scenarioId: string;
  market: { asset: string; session?: string; timestamp: string };
  structure: { direction: "BULLISH" | "BEARISH" | "RANGE"; events: SMCEvent[] };
  liquidity: { swept?: string; remaining?: LiquidityTarget[] };
  concepts: string[];        // which CONCEPT entries apply
  models: {
    primary: ModelCandidate;
    alternatives: ModelCandidate[];
    rejected: ModelCandidate[];   // matched by registry but intentionally excluded
  };
  timeframeAlignment: TimeframeRelationship[];
  execution?: ExecutionContext;
  evaluation: EvaluationMetadata;
}
```

- [ ] Add `POST /api/smc-eval/evaluate` route that:
  1. Accepts a market scenario (OHLCV + context)
  2. Runs SMC engine → builds reports
  3. Runs taxonomy registry → identifies applicable models
  4. Returns structured `SMCGroundTruth` record
  5. Accepts AI reasoning for comparison scoring
- [ ] Add benchmark scenario dataset (`data/smc-eval/scenarios/`)
- [ ] Add scoring engine matching §8 of the benchmark spec (100-point system)
- [ ] Wire narrative generator + reasoning agent into evaluation pipeline

### Phase 5 — Testing & Documentation
**Estimated effort:** 1 session  
**Risk:** Low

- [ ] Update all 119 vitest tests for new schema fields
- [ ] Add tests for invalidation-aware evaluation
- [ ] Add tests for priority-aware ranking
- [ ] Add tests for category filtering
- [ ] Add integration test: `POST /api/smc-eval/evaluate` with known scenario
- [ ] Update CLAUDE.md with Taxonomy v2 documentation
- [ ] Update CAPABILITIES_REPORT.md with SMC-EVAL integration
- [ ] Update seed header and comments

---

## 9. Ground-Truth Integration with SMC-EVAL

The strategy evaluation system becomes the **deterministic SMC Model Taxonomy** layer in the SMC-EVAL architecture:

```text
Market Data (OHLCV)
     ↓
SMC Structure Engine (report.ts)
     ↓
Strategy Registry (detectAll)      ←── We are here
     ↓
  +─ Primary models (PRIMARY tier)
  +─ Alternative models (ALTERNATIVE tier)
  +─ Horizon + Curriculum filtered
  +─ Confusion guards flagged
     ↓
GroundTruth Record (SMCGroundTruth)
     ↓
  +─ Narrative Generator (deterministic)
  +─ Reasoning Agent (LLM, evaluated against ground truth)
     ↓
SMC-EVAL Scoring (100-point system)
     ↓
Forward Outcome Evaluation
```

### What We Already Have (reuse):

| Component | Status | SMC-EVAL Task |
|---|---|---|
| SMC Engine (report.ts) | ✅ 8 modules | Task 1: Structural Accuracy |
| 21 Predicate functions | ✅ All implemented | Task 2-3: Liquidity + SMC Concepts |
| Strategy Registry (41 models) | ⚠️ Needs reclassification | Task 4: Model Alignment |
| Multi-TF cascade logic | ✅ | Task 5: Multi-Timeframe Alignment |
| Narrative Generator (33 tests) | ✅ | Task 6: Narrative Construction |
| TradeActions (IntelligenceSheet) | ✅ | Task 7: Trade Precision |
| Reasoning Agent (14 tests) | ✅ | Task 9-10: Adversarial + Discrimination |

### What We Need to Build:

| Component | Effort | Task |
|---|---|---|
| `SMCGroundTruth` interface | Small | Ground-truth representation |
| `POST /api/smc-eval/evaluate` | Medium | Evaluation endpoint |
| Invalidation-aware evaluation | Small | Task 4 accuracy |
| Confusion guards | Small | Task 10 discrimination |
| Priority-aware ranking | Small | Task 4 ranking |
| Benchmark scenario dataset | Large | Dataset construction |
| 100-point scoring engine | Medium | §8 scoring system |
| Hallucination detection | Medium | Task 8 |
| `POST /api/smc-eval/score` | Medium | AI vs ground-truth comparison |
| Outcome recording | Medium | Forward outcome evaluation |

### Integration Points

1. **`detectAll()`** becomes the **Model Taxonomy Engine** — answering "what model does this resemble?"
2. **`generateNarrative()`** becomes the **Narrative Engine** — answering "what is the market doing?"
3. **`evaluateSetup()`** (reasoning agent) becomes part of the **AI Reasoning Layer** — answering "what does the evidence mean?"
4. **`POST /api/smc-eval/evaluate`** becomes the **SMC-EVAL Evaluator** — answering "was the reasoning correct?"

---

## Summary of Changes

| Artifact | Change Type | Files | Effort |
|---|---|---|---|
| DB Schema | Additive (nullable columns) | `model-definitions.ts`, `drizzle/0002` | Small |
| Zod Schema | Additive (optional fields) | `rules.ts` | Small |
| Evaluator | New invalidation + priority logic | `evaluator.ts` | Medium |
| Registry | New filtering + horizon detection | `registry.ts` | Medium |
| Seed Data | Restructure into 7 files + 20+ new entries | `seeds/taxonomy-v2/*.ts` | Medium |
| Routes | New SMC-EVAL evaluation endpoint | `routes/smc-eval.ts` | Medium |
| Types | New GroundTruth + evaluation types | `types/smc-eval.ts` | Small |
| Tests | Updated + new | `predicates.test.ts`, `evaluator.test.ts`, `registry.test.ts` | Medium |
| Docs | CLAUDE.md, CAPABILITIES_REPORT.md | 2 files | Small |

**Zero breaking changes to existing runtime code.** All Taxonomy v2 changes are additive — existing `detectAll()` callers continue to work, existing models remain valid, existing route handlers unchanged. The migration can proceed phase-by-phase without disrupting the running system.
