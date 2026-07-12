/**
 * TradingView CDP Connection — Puppeteer singleton for Chrome DevTools Protocol.
 *
 * Manages connection to TradingView Desktop (--remote-debugging-port=9222)
 * or the web version. Provides evaluate() and screenshot() helpers that
 * all TV tools use internally.
 *
 * Graceful degradation: if connection fails, every public method returns
 * null/empty. The system continues with SMC data without crashing.
 */

import { logger } from "../../../logger.js";
import { langfuse } from "../../../observability/langfuse.js";
import { getTvConfig } from "../config.js";
import type { Page } from "puppeteer";

// ─── Lazy import ─────────────────────────────────────────────────────────
// puppeteer is a large dependency — only loaded when TV integration is active.

let _puppeteer: typeof import("puppeteer") | null = null;
let _browser: import("puppeteer").Browser | null = null;
let _page: Page | null = null;
let _connected = false;
let _lastHealthCheck = 0;
let _traceId: string | null = null;

async function getPuppeteer(): Promise<typeof import("puppeteer") | null> {
  if (!_puppeteer) {
    try {
      _puppeteer = await import("puppeteer");
    } catch {
      logger.warn("puppeteer not available — TV CDP integration disabled");
      return null;
    }
  }
  return _puppeteer;
}

// ─── Connection management ────────────────────────────────────────────────

/**
 * Connect to TradingView Desktop via CDP (or web version).
 * Idempotent — safe to call multiple times.
 */
export async function connect(): Promise<boolean> {
  if (_connected && _page) return true;
  const tvConfig = getTvConfig();
  if (!tvConfig.enabled) return false;

  const puppeteer = await getPuppeteer();
  if (!puppeteer) return false;

  _traceId = langfuse.createTrace({
    name: "tv_cdp_connect",
    tags: ["tradingview", "cdp"],
    metadata: { port: tvConfig.connection.cdpPort, type: tvConfig.connection.type },
  });

  try {
    if (tvConfig.connection.type === "web") {
      // Launch our own browser instance for web mode
      logger.info({ url: tvConfig.connection.webUrl }, "Launching browser for TradingView web...");
      _browser = await puppeteer.launch({
        headless: false,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
        defaultViewport: { width: 1280, height: 800 },
      });
      _page = await _browser.newPage();
      await _page.goto(tvConfig.connection.webUrl, { waitUntil: "networkidle2", timeout: 30000 });
    } else {
      // Desktop mode — connect to existing browser (requires --remote-debugging-port)
      const cdpHost = process.env.DOCKER_HOST_INTERNAL || "127.0.0.1";
      const browserUrl = `http://${cdpHost}:${tvConfig.connection.cdpPort}`;
      logger.info({ browserUrl }, "Connecting to TradingView Desktop via CDP...");
      _browser = await puppeteer.connect({ browserURL: browserUrl });
      const pages = await _browser.pages();
      _page = pages.find((p) => p.url().toLowerCase().includes("tradingview")) ?? pages[0] ?? null;
      if (!_page) {
        _page = await _browser.newPage();
        await _page.goto(tvConfig.connection.webUrl, { waitUntil: "networkidle2", timeout: 30000 });
      }
    }
    const pages = await _browser.pages();
    // Find the TradingView tab — look for a page with 'tradingview' in the URL
    _page = pages.find((p) => p.url().toLowerCase().includes("tradingview")) ?? pages[0] ?? null;

    if (!_page) {
      // Open a new page to the web version
      _page = await _browser.newPage();
      await _page.goto(tvConfig.connection.webUrl, { waitUntil: "networkidle2", timeout: 30000 });
    }

    _connected = true;
    langfuse.endSpan(_traceId, _traceId, { connected: true, url: _page.url() });
    logger.info({ url: _page.url() }, "TradingView CDP connected");
    return true;
  } catch (err: any) {
    _connected = false;
    langfuse.endSpan(_traceId, _traceId, { connected: false, error: err.message });
    logger.warn({ err: err.message }, "TradingView CDP connection failed — integration disabled");
    return false;
  }
}

/**
 * Disconnect from TradingView and clean up.
 */
export async function disconnect(): Promise<void> {
  if (_page) {
    try { await _page.close(); } catch { /* ignore */ }
    _page = null;
  }
  if (_browser) {
    try { await _browser.disconnect(); } catch { /* ignore */ }
    _browser = null;
  }
  _connected = false;
  logger.info("TradingView CDP disconnected");
}

// ─── Health check ─────────────────────────────────────────────────────────

/**
 * Check if the CDP connection is still alive.
 * Automatically reconnects if stale and enabled.
 */
export async function isConnected(): Promise<boolean> {
  if (!_connected || !_page) return false;

  // Throttle health checks to every 5s
  if (Date.now() - _lastHealthCheck < 5000) return _connected;

  _lastHealthCheck = Date.now();
  try {
    const title = await _page.evaluate(() => document.title);
    _connected = title.toLowerCase().includes("tradingview") || title.length > 0;
  } catch {
    _connected = false;
    // Attempt reconnect
    if (getTvConfig().enabled) {
      logger.info("CDP connection lost — attempting reconnect...");
      await disconnect();
      _connected = await connect();
    }
  }
  return _connected;
}

// ─── Evaluation helpers ───────────────────────────────────────────────────

/**
 * Safely evaluate JavaScript in the TradingView page context.
 * Returns null on failure (graceful degradation).
 */
export async function evaluate<T>(fn: () => T): Promise<T | null> {
  if (!(await isConnected()) || !_page) return null;
  try {
    return await _page.evaluate(fn);
  } catch (err: any) {
    logger.warn({ err: err.message }, "TV page evaluate failed");
    return null;
  }
}

/**
 * Safely evaluate JavaScript with arguments in the TV page context.
 */
export async function evaluateWithArgs<T, A extends unknown[]>(
  fn: (...args: A) => T,
  ...args: A
): Promise<T | null> {
  if (!(await isConnected()) || !_page) return null;
  try {
    return await _page.evaluate(fn, ...args);
  } catch (err: any) {
    logger.warn({ err: err.message }, "TV page evaluateWithArgs failed");
    return null;
  }
}

/**
 * Get the active page URL.
 */
export async function getPageUrl(): Promise<string | null> {
  if (!(await isConnected()) || !_page) return null;
  try {
    return _page.url();
  } catch {
    return null;
  }
}
