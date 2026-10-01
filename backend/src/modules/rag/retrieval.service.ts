import { createHash } from 'node:crypto';
import { logger } from '../../config/logger.js';
import { cosineSimilarity, getEmbeddingService } from './embedding.service.js';
import { getKnowledgeRepository } from './knowledge-base.service.js';
import { getRagConfig } from './rag.config.js';
import type { RetrievedChunk, RetrievalOptions } from './rag.types.js';

// Dedicated retrieval: embed query -> similarity search -> metadata filters ->
// hybrid keyword boost -> dedupe -> topK structured context. Never returns
// the whole knowledge base. Retrieval results cache only public KB chunks
// (never user resume data).

interface CacheEntry {
  expiresAt: number;
  chunks: RetrievedChunk[];
}

const retrievalCache = new Map<string, CacheEntry>();

export function clearRetrievalCache(): void {
  retrievalCache.clear();
}

function tokenize(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9+#.]+/).filter((t) => t.length > 2);
}

function keywordScore(query: string, content: string): number {
  const queryTokens = new Set(tokenize(query));
  if (queryTokens.size === 0) return 0;
  const contentTokens = new Set(tokenize(content));
  let hits = 0;
  for (const t of queryTokens) if (contentTokens.has(t)) hits++;
  return hits / queryTokens.size;
}

export function normalizeRole(role: string | null | undefined): string | null {
  if (!role) return null;
  const n = role.toLowerCase().replace(/[\s-]+/g, '_');
  return n || null;
}

export class RagRetrievalService {
  async retrieve(options: RetrievalOptions): Promise<RetrievedChunk[]> {
    const config = getRagConfig();
    const topK = Math.min(Math.max(options.topK ?? config.topK, 1), 20);
    const threshold = config.similarityThreshold;
    const role = normalizeRole(options.role);

    const cacheKey = createHash('sha256')
      .update(JSON.stringify({ q: options.query, role, c: options.categories ?? null, topK }))
      .digest('hex');
    const cached = retrievalCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.chunks;

    const embeddingService = getEmbeddingService();
    let queryEmbedding: number[];
    try {
      queryEmbedding = await embeddingService.generateEmbedding(options.query);
    } catch (err) {
      logger.warn({ err }, 'RAG query embedding failed; returning empty context');
      return [];
    }

    let candidates: Awaited<ReturnType<ReturnType<typeof getKnowledgeRepository>['listChunks']>>;
    try {
      candidates = await getKnowledgeRepository().listChunks({
        categories: options.categories,
        role,
        limit: 500,
      });
    } catch (err) {
      logger.warn({ err }, 'RAG knowledge store unavailable; returning empty context');
      return [];
    }

    const scored: RetrievedChunk[] = [];
    for (const c of candidates) {
      if (!c.embedding || c.embedding.length !== queryEmbedding.length) continue;
      const similarity = cosineSimilarity(queryEmbedding, c.embedding);
      const kw = keywordScore(options.query, c.content);
      // Hybrid: semantic similarity dominates, keyword overlap boosts, exact
      // role match boosts. Weights are fixed and documented.
      const roleBoost = role && c.role === role ? 0.08 : 0;
      const combined = similarity * 0.7 + kw * 0.3 + roleBoost;
      if (similarity < threshold && kw < 0.15) continue;
      scored.push({
        id: c.id,
        documentId: c.documentId,
        content: c.content,
        category: c.category,
        subcategory: c.subcategory,
        role: c.role,
        source: c.source,
        version: c.version,
        chunkIndex: c.chunkIndex,
        similarity,
        keywordScore: kw,
        combinedScore: combined,
      });
    }

    scored.sort((a, b) => b.combinedScore - a.combinedScore);

    // Redundancy removal: drop near-duplicate contents
    const deduped: RetrievedChunk[] = [];
    const seenHashes = new Set<string>();
    for (const s of scored) {
      const h = createHash('sha256').update(s.content.toLowerCase().slice(0, 200)).digest('hex');
      if (seenHashes.has(h)) continue;
      seenHashes.add(h);
      deduped.push(s);
      if (deduped.length >= topK) break;
    }

    retrievalCache.set(cacheKey, { expiresAt: Date.now() + config.retrievalCacheTtlMs, chunks: deduped });
    if (retrievalCache.size > 200) {
      const first = retrievalCache.keys().next();
      if (!first.done) retrievalCache.delete(first.value);
    }
    return deduped;
  }

  /** Targeted multi-query retrieval for one analysis; results merged + deduped. */
  async retrieveForAnalysis(queries: string[], options: Omit<RetrievalOptions, 'query'>): Promise<RetrievedChunk[]> {
    const config = getRagConfig();
    const perQuery = Math.max(2, Math.ceil(config.topK / Math.max(queries.length, 1)) + 1);
    const merged = new Map<string, RetrievedChunk>();
    for (const q of queries) {
      const chunks = await this.retrieve({ ...options, query: q, topK: perQuery });
      for (const c of chunks) {
        const existing = merged.get(c.id);
        if (!existing || existing.combinedScore < c.combinedScore) merged.set(c.id, c);
      }
    }
    return [...merged.values()].sort((a, b) => b.combinedScore - a.combinedScore).slice(0, config.topK + 2);
  }
}

export const ragRetrievalService = new RagRetrievalService();
