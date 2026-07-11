/**
 * Vector Memory Types — for Qdrant-powered semantic search.
 */

export interface VectorSignalRecord {
  id: string;
  symbol: string;
  timeframe: string;
  setupType: string;
  setupSubtype: string;
  direction: "long" | "short";
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  confidence: number;
  win: boolean | null;
  pnl: number | null;
  marketRegime: string;
  sessionContext: string;
  narrative: string;
  features: Record<string, number>;
}

export interface SimilarSetupResult {
  id: string;
  symbol: string;
  setupType: string;
  direction: string;
  confidence: number;
  win: boolean | null;
  pnl: number | null;
  similarity: number;
  narrative: string;
}

export interface VectorSearchQuery {
  symbol?: string;
  setupType?: string;
  marketRegime?: string;
  limit?: number;
  minConfidence?: number;
}
