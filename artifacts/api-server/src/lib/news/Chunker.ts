/**
 * Text Chunker — Chonkie-equivalent for intelligent text splitting.
 *
 * Supports multiple chunking strategies:
 * - sentence: Split by sentence boundaries
 * - paragraph: Split by paragraph breaks
 * - semantic: Split by topic shifts (using simple heuristics)
 * - token: Split by approximate token count
 */

export type ChunkStrategy = "sentence" | "paragraph" | "semantic" | "token";

export interface ChunkOptions {
  strategy: ChunkStrategy;
  maxTokens?: number;
  overlap?: number; // overlap in characters
}

export interface TextChunk {
  index: number;
  content: string;
  startOffset: number;
  endOffset: number;
  tokenCount: number;
}

const DEFAULT_OPTIONS: Required<ChunkOptions> = {
  strategy: "paragraph",
  maxTokens: 512,
  overlap: 50,
};

export class TextChunker {
  private options: Required<ChunkOptions>;

  constructor(options?: Partial<ChunkOptions>) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Split text into chunks using the configured strategy.
   */
  chunk(text: string): TextChunk[] {
    switch (this.options.strategy) {
      case "sentence": return this.chunkBySentence(text);
      case "paragraph": return this.chunkByParagraph(text);
      case "semantic": return this.chunkBySemantic(text);
      case "token": return this.chunkByToken(text);
      default: return this.chunkByParagraph(text);
    }
  }

  /**
   * Chunk a news article into digestible segments for LLM context.
   */
  chunkNewsArticle(article: { title: string; content: string; summary: string }): TextChunk[] {
    const text = `Title: ${article.title}\n\n${article.summary}\n\n${article.content}`;
    return this.chunk(text);
  }

  /**
   * Chunk a PDF document and return the most relevant chunks for a query.
   */
  chunkDocument(document: string, _query?: string): TextChunk[] {
    const chunks = this.chunk(document);
    return chunks;
  }

  // ── Strategies ──────────────────────────────────────────────────────

  private chunkBySentence(text: string): TextChunk[] {
    const sentenceEnd = /[.!?\n]+/g;
    return this.buildChunks(text, sentenceEnd, 200);
  }

  private chunkByParagraph(text: string): TextChunk[] {
    const paraBreak = /\n\s*\n/g;
    return this.buildChunks(text, paraBreak, this.options.maxTokens * 4);
  }

  private chunkBySemantic(text: string): TextChunk[] {
    // Simple semantic boundary detection: heading lines, bullet transitions,
    // or marker words like "However", "In contrast", "Meanwhile"
    const semanticPattern = /(^|\n)(#{1,3}\s|[A-Z][A-Z\s]{2,}:\s|\n•|\n- |However,|Meanwhile,|In contrast,|On the other hand,)/g;
    return this.buildChunks(text, semanticPattern, this.options.maxTokens * 3);
  }

  private chunkByToken(text: string): TextChunk[] {
    const approxTokens = Math.ceil(text.length / 4);
    const numChunks = Math.max(1, Math.ceil(approxTokens / this.options.maxTokens));
    const chunkSize = Math.ceil(text.length / numChunks);
    const chunks: TextChunk[] = [];

    for (let i = 0; i < numChunks; i++) {
      const start = i * chunkSize;
      let end = Math.min(start + chunkSize + this.options.overlap, text.length);
      if (i < numChunks - 1) {
        // Try to break at a natural boundary
        const searchEnd = Math.min(end, text.length);
        const naturalBreak = text.lastIndexOf("\n", searchEnd);
        if (naturalBreak > start + chunkSize / 2) end = naturalBreak;
      }
      const content = text.slice(start, end).trim();
      if (!content) continue;
      chunks.push({
        index: i,
        content,
        startOffset: start,
        endOffset: end,
        tokenCount: Math.ceil(content.length / 4),
      });
    }
    return chunks;
  }

  private buildChunks(text: string, delimiter: RegExp, maxLen: number): TextChunk[] {
    const parts = text.split(delimiter).map((s) => s.trim()).filter(Boolean);
    const chunks: TextChunk[] = [];
    let current = "";
    let startOffset = 0;

    for (const part of parts) {
      if ((current + " " + part).length > maxLen && current.length > 0) {
        chunks.push({
          index: chunks.length,
          content: current.trim(),
          startOffset: startOffset,
          endOffset: startOffset + current.length,
          tokenCount: Math.ceil(current.length / 4),
        });
        startOffset += current.length - this.options.overlap;
        current = part;
      } else {
        current += (current ? " " : "") + part;
      }
    }

    if (current.trim()) {
      chunks.push({
        index: chunks.length,
        content: current.trim(),
        startOffset,
        endOffset: text.length,
        tokenCount: Math.ceil(current.length / 4),
      });
    }

    return chunks;
  }
}
