# Learning & Validation Framework

## Architecture

The Learning & Validation Framework is an evidence-driven feedback system that compares the internal SMC Engine against TradingView/Pine indicators, tracks market outcomes, and accumulates reliability data across detection types.

```
Market Data
    │
    ├──→ SMC Engine (Student)
    │       ↓
    │   Detection Points (OB, FVG, BOS, CHoCH, SMT, etc.)
    │
    ├──→ TradingView + Pine (Teacher)
    │       ↓
    │   Detection Points via CDP
    │
    └──→ Comparison Engine
            │
            ├──→ Evidence Fusion Layer
            │       ↓
            │   Composite Confidence + Explanation
            │
            ├──→ Learning Service (DB persistence)
            │       ↓
            │   detection_comparisons table
            │
            └──→ Outcome Evaluator (N candles later)
                    │
                    ├──→ Market determines correctness
                    ├──→ Reliability Engine updated
                    ├──→ Pattern Statistics updated
                    └──→ Reflection Engine triggered
                            │
                            └──→ Parameter recommendations
                                  (requires human approval)
```

## Service Architecture

| Service | File | Responsibility |
|---|---|---|
| **ComparisonEngine** | `lib/comparison/ComparisonEngine.ts` | Compare TV vs Engine detection points |
| **EvidenceFusionLayer** | `lib/fusion/EvidenceFusionLayer.ts` | Fuse evidence into composite decisions |
| **LearningService** | `lib/learning/LearningService.ts` | Persist comparisons, outcomes, events |
| **ReliabilityEngine** | `lib/reliability/ReliabilityEngine.ts` | Per-type reliability tracking |
| **OutcomeEvaluator** | `lib/evaluation/OutcomeEvaluator.ts` | Evaluate detection accuracy vs price |
| **ReflectionEngine** | `lib/reflection/ReflectionEngine.ts` | Post-trade structured reflection |
| **ParameterRecommendationService** | `lib/optimization/ParameterRecommendationService.ts` | Suggest parameter changes |

## Database Schema

### New Tables (6)

| Table | Storage Type | Purpose |
|---|---|---|
| `detection_comparisons` | Append-only | Every TV-vs-Engine comparison event |
| `detection_outcomes` | Append-only | Market result for each comparison |
| `model_performance` | Upserted | Accumulated reliability by source+type |
| `parameter_history` | Append-only | Versioned parameter suggestions |
| `learning_events` | Append-only | Significant system observations |
| `pattern_statistics` | Accumulated | Recurring pattern analysis |

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/learning/comparisons` | Query comparisons with filters |
| POST | `/api/learning/comparisons/analyze` | Run one comparison cycle |
| POST | `/api/learning/evaluate-outcomes` | Evaluate pending comparisons |
| GET | `/api/learning/reliability` | Current reliability scores |
| GET | `/api/learning/parameter-suggestions` | Pending parameter suggestions |
| POST | `/api/learning/parameter-suggestions/generate` | Generate recommendations |
| POST | `/api/learning/parameter-suggestions/:id/approve` | Approve (human in loop) |
| GET | `/api/learning/events` | Learning events |
| GET | `/api/learning/patterns` | Pattern statistics |
| GET | `/api/learning/dashboard` | Full dashboard data |

## Service Workflows

### Comparison Cycle
```typescript
// 1. Read candles
const candles = candleStore.getCandles(symbol, timeframe);

// 2. Run SMC engine
const report = buildReport(candles, symbol, market, timeframe);
const engineDetections = extractEngineDetections(report);

// 3. Read TV indicator (if connected)
const tvDetections = await readPineDetections(indicatorName);

// 4. Compare
const comparisons = compareDetections(symbol, tf, market, tvDetections, engineDetections, candleTime);

// 5. Store
await learningService.storeComparisons(comparisons);

// 6. Fuse evidence
const decisions = evidenceFusionLayer.fuseAll(comparisons);
```

### Outcome Evaluation Cycle
```typescript
// 1. Load pending comparisons from DB

// 2. Get N candles of future price data
const futureCandles = candleStore.getCandles(symbol, timeframe);

// 3. Evaluate
const outcomes = outcomeEvaluator.evaluate(comparisons, futureCandles);

// 4. Process (stores outcomes + updates reliability)
await outcomeEvaluator.processOutcomes(outcomes, comparisons);
```

### Parameter Recommendation Cycle
```typescript
// 1. Load 30-day comparison stats grouped by type

// 2. Generate recommendations
const recommendations = await parameterRecommendationService.generateRecommendations(periodData);

// 3. Human approves via POST /api/learning/parameter-suggestions/:id/approve
//    (parameters are NEVER changed automatically)
```

## Configuration

The system requires `DATABASE_URL` to be set for persistence. Without it, the reliability engine still works in-memory but data is lost on restart.

## Future Roadmap

1. **Automated parameter suggestion review** — periodic batch analysis of pending suggestions
2. **Cross-market pattern learning** — detect patterns that generalize across symbols
3. **Multi-timeframe outcome correlation** — detect if some TFs predict better outcomes
4. **Alert system** — notify when reliability crosses thresholds
5. **Git-based parameter versioning** — track parameter changes as Git commits
6. **Visualization** — reliability trend charts, comparison heatmaps
7. **Auto-approval for low-risk changes** — allow auto-apply for confidence > 95%
