import { env } from '../../config/env.js';

// Centralized RAG configuration. All tunable values come from environment
// with safe defaults; nothing is hardcoded in the engine.

export interface RagConfig {
  enabled: boolean;
  topK: number;
  similarityThreshold: number;
  chunkSize: number;
  chunkOverlap: number;
  embeddingProvider: string;
  embeddingDimensions: number;
  maxContextChars: number;
  retrievalCacheTtlMs: number;
  timeoutMs: number;
  adminApiKey?: string;
}

export function getRagConfig(): RagConfig {
  return {
    enabled: env.RAG_ENABLED,
    topK: env.RAG_TOP_K,
    similarityThreshold: env.RAG_SIMILARITY_THRESHOLD,
    chunkSize: env.RAG_CHUNK_SIZE,
    chunkOverlap: env.RAG_CHUNK_OVERLAP,
    embeddingProvider: env.EMBEDDING_PROVIDER,
    embeddingDimensions: env.EMBEDDING_DIMENSIONS,
    maxContextChars: env.RAG_MAX_CONTEXT_CHARS,
    retrievalCacheTtlMs: env.RAG_CACHE_TTL_MS,
    timeoutMs: env.RAG_TIMEOUT_MS,
    adminApiKey: env.RAG_ADMIN_API_KEY,
  };
}
