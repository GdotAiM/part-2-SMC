/**
 * Monitoring Manager — singleton that tracks active background AgentLoop instances.
 *
 * Each monitor is tied to a specific symbol/timeframe pair and runs the
 * AgentLoop on candleClose events. Monitors can be started, stopped, and
 * queried via the API layer.
 */

import { AgentLoop } from "./AgentLoop.js";
import type { LoopConfig } from "./types.js";
import { logger } from "../logger.js";

interface MonitorRecord {
  id: string;
  loop: AgentLoop;
  symbol: string;
  timeframe: string;
  createdAt: number;
}

export class MonitoringManager {
  private monitors: Map<string, MonitorRecord> = new Map();
  private idCounter = 0;

  /**
   * Create and start a new background monitor.
   * Returns the monitor ID.
   */
  async add(config: LoopConfig): Promise<string> {
    const id = `monitor_${++this.idCounter}`;
    const loop = new AgentLoop(config);

    const record: MonitorRecord = {
      id,
      loop,
      symbol: config.symbol,
      timeframe: config.timeframe,
      createdAt: Date.now(),
    };

    this.monitors.set(id, record);

    try {
      await loop.startMonitoring();
      logger.info({ monitorId: id, symbol: config.symbol, timeframe: config.timeframe }, "Monitor started");
    } catch (err: any) {
      logger.error({ err, monitorId: id }, "Monitor failed to start");
      this.monitors.delete(id);
      throw err;
    }

    return id;
  }

  /**
   * Stop and remove a background monitor.
   */
  remove(id: string): boolean {
    const record = this.monitors.get(id);
    if (!record) return false;

    record.loop.stop();
    this.monitors.delete(id);
    logger.info({ monitorId: id, symbol: record.symbol }, "Monitor stopped");
    return true;
  }

  /**
   * Get a monitor by ID.
   */
  get(id: string): AgentLoop | undefined {
    return this.monitors.get(id)?.loop;
  }

  /**
   * Get status summaries for all active monitors.
   */
  getAll(): Array<{
    id: string;
    symbol: string;
    timeframe: string;
    status: string;
    iterations: number;
    createdAt: number;
  }> {
    return [...this.monitors.values()].map((r) => {
      const status = r.loop.getStatus();
      return {
        id: r.id,
        symbol: r.symbol,
        timeframe: r.timeframe,
        status: status.status,
        iterations: status.iterations,
        createdAt: r.createdAt,
      };
    });
  }

  /**
   * Stop all active monitors.
   */
  stopAll(): void {
    for (const [id, record] of this.monitors) {
      record.loop.stop();
      logger.info({ monitorId: id, symbol: record.symbol }, "Monitor stopped (stopAll)");
    }
    this.monitors.clear();
  }
}

// Singleton
export const monitoringManager = new MonitoringManager();
