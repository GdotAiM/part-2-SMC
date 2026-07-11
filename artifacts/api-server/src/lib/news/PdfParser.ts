/**
 * PDF Parser — Marker-equivalent for extracting text from PDF documents.
 *
 * Uses pdf-parse to extract text from financial reports, FOMC minutes,
 * and other PDF documents. Extracted text can then be chunked and fed
 * into the agent reasoning pipeline.
 */

import fs from "fs";
import path from "path";
import { logger } from "../logger.js";
import { TextChunker } from "./Chunker.js";
import type { TextChunk } from "./Chunker.js";

export interface PdfDocument {
  filename: string;
  text: string;
  numPages: number;
  metadata: Record<string, unknown>;
}

export class PdfParser {
  private chunker: TextChunker;

  constructor() {
    this.chunker = new TextChunker({ strategy: "paragraph", maxTokens: 1024, overlap: 30 });
  }

  /**
   * Parse a PDF file and extract text.
   */
  async parse(filePath: string): Promise<PdfDocument> {
    const filename = path.basename(filePath);
    logger.info({ filename }, "Parsing PDF document");

    try {
      const { default: pdfParse } = await import("pdf-parse");
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdfParse(dataBuffer);

      return {
        filename,
        text: data.text,
        numPages: data.numpages || 0,
        metadata: {
          author: (data as any).author || "",
          title: (data as any).title || "",
          subject: (data as any).subject || "",
          keywords: (data as any).keywords || "",
          created: (data as any).created || "",
          modified: (data as any).modified || "",
        },
      };
    } catch (err: any) {
      logger.error({ err: err.message, filename }, "PDF parsing failed");
      throw new Error(`Failed to parse PDF ${filename}: ${err.message}`);
    }
  }

  /**
   * Parse a PDF from a URL (fetches and parses in-memory).
   */
  async parseFromUrl(url: string): Promise<PdfDocument> {
    logger.info({ url }, "Fetching and parsing PDF from URL");

    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (!res.ok) throw new Error(`HTTP ${res.status} fetching PDF`);

      const buffer = Buffer.from(await res.arrayBuffer());
      const { default: pdfParse } = await import("pdf-parse");
      const data = await pdfParse(buffer);

      return {
        filename: url.split("/").pop() || "document.pdf",
        text: data.text,
        numPages: data.numpages || 0,
        metadata: {
          source: url,
          title: (data as any).title || "",
        },
      };
    } catch (err: any) {
      logger.error({ err: err.message, url }, "PDF URL parsing failed");
      throw new Error(`Failed to parse PDF from ${url}: ${err.message}`);
    }
  }

  /**
   * Parse and chunk a PDF, returning only the most relevant chunks.
   */
  async parseAndChunk(filePath: string): Promise<TextChunk[]> {
    const doc = await this.parse(filePath);
    return this.chunker.chunkDocument(doc.text);
  }

  /**
   * Extract FOMC minutes summary (looks for key sections in the text).
   */
  extractFomcSummary(doc: PdfDocument): string {
    const text = doc.text;
    const lines: string[] = [];

    // Look for key FOMC sections
    const sections = [
      "Economic Outlook",
      "Inflation",
      "Employment",
      "Interest Rate",
      "Monetary Policy",
      "Federal Funds Rate",
    ];

    for (const section of sections) {
      const idx = text.indexOf(section);
      if (idx >= 0) {
        const slice = text.slice(idx, idx + 1000);
        lines.push(`[${section}] ${slice.trim()}`);
      }
    }

    return lines.join("\n\n") || text.slice(0, 3000);
  }
}
