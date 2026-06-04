const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export function apiUrl(path: string): string {
  return `${BASE}/api${path}`;
}

export type ChatMessage = { role: "user" | "assistant"; content: string };

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
