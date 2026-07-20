/**
 * useSessionClock — live countdown timer for the current session.
 * Updates every second.
 */

import { useState, useEffect } from "react";
import { detectSession, type SessionInfo } from "@/state/narrative";

export function useSessionClock(): SessionInfo & { formatted: string; progress: number } {
  const [session, setSession] = useState(() => {
    const s = detectSession();
    return s;
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setSession(detectSession());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const totalMs = session.utcEnd - session.utcStart;
  const elapsedMs = Date.now() - session.utcStart;
  const progress = Math.min(100, Math.max(0, (elapsedMs / totalMs) * 100));

  const mins = Math.floor(session.timeRemaining / 60000);
  const secs = Math.floor((session.timeRemaining % 60000) / 1000);
  const formatted = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

  return { ...session, formatted, progress };
}
