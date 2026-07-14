---
tags: [backend, api, database, realtime]
aliases: [Backend, API, Routes]
---

# Data & Backend Architecture

## Stack
- **Server:** Express 5 (Node.js 22+)
- **Build:** esbuild 0.27.3 (single-file bundle)
- **Database:** PostgreSQL 16 via Drizzle ORM + node-postgres
- **Logging:** Pino structured JSON
- **Validation:** Zod 3.25
- **Real-time:** Binance WebSocket + Yahoo polling + SSE

## Entry Point
```typescript
// src/index.ts
dotenv.config() → port validation → Express listen
  → binanceWs.subscribe("BTCUSDT", all 7 TFs)
  → forexWs.subscribe("EURUSD=X", all 7 TFs)
  → MCP server on port 3002
  → TradeSettlementService (if DATABASE_URL set)
```

## Route Table (45+ endpoints)

### Analysis
| Path | Method | Description |
|---|---|---|
| `/api/healthz` | GET | Health check |
| `/api/symbols` | GET | Supported symbols |
| `/api/analysis/{crypto,forex}` | GET | Full SMC report (60s cache) |

### AI
| Path | Method | Description |
|---|---|---|
| `/api/agents/ask` | POST | Streaming Q&A (SSE) |
| `/api/agents/pipeline` | POST | 4-agent analysis (SSE) |
| `/api/agents/ask-mcp` | POST | Tool-calling agent (SSE) |

### Agent Loop
| Path | Method | Description |
|---|---|---|
| `/api/agent-loop/run` | POST | One-shot cycle (SSE) |
| `/api/agent-loop/start-monitoring` | POST | Background monitor |
| `/api/agent-loop/stop-monitoring` | POST | Stop monitor |
| `/api/agent-loop/status` | GET | Active monitors |
| `/api/agent-loop/runs` | GET | Historical runs |
| `/api/agent-loop/memory` | GET/POST/DELETE | Semantic memory |

### TradingView
| Path | Method | Description |
|---|---|---|
| `/api/agent-loop/tv-status` | GET | CDP connection status |
| `/api/agent-loop/tv-config` | POST | Update TV config |
| `/api/agent-loop/tv-connect` | POST | Force reconnect |
| `/api/agent-loop/tv-sync` | POST | Sync SMC levels to chart |

### Trade & Broker
| Path | Method | Description |
|---|---|---|
| `/api/ledger` | GET | Trade ledger |
| `/api/signals/generate` | POST | Generate signal |
| `/api/signals/execute` | POST | Execute trade |
| `/api/broker/status` | GET | Broker status |
| `/api/broker/mode` | POST | Set REVIEW/LIVE |
| `/api/account` | GET | Account balance |
| `/api/performance-matrix` | GET | Performance metrics |

### Learning
| Path | Method | Description |
|---|---|---|
| `/api/learning/comparisons` | GET/POST | Compare TV vs Engine |
| `/api/learning/evaluate-outcomes` | POST | Evaluate outcomes |
| `/api/learning/arbitrate` | POST | Truth Engine arbitration |
| `/api/learning/reliability` | GET | Reliability scores |
| `/api/learning/dashboard` | GET | Full dashboard |

## Real-Time Pipeline
```
Binance WS / Forex Poller
  → candleStore.applyUpdate({isClosed: true})
    → emits "candleClosed"
      → SSE: broadcast "candle_closed" to browsers
      → analysis-bridge:
          1. grab candles
          2. buildReport() → SmcReport (<50ms)
          3. pre-warm REST cache
          4. SSE: broadcast "report_update"
```

## Database (11 tables)
- `trades` — Trade ledger (31 columns, 5 indexes)
- `performance_matrix` — 7-dimension pre-computed metrics
- `agent_loop_runs` / `agent_loop_steps` — Loop tracing
- `agent_memory` — Semantic/procedural knowledge
- `detection_comparisons` / `detection_outcomes` — Learning comparisons
- `model_performance` / `parameter_history` — Reliability + parameter versioning
- `learning_events` / `pattern_statistics` — Events + patterns

## Candle Store
In-memory `Map<"SYMBOL|TF", Candle[]>` with EventEmitter.
- Max 500 candles per stream
- Emits `candleUpdate` and `candleClosed` events
- Seeds from REST backfill on first subscribe
- Data fallback chain: Binance Direct → Yahoo → Candle Store → TV Desktop

## Performance Characteristics
| Operation | Latency |
|---|---|
| Cache hit | < 2ms |
| SMC engine | 5–20ms |
| Candle→SSE push | < 100ms |
| Full uncached request | 150–400ms |
| AI first token | 300–800ms |
| Agent Loop full cycle | 3–8s |
