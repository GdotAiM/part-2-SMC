# SMC Pulse Predict — Liquidity Hunter

> **Real-time ICT/SMC market intelligence for crypto and forex traders.**
> A full-stack web application that algorithmically detects institutional order flow concepts — Order Blocks, Fair Value Gaps, BOS/CHoCH, liquidity pools, and SMT divergence — and surfaces them through a multi-timeframe dashboard with an embedded AI analyst.

---

## Vision

Most retail traders lose because they see charts the wrong way. Institutions don't buy at support and sell at resistance — they hunt liquidity, create imbalance, and deliver price into equilibrium. SMC Pulse Predict translates the Inner Circle Trader (ICT) methodology into a live, automated analysis engine that processes OHLCV data and produces the same read a trained SMC analyst would perform manually, in seconds, across every timeframe simultaneously.

---

## Key Features

| Feature | Description |
|---|---|
| **Multi-TF Dashboard** | Scalp / Intraday / Swing / All modes with cascade bias computation across 7 timeframes |
| **ICT Structure Engine** | ATR-normalised pivot detection → BOS / CHoCH classification → phase inference (Accumulation → Manipulation → Expansion) |
| **Liquidity Hunter** | BSL / SSL / Equal Highs / Equal Lows pool detection with session-weighted scoring and probability-of-sweep |
| **Order Block Detection** | Bullish & bearish OBs with breaker block classification, FVG confluence, and institutional confidence scoring |
| **Fair Value Gap Engine** | FVG detection with fill-fraction tracking and inversion FVG identification |
| **PD Array** | Premium / Discount / Equilibrium zone computation from dealing range |
| **Daily Bias** | HTF 1D structure-primary bias (0.55–0.88 strength) used to gate lower-TF OB confidence |
| **SMT Divergence** | Correlated-pair divergence detection (BTC/ETH, EUR/GBP) with magnitude + timing scoring |
| **Draw on Liquidity** | Confluence-boosted target scoring that ranks BSL/SSL/OB/FVG as next price objectives |
| **Visual Chart Layer** | TradingView Lightweight Charts (v5) with session backgrounds, OB/FVG rectangles, BOS/CHoCH markers, KZO lines |
| **AI Agent System** | Fireworks AI (Llama 3.3 70B) — streaming Q&A + 4-agent sequential analysis pipeline |
| **Market Narrative** | Auto-generated institutional narrative string per report |
| **Session State** | Real-time ICT session inference: Asian Range / London Expansion / NY Open / PM Distribution |
| **60s Cache** | In-memory TTL cache prevents repeated data-provider hits on dashboard refresh |

---

## Screenshots

> _Open the app and hit the **CHART** button to see the visual layer._

| Intelligence Dashboard | Chart View |
|---|---|
| Multi-TF cascade with confluence card | Candlesticks + OB/FVG/session overlays |

---

## Demo

Run locally (see Installation below) then visit `http://localhost:5173`.

- Select **CRYPTO** → **BTC/USDT** → **INTRADAY**
- View the cascade: H4 sets direction, H1 confirms, M15 triggers
- Tap any card → **Intelligence Sheet** for deep analysis
- Tap **CHART** for the visual chart with SMC overlays
- Tap **SMT** on any card → AI agent pipeline fires

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                   React Frontend                     │
│  Dashboard → ConfluenceCard → IntelligenceSheet     │
│             ChartView (Lightweight Charts v5)        │
│             AgentChat + AgentPipeline (SSE)         │
└─────────────────────┬───────────────────────────────┘
                      │ HTTP / SSE
┌─────────────────────▼───────────────────────────────┐
│               Express 5 API Server                   │
│  /api/analysis/crypto   /api/analysis/forex         │
│  /api/agents/ask        /api/agents/pipeline        │
│  60s in-memory TTL cache                            │
└──────┬──────────────────────────────┬───────────────┘
       │                              │
┌──────▼──────┐              ┌────────▼────────┐
│  Binance    │              │  Yahoo Finance  │
│  REST API   │              │  REST API       │
│  (Crypto)   │              │  (Forex)        │
└─────────────┘              └─────────────────┘
```

---

## Technology Stack

### Backend
| Layer | Technology |
|---|---|
| Runtime | Node.js 20 + TypeScript 5 |
| Framework | Express 5 |
| Logger | Pino (JSON structured logging) |
| Data (Crypto) | Binance REST API (no key required for OHLCV) |
| Data (Forex) | Yahoo Finance REST API |
| AI | Fireworks AI — Llama 3.3 70B Instruct (SSE streaming) |
| Cache | In-process Map, 60s TTL |

### Frontend
| Layer | Technology |
|---|---|
| Framework | React 18 + TypeScript |
| Build | Vite |
| Styling | Tailwind CSS + shadcn/ui |
| Data Fetching | TanStack Query v5 |
| Charts | TradingView Lightweight Charts v5 |
| Animations | Framer Motion |
| Router | Wouter |

### Monorepo
| Package | Purpose |
|---|---|
| `artifacts/api-server` | Backend Express server |
| `artifacts/liquidity-hunter` | Frontend React SPA |
| `lib/api-client-react` | TanStack Query hooks (manually maintained) |
| `lib/api-spec` | OpenAPI 3.1 spec |
| `lib/api-zod` | Zod schemas |
| `lib/db` | Drizzle ORM (scaffolded, server is stateless) |

---

## AI Pipeline Overview

```
User taps "SMT" button
        ↓
POST /api/agents/pipeline { report: SmcReport }
        ↓
System prompt built from live SmcReport data
(price, structure, liquidity map, OBs, FVGs, SMT, draw targets)
        ↓
Sequential agent loop (SSE streaming):
  1. Structure Agent   → market structure narrative
  2. Liquidity Agent   → BSL/SSL hunt probability
  3. FVG Agent         → rebalance vs continuation gaps
  4. Confluence Agent  → final synthesis + invalidation level
        ↓
Frontend streams each agent token-by-token into AgentPipeline panel
```

Also supports: `POST /api/agents/ask` — single-turn Q&A with full report context and conversation history (last 8 turns).

---

## ICT/SMC Concepts Implemented

- Market Structure (Pivots: HH / HL / LH / LL)
- Break of Structure (BOS)
- Change of Character (CHoCH / MSS)
- Market Phase: Accumulation → Manipulation → Expansion → Distribution → Continuation
- Buy-Side Liquidity (BSL) — Equal Highs, prior session highs
- Sell-Side Liquidity (SSL) — Equal Lows, prior session lows
- Probability of Sweep scoring per liquidity pool
- Order Blocks (Bullish / Bearish)
- Breaker Blocks (mitigated OBs that flip polarity)
- Fair Value Gaps (FVG)
- Inversion FVG
- Premium / Discount / Equilibrium (PD Array)
- Dealing Range
- Daily Bias (HTF anchor)
- SMT Divergence (correlated pair)
- Draw on Liquidity (DOL) — scored target engine
- Session analysis: Asian Range / London / NY AM / NY PM / PM Distribution
- KZO (Key Zone — OB proximal line)

---

## Project Structure

```
workspace/
├── artifacts/
│   ├── api-server/              # Express backend
│   │   └── src/
│   │       ├── lib/
│   │       │   ├── smc/         # ICT engine (core algorithms)
│   │       │   │   ├── config.ts
│   │       │   │   ├── types.ts
│   │       │   │   ├── structure.ts
│   │       │   │   ├── liquidity.ts
│   │       │   │   ├── order-blocks.ts
│   │       │   │   ├── fvg.ts
│   │       │   │   ├── pd-array.ts
│   │       │   │   ├── daily-bias.ts
│   │       │   │   ├── smt.ts
│   │       │   │   └── report.ts
│   │       │   └── fetchers/    # Market data
│   │       │       ├── binance.ts
│   │       │       └── yahoo.ts
│   │       └── routes/          # API endpoints
│   │           ├── analysis.ts
│   │           ├── agents.ts
│   │           ├── symbols.ts
│   │           └── health.ts
│   └── liquidity-hunter/        # React frontend
│       └── src/
│           ├── pages/
│           │   └── dashboard.tsx
│           └── components/
│               ├── IntelligenceSheet.tsx
│               ├── ConfluenceCard.tsx
│               ├── ConfluenceSheet.tsx
│               ├── ChartView.tsx
│               ├── AgentChat.tsx
│               └── AgentPipeline.tsx
├── lib/
│   ├── api-spec/                # OpenAPI 3.1 definition
│   ├── api-client-react/        # TanStack Query hooks
│   └── api-zod/                 # Zod schemas
└── pnpm-workspace.yaml
```

---

## Installation

### Prerequisites
- Node.js ≥ 20
- pnpm ≥ 9

```bash
git clone <repo-url>
cd workspace
pnpm install
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `FIREWORKS_API_KEY` | Yes | Fireworks AI key for the analyst agent. Get one free at https://fireworks.ai |

Set in `.env` at the repo root or via your platform's secrets manager.

---

## Running Locally

```bash
# Start API server (port 3001 by default)
pnpm --filter @workspace/api-server run dev

# Start frontend (port 5173 by default)
pnpm --filter @workspace/liquidity-hunter run dev
```

Then open `http://localhost:5173`.

---

## Example API Request

```bash
# Crypto analysis — BTC/USDT 4h with ETH/USDT correlation
curl "http://localhost:3001/api/analysis/crypto?symbol=BTCUSDT&timeframe=4h&correlatedSymbol=ETHUSDT"

# Forex analysis — EUR/USD 1h
curl "http://localhost:3001/api/analysis/forex?symbol=EURUSD=X&timeframe=1h"
```

---

## Example API Response (abbreviated)

```json
{
  "symbol": "BTCUSDT",
  "market": "crypto",
  "timeframe": "4h",
  "currentPrice": 59740.37,
  "narrative": "Daily bearish. BOS bearish confirmed. Price in premium zone. Nearest objective: SSL at 59,094.",
  "sessionState": "Asian Range Formation",
  "structure": {
    "bias": "bearish",
    "phase": "expansion",
    "confidence": 0.72,
    "evidence": ["2 BOS bearish", "CHoCH at 61,200"]
  },
  "liquidity": {
    "nearestBSL": { "price": 65549.94, "probabilityOfSweep": 0.34 },
    "nearestSSL": { "price": 59093.99, "probabilityOfSweep": 0.71 }
  },
  "orderBlocks": [
    {
      "type": "bearish", "proximal": 61400, "distal": 60800,
      "confidence": 0.81, "confidenceFactors": ["✓ HTF bias aligned", "✓ FVG confluence"],
      "isMitigated": false, "isBreaker": false
    }
  ],
  "draw": [
    { "type": "SSL", "price": 59093.99, "score": 1.42, "direction": "short",
      "evidence": ["✓ SSL @ 59,094", "Prob sweep: 71%", "✓ HTF bias aligned"] }
  ]
}
```

---

## Roadmap

- [ ] Price alert notifications (browser push) when price enters OB zone or sweeps liquidity
- [ ] Multi-panel chart view (two TFs side-by-side)
- [ ] Candle tap to inspect — SMC context tooltip for selected bar
- [ ] Backtesting mode — replay historical bars through the SMC engine
- [ ] WebSocket live price feed for sub-minute updates
- [ ] Trade journal integration — log setups directly from Intelligence Sheet
- [ ] Mobile-native app (Expo React Native)
- [ ] Public API with rate limiting

---

## Contributing

Pull requests welcome. The codebase is deliberately modular — each SMC concept lives in its own file under `artifacts/api-server/src/lib/smc/`. To add a new concept:

1. Create `artifacts/api-server/src/lib/smc/your-concept.ts`
2. Export a typed result interface from `types.ts`
3. Call your analyser in `report.ts → buildReport()`
4. Extend `SmcReport` in `types.ts` and mirror the new field in `lib/api-client-react/src/generated/api.schemas.ts`

---

## License

MIT

---

## Credits

- **ICT (Inner Circle Trader)** — trading methodology and concept definitions
- **TradingView** — Lightweight Charts v5 library
- **Fireworks AI** — LLM inference infrastructure
- **Binance** — crypto OHLCV data
- **Yahoo Finance** — forex OHLCV data
