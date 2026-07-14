---
tags: [ai, llm, agent, pipeline, architecture]
aliases: [AI Pipeline, Agent Loop]
---

# AI & LLM Pipeline

## Provider Architecture

```
LLM_PROVIDER env var
├── "fireworks" (default) → DeepSeek V4 Pro
├── "openai" → GPT-4o
├── "amd" → self-hosted vLLM (Gemma 4 26B)
├── "custom" → any OpenAI-compatible
└── "ollama" → local models
```

**Cost tracking:** Built-in per-model pricing table in `lib/llm/provider.ts`

## Three AI Interaction Modes

### 1. Q&A (`POST /api/agents/ask`)
- SSE streaming, SmcReport injected as context
- 8-turn conversation history
- 1024 max tokens
- System prompt built from live report: structure bias, liquidity, OBs, FVGs, PD array, SMT, draw targets

### 2. Multi-Agent Pipeline (`POST /api/agents/pipeline`)
4 agents run sequentially via SSE:
1. **Structure Agent** — Who controls the market
2. **Liquidity Agent** — Where BSL/SSL rests
3. **FVG Agent** — Most important unfilled gap
4. **Confluence Agent** — Highest-probability draw

### 3. Agent Loop (`POST /api/agent-loop/run`)
Autonomous 7-step cycle:
1. **Observe** — Store SmcReport, check guardrails
2. **Interpret** — Call 8 SMC tools
3. **Reason** — LLM call with memory + news + TV reconciliation
4. **Decide** — Validate through guardrails (confidence floor, risk limits)
5. **Act** — Generate signal or analysis report
6. **Evaluate** — Score the run (0–100)
7. **Update** — Persist to DB, update memory

## Memory Architecture

```
MemoryService
├── EpisodicMemory ← TradeLedgerService
│   ├── getRecentBySymbol()
│   ├── getBySetupType()
│   └── getWinRate()
├── SemanticMemory ← agent_memory table
│   ├── getTopPatterns()
│   ├── getRulesForRegime()
│   └── storeEntry(key, content, tags)
└── QdrantMemory (optional)
    ├── storeSignal()
    └── findSimilar() → vector similarity
```

## Guardrails
| Guardrail | Default | Effect |
|---|---|---|
| confidenceFloor | 60 | Blocks decisions below this |
| maxRiskPerTrade | 0.02 (2%) | Rejects excessive risk |
| requireConfluenceMin | 2 | Minimum draw targets |
| confidenceThreshold | 50 | Signal validation floor |

## Structured Outputs
- `lib/llm/structured.ts` — Zod-based structured extraction with auto-retry
- Used by AgentLoop reason() step and AgentEvaluator
