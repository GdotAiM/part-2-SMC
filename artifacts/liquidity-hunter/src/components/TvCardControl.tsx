import { useState, useCallback } from "react";
import { Tv, Check, Loader2 } from "lucide-react";

const API = import.meta.env.BASE_URL.replace(/\/$/, "");
function apiUrl(path: string) { return `${API}/api${path}`; }

type DrawState = "idle" | "loading" | "done" | "error";

export function TvCardControl({ symbol, timeframe }: { symbol: string; timeframe: string }) {
  const [state, setState] = useState<DrawState>("idle");
  const [tip, setTip] = useState("Draw SMC levels on TV");

  const draw = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (state === "loading") return;

    setState("loading");
    setTip(`Drawing ${symbol} ${timeframe}...`);

    try {
      // Step 1: Change TV Desktop symbol/timeframe to match this card
      const res = await fetch(apiUrl("/agent-loop/tv-draw"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "levels",
          symbol,
          timeframe,
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(err.substring(0, 80));
      }

      setState("done");
      setTip(`✅ Levels drawn for ${symbol} ${timeframe}`);
      setTimeout(() => { setState("idle"); setTip("Draw SMC levels on TV"); }, 2500);
    } catch (err: any) {
      setState("error");
      setTip(`❌ ${err.message}`);
      setTimeout(() => { setState("idle"); setTip("Draw SMC levels on TV"); }, 3000);
    }
  }, [symbol, timeframe, state]);

  return (
    <button
      onClick={draw}
      title={tip}
      className={`flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-[9px] font-semibold uppercase tracking-wider transition-all cursor-pointer
        ${state === "done"
          ? "bg-green-500/20 text-green-400 border border-green-500/30"
          : state === "error"
            ? "bg-destructive/10 text-destructive border border-destructive/30"
            : state === "loading"
              ? "bg-primary/10 text-primary border border-primary/30"
              : "bg-muted/50 text-muted-foreground border border-border/50 hover:bg-primary/10 hover:text-primary hover:border-primary/30"
        }`}
    >
      {state === "loading" ? (
        <Loader2 className="w-2.5 h-2.5 animate-spin" />
      ) : state === "done" ? (
        <Check className="w-2.5 h-2.5" />
      ) : (
        <Tv className="w-2.5 h-2.5" />
      )}
      <span>TV</span>
    </button>
  );
}
