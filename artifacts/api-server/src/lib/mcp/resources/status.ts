import type { FastMCP } from "fastmcp";
import { candleStore } from "../../realtime/candle-store.js";
import { sseManager } from "../../realtime/sse-manager.js";

export function registerStatusResource(server: FastMCP): void {
  (server as Record<string, unknown>).addResource?.({
    uri: "smc://status",
    name: "System Status",
    description:
      "Real-time system status: WebSocket health, connected SSE clients, " +
      "candle store statistics, active symbols.",
    mimeType: "application/json",
    async load() {
      return {
        text: JSON.stringify({
          sseClients: sseManager.getClientCount(),
          clientList: sseManager.getStatus(),
          candleStore: candleStore.getStatus(),
          activeSymbols: candleStore.getActiveSymbols(),
          timestamp: Date.now(),
        }, null, 2),
      };
    },
  });
}
