import { useState, useRef, useEffect } from "react";
import { Send, Loader2, MessageSquare } from "lucide-react";
import { askAgents, type ChatMessage } from "@/lib/api";
import type { SmcReport } from "@workspace/api-client-react";

const SUGGESTED = [
  "Why is the draw bearish?",
  "Where is the strongest liquidity pool?",
  "Which FVG is most important?",
  "Is HTF aligned with LTF?",
  "What invalidates this setup?",
  "Where do institutions likely have orders?",
];

type Props = { report: SmcReport };

export function AgentChat({ report }: Props) {
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, streamingText]);

  async function handleSend(q?: string) {
    const question = (q ?? input).trim();
    if (!question || streaming) return;
    setInput("");
    const userMsg: ChatMessage = { role: "user", content: question };
    setHistory(h => [...h, userMsg]);
    setStreaming(true);
    setStreamingText("");

    let accumulated = "";
    try {
      await askAgents(question, report, history, (chunk) => {
        accumulated += chunk;
        setStreamingText(accumulated);
      });
      setHistory(h => [...h, { role: "assistant", content: accumulated }]);
    } catch (err) {
      setHistory(h => [...h, { role: "assistant", content: "⚠️ Unable to reach the AI agent. Please try again." }]);
    } finally {
      setStreaming(false);
      setStreamingText("");
      inputRef.current?.focus();
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/30">
        <MessageSquare className="w-3.5 h-3.5 text-primary" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ask the Agents</span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        {history.length === 0 && !streaming && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Ask any question about the current market context:</p>
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTED.map(q => (
                <button
                  key={q}
                  onClick={() => handleSend(q)}
                  className="text-[11px] bg-muted hover:bg-accent border border-border rounded-sm px-2 py-1 text-left text-muted-foreground hover:text-foreground transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {history.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-sm px-3 py-2 text-xs leading-relaxed ${
              msg.role === "user"
                ? "bg-primary/20 text-foreground border border-primary/30"
                : "bg-muted text-foreground border border-border"
            }`}>
              {msg.role === "assistant" && (
                <p className="text-[10px] text-primary font-semibold uppercase tracking-wider mb-1">Agent</p>
              )}
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}

        {streaming && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-sm px-3 py-2 text-xs leading-relaxed bg-muted text-foreground border border-border">
              <p className="text-[10px] text-primary font-semibold uppercase tracking-wider mb-1">Agent</p>
              {streamingText ? (
                <p className="whitespace-pre-wrap">{streamingText}<span className="inline-block w-1.5 h-3.5 bg-primary/70 animate-pulse ml-0.5 align-middle" /></p>
              ) : (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Reasoning…</span>
                </div>
              )}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="border-t border-border p-2 flex gap-2">
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()}
          placeholder="Ask the agents…"
          disabled={streaming}
          className="flex-1 bg-muted border border-border rounded-sm px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
        />
        <button
          onClick={() => handleSend()}
          disabled={!input.trim() || streaming}
          className="bg-primary text-primary-foreground rounded-sm px-3 py-1.5 disabled:opacity-40 hover:opacity-90 transition-opacity"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
