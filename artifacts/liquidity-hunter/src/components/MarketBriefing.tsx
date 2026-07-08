import { useState, useEffect, useRef, useCallback } from "react";
import {
  X, Radio, AlertCircle, Loader2, BrainCircuit, Send,
} from "lucide-react";
import { askAgents, type ChatMessage } from "@/lib/api";
import type { SmcReport } from "@workspace/api-client-react";

type Status = "idle" | "streaming" | "ready" | "error";

interface Props {
  report: SmcReport | undefined;
  market: "crypto" | "forex";
}

const BRIEFING_PROMPT = `BRIEFING MODE — OVERRIDE DEFAULT SYSTEM INSTRUCTIONS:

You are greeting a trader who just opened the SMC Pulse Predict dashboard. You have been watching the market and are now delivering a concise personal briefing. Use the market context provided in your system prompt to fill in specific details.

DETERMINE CURRENT SESSION from UTC time:
- 00:00-07:00 UTC = Asian session
- 07:00-12:00 UTC = London session
- 12:00-15:00 UTC = London / NY overlap
- 15:00-20:00 UTC = NY session
- 20:00-00:00 UTC = late NY / Asian transition

Respond in EXACTLY 4 short paragraphs (5-7 sentences total). NO markdown, NO bold, NO bullet points. NO headers. Just plain text paragraphs separated by blank lines.

PARAGRAPH 1 — SESSION & MARKET POSTURE (1 sentence):
"Good [session-appropriate greeting] — we are in the [session name] and [symbol] is [what price action suggests: showing intent, ranging, expanding, distributing, etc. based on structure phase and bias]."

PARAGRAPH 2 — SWEEPS & DIVERGENCE (1 sentence):
If SMT is detected: highlight the type, symbols involved, and what it implies. If no SMT, note which liquidity side is most vulnerable: "No SMT divergence detected, but [BSL/SSL] at [price] looks exposed — [reason based on structure direction and nearest pool]." If balanced, state that clearly.

PARAGRAPH 3 — KEY LEVELS & IMBALANCES (1 sentence):
"The key level to watch is the unfilled [bullish/bearish] FVG at [bottom]-[top]" or "The [bullish/bearish] order block at [proximal] area is our zone of interest." Then state PD Array position: "Price is currently trading in [premium/discount/equilibrium] relative to the dealing range." Include specific prices.

PARAGRAPH 4 — DIRECTIONAL LEAN & INVITATION (1-2 sentences):
State the highest-probability next move with an appropriate confidence qualifier. "My base case: [direction] toward [target] given [1-2 key reasons]. Let me know if you want me to zoom in on any timeframe or run the full agent pipeline for deeper confirmation."

ABSOLUTE RULES:
- Always mention specific price levels from the report when referencing liquidity, FVGs, or order blocks.
- Use SMC terminology naturally — BSL, SSL, FVG, PD Array, MSS, BOS, SMT — do not define or explain them.
- Write like a professional institutional desk analyst briefing a colleague. No hedging phrases like "it appears that" or "based on the provided data."
- Do NOT say "I don't have enough information." You have a complete SMC report. Use it.
- TOTAL response: 5-7 sentences across 4 paragraphs. Be direct. Be specific. Be useful.`;

function detectSession(): { label: string; utcRange: string } {
  const hour = new Date().getUTCHours();
  if (hour >= 0 && hour < 7)   return { label: "Asian Session",        utcRange: "00:00-07:00 UTC" };
  if (hour >= 7 && hour < 12)  return { label: "London Session",       utcRange: "07:00-12:00 UTC" };
  if (hour >= 12 && hour < 15) return { label: "London / NY Overlap",  utcRange: "12:00-15:00 UTC" };
  if (hour >= 15 && hour < 20) return { label: "NY Session",           utcRange: "15:00-20:00 UTC" };
  return { label: "Asian / Late NY", utcRange: "20:00-00:00 UTC" };
}

export function MarketBriefing({ report, market: _market }: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const [text, setText] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [dismissed, setDismissed] = useState(false);
  const genRef = useRef(0);
  const startedRef = useRef(false);

  // ── Conversation state ──
  const [conversation, setConversation] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatStreaming, setChatStreaming] = useState(false);
  const [chatText, setChatText] = useState("");
  const chatGenRef = useRef(0);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation, chatText]);

  const startBriefing = useCallback(async () => {
    if (!report) return;
    const gen = ++genRef.current;
    startedRef.current = true;

    setStatus("streaming");
    setText("");
    setErrorMsg("");
    setConversation([]);

    let accumulated = "";
    try {
      await askAgents(BRIEFING_PROMPT, report as unknown as Record<string, unknown>, [], (chunk: string) => {
        if (genRef.current !== gen) return;
        accumulated += chunk;
        setText(accumulated);
      });
      if (genRef.current !== gen) return;
      setStatus(accumulated.length > 0 ? "ready" : "error");
      if (accumulated.length === 0) {
        setErrorMsg("The AI returned an empty response. Try refreshing the page.");
      }
    } catch (err) {
      if (genRef.current !== gen) return;
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Unable to generate briefing");
    }
  }, [report]);

  // Auto-start when report becomes available
  useEffect(() => {
    if (report && !startedRef.current && !dismissed) {
      startBriefing();
    }
  }, [report, dismissed, startBriefing]);

  // Reset on symbol/timeframe change
  useEffect(() => {
    startedRef.current = false;
    setText("");
    setStatus("idle");
    setErrorMsg("");
    setDismissed(false);
    setConversation([]);
    setChatInput("");
    setChatText("");
  }, [report?.symbol, report?.timeframe]);

  // ── Chat handler ──
  const handleChatSend = useCallback(async (q?: string) => {
    const question = (q ?? chatInput).trim();
    if (!question || chatStreaming || !report) return;
    setChatInput("");
    const userMsg: ChatMessage = { role: "user", content: question };
    const history: ChatMessage[] = [
      { role: "assistant", content: text },
      ...conversation,
      userMsg,
    ];
    setConversation(prev => [...prev, userMsg]);
    setChatStreaming(true);
    setChatText("");

    const gen = ++chatGenRef.current;
    let accumulated = "";
    try {
      await askAgents(question, report as unknown as Record<string, unknown>, history, (chunk: string) => {
        if (chatGenRef.current !== gen) return;
        accumulated += chunk;
        setChatText(accumulated);
      });
      if (chatGenRef.current !== gen) return;
      setConversation(prev => [...prev, { role: "assistant", content: accumulated }]);
    } catch {
      if (chatGenRef.current !== gen) return;
      setConversation(prev => [...prev, { role: "assistant", content: "⚠️ Unable to reach the AI agent. Please try again." }]);
    } finally {
      if (chatGenRef.current === gen) {
        setChatStreaming(false);
        setChatText("");
        inputRef.current?.focus();
      }
    }
  }, [chatInput, chatStreaming, report, text, conversation]);

  if (dismissed) return null;

  const session = detectSession();

  // ── Loading skeleton ──
  if (status === "idle") {
    return (
      <div className="rounded-sm border border-border bg-card p-4 animate-pulse space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="h-4 w-4 bg-muted rounded-sm" />
          <div className="h-3 w-36 bg-muted rounded-sm" />
          <div className="h-5 w-20 bg-muted rounded-sm" />
        </div>
        <div className="space-y-2">
          <div className="h-3 w-full bg-muted rounded-sm" />
          <div className="h-3 w-11/12 bg-muted rounded-sm" />
          <div className="h-3 w-4/6 bg-muted rounded-sm" />
          <div className="h-3 w-5/6 bg-muted rounded-sm" />
        </div>
      </div>
    );
  }

  // ── Error state ──
  if (status === "error") {
    return (
      <div className="rounded-sm border border-destructive/20 bg-destructive/5 p-3 flex items-start gap-3">
        <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-destructive mb-0.5">Briefing Unavailable</p>
          <p className="text-[10px] text-muted-foreground leading-relaxed break-all">
            {errorMsg || "An unknown error occurred"}
          </p>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="p-0.5 hover:bg-muted/50 rounded-sm shrink-0"
        >
          <X className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </div>
    );
  }

  // ── Streaming / Ready ──
  return (
    <div className="rounded-sm border border-border bg-card overflow-hidden transition-all duration-300">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/40 bg-muted/15">
        <div className="flex items-center gap-2.5">
          <BrainCircuit className="w-4 h-4 text-primary shrink-0" />
          <span className="text-xs font-bold text-primary uppercase tracking-wider">
            AI Market Briefing
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-sm bg-primary/10 border border-primary/20 text-primary font-medium flex items-center gap-1.5">
            <Radio
              className={`w-2 h-2 ${status === "streaming" ? "animate-pulse text-emerald-400" : ""}`}
            />
            {session.label}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {status === "streaming" && (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-primary/60" />
          )}
          <button
            onClick={() => setDismissed(true)}
            className="p-1 hover:bg-muted rounded-sm transition-colors"
            aria-label="Dismiss briefing"
          >
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-3.5">
        {status === "streaming" && text.length === 0 && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Generating briefing&hellip;</span>
          </div>
        )}

        {text && (
          <div className="text-xs leading-relaxed text-foreground/90 whitespace-pre-wrap font-mono">
            {text}
            {status === "streaming" && (
              <span className="inline-block w-1.5 h-3.5 bg-primary animate-pulse ml-0.5 align-middle rounded-sm" />
            )}
          </div>
        )}
      </div>

      {/* ── Conversation ── */}
      {status === "ready" && (
        <>
          {/* Chat messages */}
          {conversation.length > 0 && (
            <div className="border-t border-border/40 px-4 py-3 space-y-3 max-h-72 overflow-y-auto">
              {conversation.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-sm px-3 py-2 text-xs leading-relaxed ${
                    msg.role === "user"
                      ? "bg-primary/20 text-foreground border border-primary/30"
                      : "bg-muted text-foreground border border-border"
                  }`}>
                    {msg.role === "assistant" && (
                      <p className="text-[10px] text-primary font-semibold uppercase tracking-wider mb-1">Briefing Agent</p>
                    )}
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))}

              {/* Streaming response */}
              {chatStreaming && (
                <div className="flex justify-start">
                  <div className="max-w-[85%] rounded-sm px-3 py-2 text-xs leading-relaxed bg-muted text-foreground border border-border">
                    <p className="text-[10px] text-primary font-semibold uppercase tracking-wider mb-1">Briefing Agent</p>
                    {chatText ? (
                      <p className="whitespace-pre-wrap">{chatText}<span className="inline-block w-1.5 h-3.5 bg-primary/70 animate-pulse ml-0.5 align-middle" /></p>
                    ) : (
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Thinking&hellip;</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div ref={chatBottomRef} />
            </div>
          )}

          {/* Chat input — always visible when ready */}
          <div className="border-t border-border/40 px-4 py-2.5 bg-muted/10 flex items-center gap-2">
            <input
              ref={inputRef}
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleChatSend()}
              placeholder="Ask a follow-up about this briefing…"
              disabled={chatStreaming}
              className="flex-1 bg-muted border border-border rounded-sm px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 font-mono"
            />
            <button
              onClick={() => handleChatSend()}
              disabled={!chatInput.trim() || chatStreaming}
              className="bg-primary text-primary-foreground rounded-sm px-3 py-1.5 disabled:opacity-40 hover:opacity-90 transition-opacity shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] text-muted-foreground hidden sm:inline">
              {report?.symbol} · {report?.timeframe?.toUpperCase()}
            </span>
          </div>
        </>
      )}

      {/* Footer — only when streaming (briefing not yet done, no chat) */}
      {status === "streaming" && report && (
        <div className="border-t border-border/40 px-4 py-2 bg-muted/10 flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">
            {report.symbol} · {report.timeframe.toUpperCase()} ·{" "}
            {new Date(report.generatedAt * 1000).toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            })}
          </span>
          <span className="text-[10px] text-primary/50 font-medium">
            Generating briefing&hellip;
          </span>
        </div>
      )}
    </div>
  );
}
