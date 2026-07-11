/**
 * News & Macro Data Layer — unified entry point.
 *
 * Combines news fetching (Crawl4AI-equivalent), text chunking (Chonkie-equivalent),
 * and PDF parsing (Marker-equivalent) into one module.
 *
 * Enable via NEWS_ENABLED=true in .env.
 */

import { NewsFetcher } from "./NewsFetcher.js";
import { TextChunker } from "./Chunker.js";
import { PdfParser } from "./PdfParser.js";

export { NewsFetcher } from "./NewsFetcher.js";
export { TextChunker } from "./Chunker.js";
export { PdfParser } from "./PdfParser.js";
export type { NewsArticle, MacroEvent } from "./NewsFetcher.js";
export type { TextChunk, ChunkOptions, ChunkStrategy } from "./Chunker.js";
export type { PdfDocument } from "./PdfParser.js";

export const newsFetcher = new NewsFetcher();
export const textChunker = new TextChunker();
export const pdfParser = new PdfParser();

/**
 * Build a formatted news context string for LLM prompt injection.
 * Returns empty string when news is disabled or no articles found.
 */
export async function buildNewsContext(symbol: string): Promise<string> {
  const newsPart = await newsFetcher.formatForPrompt(symbol);
  const events = await newsFetcher.fetchMacroEvents(3);

  const parts: string[] = [];
  if (newsPart) parts.push(newsPart);

  if (events.length > 0) {
    const eventLines = events.map(
      (e) => `  • ${e.title} (${e.type}, ${e.expectedImpact} impact, ${new Date(e.date).toLocaleDateString()})`,
    );
    parts.push(`\nUPCOMING ECONOMIC EVENTS:\n${eventLines.join("\n")}`);
  }

  return parts.join("\n");
}
