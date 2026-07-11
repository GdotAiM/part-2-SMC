const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export function apiUrl(path: string): string {
  return `${BASE}/api${path}`;
}



export interface SymbolInfo {
  symbol: string;
  label: string;
  market: "crypto" | "forex";
  correlatedSymbol?: string;
}

export interface SymbolsData {
  crypto: SymbolInfo[];
  forex: SymbolInfo[];
}

export async function fetchSymbols(): Promise<SymbolsData> {
  const res = await fetch(apiUrl("/symbols"));
  return res.json();
}

export type ChatMessage = { role: "user" | "assistant" | "tool"; content: string; tool_call_id?: string };

// ── Classic endpoint ──────────────────────────────────────────────────────────

export async function askAgents(
  question: string,
  report: unknown,
  history: ChatMessage[],
  onChunk: (text: string) => void,
): Promise<void> {
  const res = await fetch(apiUrl("/agents/ask"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, report, history }),
  });

  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith("data: ")) continue;
      try {
        const json = JSON.parse(t.slice(6));
        if (json.content) onChunk(json.content);
        if (json.done) return;
        if (json.error) throw new Error(json.error);
      } catch {
        // skip
      }
    }
  }
}

// ── MCP-aware endpoint ───────────────────────────────────────────────────────

export type McpStreamEvent =
  | { type: "content"; content: string }
  | { type: "tool_start"; tool: string }
  | { type: "tool_result"; tool: string; content: string }
  | { type: "done" }
  | { type: "error"; error: string };

export async function askAgentsMcp(
  question: string,
  history: ChatMessage[],
  context: { symbol?: string; timeframe?: string; currentPrice?: number } | undefined,
  onEvent: (event: McpStreamEvent) => void,
): Promise<void> {
  const res = await fetch(apiUrl("/agents/ask-mcp"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, history, context }),
  });

  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith("data: ")) continue;
      try {
        const json = JSON.parse(t.slice(6));
        if (json.tool_start) onEvent({ type: "tool_start", tool: json.tool_start });
        else if (json.tool_result) onEvent({ type: "tool_result", tool: json.tool_result, content: json.content });
        else if (json.content) onEvent({ type: "content", content: json.content });
        else if (json.done) onEvent({ type: "done" });
        else if (json.error) onEvent({ type: "error", error: json.error });
      } catch {
        // skip malformed SSE lines
      }
    }
  }
}

// ── Agent Loop endpoints ─────────────────────────────────────────────────

export type LoopStepEvent = {
  type: "loop_step" | "loop_decision" | "loop_signal" | "loop_complete" | "loop_error" | "done";
  step?: any;
  decision?: any;
  signal?: any;
  result?: any;
  error?: string;
};

export async function runAgentLoop(
  params: { symbol: string; timeframe: string; market: string; config?: any },
  onEvent: (event: LoopStepEvent) => void,
): Promise<void> {
  const res = await fetch(apiUrl("/agent-loop/run"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith("data: ")) continue;
      try {
        const json = JSON.parse(t.slice(6));
        onEvent(json as LoopStepEvent);
        if (json.type === "done") return;
      } catch { /* skip */ }
    }
  }
}

export async function startLoopMonitor(params: {
  symbol: string;
  timeframe: string;
  market: string;
}): Promise<{ monitorId: string; status: string }> {
  const res = await fetch(apiUrl("/agent-loop/start-monitoring"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return res.json();
}

export async function stopLoopMonitor(monitorId: string): Promise<{ status: string }> {
  const res = await fetch(apiUrl("/agent-loop/stop-monitoring"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ monitorId }),
  });
  return res.json();
}

export async function getLoopStatus(): Promise<{ monitors: any[]; count: number }> {
  const res = await fetch(apiUrl("/agent-loop/status"));
  return res.json();
}

export async function getLoopRuns(params?: {
  symbol?: string;
  status?: string;
  limit?: number;
}): Promise<{ runs: any[] }> {
  const qs = new URLSearchParams();
  if (params?.symbol) qs.set("symbol", params.symbol);
  if (params?.status) qs.set("status", params.status);
  if (params?.limit) qs.set("limit", String(params.limit));
  const res = await fetch(apiUrl(`/agent-loop/runs?${qs}`));
  return res.json();
}

export async function getLoopRunDetail(runId: string): Promise<{ run: any; steps: any[] }> {
  const res = await fetch(apiUrl(`/agent-loop/runs/${runId}`));
  return res.json();
}

// ── Broker / Execution endpoints ──────────────────────────────────────────

export async function getBrokerStatus(): Promise<{
  broker_name: string;
  is_ready: boolean;
  mode: "REVIEW" | "LIVE";
  is_paper: boolean;
}> {
  const res = await fetch(apiUrl("/broker/status"));
  return res.json();
}

export async function setBrokerMode(mode: "REVIEW" | "LIVE", confirm?: string): Promise<{ mode: string }> {
  const res = await fetch(apiUrl("/broker/mode"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode, confirm }),
  });
  if (!res.ok) throw new Error((await res.json()).error);
  return res.json();
}

export async function executeSignal(signal: Record<string, unknown>): Promise<{
  success: boolean;
  order_id?: string;
  message?: string;
  error?: string;
}> {
  const res = await fetch(apiUrl("/signals/execute"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ signal }),
  });
  if (!res.ok) throw new Error((await res.json()).error);
  return res.json();
}

export async function generateSignal(params: {
  symbol: string;
  market: string;
  timeframe: string;
}): Promise<{ signals: any[]; message?: string }> {
  const res = await fetch(apiUrl("/signals/generate"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return res.json();
}


// ── News & Intelligence endpoints ──────────────────────────────────────────

export async function fetchNews(symbol: string, limit?: number): Promise<{ articles: any[] }> {
  const qs = new URLSearchParams({ symbol });
  if (limit) qs.set("limit", String(limit));
  const res = await fetch(apiUrl(`/agent-loop/news?${qs}`));
  return res.json();
}

export async function fetchMacroEvents(): Promise<{ events: any[] }> {
  const res = await fetch(apiUrl("/agent-loop/news/macro"));
  return res.json();
}

export async function findSimilarSetups(params: {
  symbol?: string; setupType?: string; marketRegime?: string; limit?: number;
}): Promise<{ results: any[] }> {
  const res = await fetch(apiUrl("/agent-loop/similar-setups"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return res.json();
}

export async function getNewsContext(symbol: string): Promise<{ context: string }> {
  const res = await fetch(apiUrl(`/agent-loop/news-context?symbol=${symbol}`));
  return res.json();
}

export async function getQdrantStatus(): Promise<{ connected: boolean; collections: string[] }> {
  const res = await fetch(apiUrl("/agent-loop/qdrant-status"));
  return res.json();
}

export async function getSemanticMemory(params?: {
  tags?: string;
  limit?: number;
}): Promise<{ entries: any[] }> {
  const qs = new URLSearchParams();
  if (params?.tags) qs.set("tags", params.tags);
  if (params?.limit) qs.set("limit", String(params.limit));
  const res = await fetch(apiUrl(`/agent-loop/memory?${qs}`));
  return res.json();
}

export type PipelineEvent =
  | { agent: string; type: "start" }
  | { agent: string; type: "delta"; content: string }
  | { agent: string; type: "done" }
  | { agent: string; type: "error"; content: string }
  | { type: "pipeline_done" };

export async function runAgentPipeline(
  report: unknown,
  onEvent: (event: PipelineEvent) => void,
): Promise<void> {
  const res = await fetch(apiUrl("/agents/pipeline"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ report }),
  });

  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith("data: ")) continue;
      try {
        const json = JSON.parse(t.slice(6));
        onEvent(json as PipelineEvent);
      } catch {
        // skip
      }
    }
  }
}
