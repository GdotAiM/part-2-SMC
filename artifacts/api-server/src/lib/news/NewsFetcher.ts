/**
 * News Fetcher — Crawl4AI-equivalent web scraper for news and macro events.
 *
 * Fetches financial news from RSS feeds and web pages. Designed to feed
 * into agent reasoning so the AI can consider macro context when generating
 * signals or evaluating setups.
 *
 * Configurable via env var NEWS_ENABLED — gracefully disabled when not set.
 */

import * as cheerio from "cheerio";
import { logger } from "../logger.js";

// ─── Types ────────────────────────────────────────────────────────────────

export interface NewsArticle {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  summary: string;
  content: string;
  relevance: string[];
  impact: "high" | "medium" | "low";
}

export interface MacroEvent {
  title: string;
  date: string;
  type: "economic" | "fed" | "earnings" | "geopolitical" | "crypto";
  expectedImpact: "high" | "medium" | "low";
  description: string;
}

// ─── Config ───────────────────────────────────────────────────────────────

const NEWS_ENABLED = process.env.NEWS_ENABLED === "true";
const CMC_API_KEY = process.env.COINMARKETCAP_API_KEY || "";

// ─── Sources ──────────────────────────────────────────────────────────────

const RSS_FEEDS: Array<{ name: string; url: string; category: string[] }> = [
  { name: "CoinDesk", url: "https://www.coindesk.com/arc/outboundfeeds/rss/", category: ["crypto", "blockchain"] },
  { name: "Bloomberg Crypto", url: "https://feeds.bloomberg.com/markets/news.rss", category: ["markets", "crypto"] },
  { name: "Reuters Markets", url: "https://www.reutersagency.com/feed/?taxonomy=best-sectors&post_type=best&best-sector=markets", category: ["markets", "macro"] },
  { name: "TradingView News", url: "https://www.tradingview.com/newsfeed/", category: ["markets", "trading"] },
];

// ─── NewsFetcher ──────────────────────────────────────────────────────────

export class NewsFetcher {
  private cache: Map<string, { articles: NewsArticle[]; fetchedAt: number }> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Fetch latest news articles related to a symbol or market.
   */
  async fetchNews(symbol: string, limit = 5): Promise<NewsArticle[]> {
    if (!NEWS_ENABLED) return [];

    const cacheKey = `news_${symbol}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < this.CACHE_TTL) {
      return cached.articles.slice(0, limit);
    }

    try {
      const articles: NewsArticle[] = [];

      // Try CoinMarketCap news for crypto
      if (symbol.includes("USDT") && CMC_API_KEY) {
        const cmcArticles = await this.fetchCmcNews(symbol.replace("USDT", ""));
        articles.push(...cmcArticles);
      }

      // Try RSS feeds
      const rssArticles = await this.fetchRssFeeds();
      articles.push(...rssArticles);

      // Filter by symbol relevance
      const filtered = this.filterBySymbol(articles, symbol);

      this.cache.set(cacheKey, { articles, fetchedAt: Date.now() });
      return filtered.slice(0, limit);
    } catch (err: any) {
      logger.warn({ err: err.message, symbol }, "News fetch failed, returning empty");
      return [];
    }
  }

  /**
   * Fetch upcoming macro economic events.
   */
  async fetchMacroEvents(limit = 10): Promise<MacroEvent[]> {
    if (!NEWS_ENABLED) return [];

    // For now, return hardcoded high-impact events
    // In production, this would hit an economic calendar API
    return [
      {
        title: "FOMC Interest Rate Decision",
        date: new Date(Date.now() + 7 * 86400000).toISOString(),
        type: "fed",
        expectedImpact: "high",
        description: "Federal Reserve interest rate decision and monetary policy statement",
      },
      {
        title: "US CPI Data Release",
        date: new Date(Date.now() + 3 * 86400000).toISOString(),
        type: "economic",
        expectedImpact: "high",
        description: "Consumer Price Index inflation data",
      },
      {
        title: "BTC Options Expiry",
        date: new Date(Date.now() + 14 * 86400000).toISOString(),
        type: "crypto",
        expectedImpact: "medium",
        description: "Monthly Bitcoin options expiry — typically high volatility",
      },
    ];
  }

  /**
   * Format news context for LLM prompt injection.
   */
  async formatForPrompt(symbol: string): Promise<string> {
    const articles = await this.fetchNews(symbol);
    if (articles.length === 0) return "";

    const lines = articles.map(
      (a) => `  • [${a.source}] ${a.title} (${a.impact} impact)`,
    );

    return `\nRECENT NEWS & EVENTS:\n${lines.join("\n")}`;
  }

  // ── Private methods ──────────────────────────────────────────────────

  private async fetchCmcNews(symbol: string): Promise<NewsArticle[]> {
    try {
      const res = await fetch(
        `https://pro-api.coinmarketcap.com/v1/cryptocurrency/news?symbol=${symbol}`,
        { headers: { "X-CMC_PRO_API_KEY": CMC_API_KEY } },
      );
      if (!res.ok) return [];
      const json = await res.json();
      return (json.data || []).slice(0, 5).map((item: any) => ({
        title: item.title,
        url: item.url,
        source: "CoinMarketCap",
        publishedAt: item.published_at || new Date().toISOString(),
        summary: item.summary || "",
        content: item.body || item.summary || "",
        relevance: ["crypto", symbol.toLowerCase()],
        impact: "medium" as const,
      }));
    } catch {
      return [];
    }
  }

  private async fetchRssFeeds(): Promise<NewsArticle[]> {
    const articles: NewsArticle[] = [];

    for (const feed of RSS_FEEDS) {
      try {
        const res = await fetch(feed.url, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) continue;
        const xml = await res.text();
        const $ = cheerio.load(xml, { xml: true });

        $("item").each((_i, el) => {
          const title = $(el).find("title").text().trim();
          const link = $(el).find("link").text().trim();
          const desc = $(el).find("description").text().trim();
          const pubDate = $(el).find("pubDate").text().trim();

          if (!title) return;

          articles.push({
            title,
            url: link || feed.url,
            source: feed.name,
            publishedAt: pubDate || new Date().toISOString(),
            summary: desc.slice(0, 300),
            content: desc,
            relevance: feed.category,
            impact: this.assessImpact(title, desc),
          });
        });
      } catch {
        // Skip failed feeds silently
      }
    }

    return articles;
  }

  private filterBySymbol(articles: NewsArticle[], symbol: string): NewsArticle[] {
    const baseSymbol = symbol.replace("USDT", "").replace("=X", "").toLowerCase();
    return articles.filter((a) => {
      const text = `${a.title} ${a.summary} ${a.content}`.toLowerCase();
      return text.includes(baseSymbol) || a.relevance.some((r) => text.includes(r));
    });
  }

  private assessImpact(title: string, desc: string): "high" | "medium" | "low" {
    const text = `${title} ${desc}`.toLowerCase();
    const highImpact = ["fed", "fomc", "interest rate", "cpi", "nonfarm", "jobs report", "inflation", "recession"];
    const mediumImpact = ["earnings", "sec", "regulation", "etf", "halving", "options expiry"];

    if (highImpact.some((w) => text.includes(w))) return "high";
    if (mediumImpact.some((w) => text.includes(w))) return "medium";
    return "low";
  }
}
