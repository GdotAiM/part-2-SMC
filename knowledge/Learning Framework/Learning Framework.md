---
tags: [learning, comparison, truth, reliability, architecture]
aliases: [Learning Framework]
---

# Learning & Validation Framework

The evidence-driven feedback system that compares the internal SMC Engine against TradingView/Pine indicators and accumulates reliability data from market outcomes.

## Data Flow

```
TradingView + Pine (Teacher)     Custom SMC Engine (Student)
         │                                │
         └──────────┬─────────────────────┘
                    ↓
          Comparison Engine
                    ↓
           Evidence Fusion
                    ↓
            Truth Engine         ← Who do I trust?
                   │
          ┌────────┼────────┐
          ↓        ↓        ↓
    Learning DB  Reliability  Outcome Eval
          ↓        ↓        ↓
    Pattern Stats  ↑        ↑
    Parameter Reqs─┤        │
    AI Reflections──────────┘
```

## Component Hierarchy

| Layer | Component | File | Purpose |
|---|---|---|---|
| **Compare** | ComparisonEngine | `lib/comparison/ComparisonEngine.ts` | TV vs Engine detection matching |
| **Fuse** | EvidenceFusionLayer | `lib/fusion/EvidenceFusionLayer.ts` | Composite confidence + explanations |
| **Arbitrate** | TruthEngine | `lib/truth/TruthEngine.ts` | Single authoritative verdict per level |
| **Store** | LearningService | `lib/learning/LearningService.ts` | DB persistence |
| **Score** | ReliabilityEngine | `lib/reliability/ReliabilityEngine.ts` | Per-type reliability tracking |
| **Evaluate** | OutcomeEvaluator | `lib/evaluation/OutcomeEvaluator.ts` | Market outcome evaluation |
| **Reflect** | ReflectionEngine | `lib/reflection/ReflectionEngine.ts` | Post-trade structured reflection |
| **Optimize** | ParameterRecommender | `lib/optimization/ParameterRecommendationService.ts` | Statistical parameter suggestions |

## Comparison Engine
Compares 14 detection types: `OB`, `FVG`, `BOS`, `CHOCH`, `MSS`, `LIQUIDITY_SWEEP`, `EQH`, `EQL`, `PREMIUM`, `DISCOUNT`, `SMT`, `SESSION_BREAKOUT`, `DISPLACEMENT`, `BIAS`

**Agreement types:** `BOTH_DETECTED` | `TV_ONLY` | `ENGINE_ONLY` | `NEITHER`

**Matching:** Price-proximity within 0.5%

## Truth Engine — Decision Arbitration
The critical piece the AI needed. Resolves "who do I trust?" into a single answer per level.

**Arbitration Strategies:**
| Strategy | When | Result |
|---|---|---|
| `BOTH_AGREE` | Both detect, price matches | Highest confidence (93%) |
| `TRUST_HIGHER_RELIABILITY` | One source significantly more reliable | Confident (85%) |
| `TV_FALLBACK` | Only TV detects it | Moderate (60%) |
| `ENGINE_FALLBACK` | Only Engine detects it | Moderate (52%) |
| `FALLBACK_COMPOSITE` | Close scores — market context tiebreaker | Lower (50-70%) |
| `INSUFFICIENT_DATA` | Neither source | Very low (15%) |

**Output to AI:** `{ detectionType, adoptedPrice, chosenSource, finalConfidence, verdictNarrative }` — the AI gets one answer, not a comparison to figure out.

## Reliability Engine
Per-type reliability that improves over time:
- Order Blocks: 96% (target)
- FVG: 91%
- Liquidity: 87%
- CHoCH: 72%
- SMT: 64%
- Bias: 94%

Tracks trend: `improving` | `stable` | `declining` | `insufficient_data`

## Database Tables (6)
1. `detection_comparisons` — Append-only comparison records
2. `detection_outcomes` — Market results per detection
3. `model_performance` — Accumulated reliability by source+type
4. `parameter_history` — Versioned parameter suggestions (human approval required)
5. `learning_events` — Significant system observations
6. `pattern_statistics` — Recurring pattern analysis

## Outcome Evaluation
After N future candles evaluates:
- `RESPECTED` — level held, price reversed
- `SWEPT` — price pierced then reversed
- `IGNORED` — price blew through
- `FILLED` / `PARTIAL_FILL` — FVG was filled
- `REVERSAL` — price reversed at level
- `PENDING` / `INCONCLUSIVE`

## API Endpoints (11)
| Method | Path | Description |
|---|---|---|
| GET | `/api/learning/comparisons` | Query comparisons |
| POST | `/api/learning/comparisons/analyze` | Run comparison cycle |
| POST | `/api/learning/evaluate-outcomes` | Evaluate outcomes |
| POST | `/api/learning/arbitrate` | Truth Engine arbitration |
| GET | `/api/learning/reliability` | Reliability scores |
| GET | `/api/learning/parameter-suggestions` | Pending suggestions |
| POST | `/api/learning/parameter-suggestions/generate` | Generate recommendations |
| POST | `/api/learning/parameter-suggestions/:id/approve` | Human approval |
| GET | `/api/learning/events` | Learning events |
| GET | `/api/learning/patterns` | Pattern statistics |
| GET | `/api/learning/dashboard` | Full dashboard data |
