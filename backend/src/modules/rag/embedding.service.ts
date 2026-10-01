import { createHash } from 'node:crypto';
import type { EmbeddingService } from './rag.types.js';
import { getRagConfig } from './rag.config.js';

// ---------------------------------------------------------------------------
// Local deterministic hash embedding (default).
//
// Offline-safe, dependency-free, L2-normalized. It captures lexical overlap
// well enough for hybrid retrieval (vector similarity + keyword matching +
// metadata filtering) without coupling the architecture to a paid API.
// Replaceable via EmbeddingService / EMBEDDING_PROVIDER=transformers.
// ---------------------------------------------------------------------------

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9+#./]+/g)
    .map((t) => t.trim())
    .filter((t) => t.length > 1);
}

function hashToIndex(token: string, dimensions: number): number {
  const digest = createHash('sha256').update(token).digest();
  return digest.readUInt32BE(0) % dimensions;
}

export function hashEmbed(text: string, dimensions: number): number[] {
  const vec = new Array<number>(dimensions).fill(0);
  const tokens = tokenize(text);
  if (tokens.length === 0) {
    vec[0] = 1;
    return vec;
  }
  for (const token of tokens) {
    // Unigram + char-bigram features for robustness to morphological variants
    const features = [token];
    for (let i = 0; i < token.length - 1; i++) {
      features.push(`bg:${token.slice(i, i + 2)}`);
    }
    for (const feature of features) {
      const idx = hashToIndex(feature, dimensions);
      vec[idx] += feature.startsWith('bg:') ? 0.3 : 1;
    }
  }
  // L2 normalize so cosine similarity is a pure dot product
  let norm = 0;
  for (const v of vec) norm += v * v;
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < vec.length; i++) vec[i] /= norm;
  return vec;
}

export class HashEmbeddingService implements EmbeddingService {
  readonly provider = 'hash';
  readonly dimensions: number;
  private readonly cache = new Map<string, number[]>();
  private hits = 0;
  private misses = 0;

  constructor(dimensions?: number) {
    this.dimensions = dimensions ?? getRagConfig().embeddingDimensions;
  }

  private cacheKey(text: string): string {
    return createHash('sha256').update(text).digest('hex');
  }

  async generateEmbedding(text: string): Promise<number[]> {
    if (typeof text !== 'string' || text.trim().length === 0) {
      throw new Error('Embedding input must be a non-empty string');
    }
    const key = this.cacheKey(text);
    const cached = this.cache.get(key);
    if (cached) {
      this.hits++;
      return [...cached];
    }
    this.misses++;
    const vec = hashEmbed(text, this.dimensions);
    // Bound cache: knowledge + repeated queries only, never user PII keyed raw
    if (this.cache.size < 5000) this.cache.set(key, vec);
    return [...vec];
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (!Array.isArray(texts) || texts.length === 0) {
      throw new Error('Embedding batch input must be a non-empty array');
    }
    const out: number[][] = [];
    for (const t of texts) out.push(await this.generateEmbedding(t));
    return out;
  }

  getCacheStats(): { hits: number; misses: number; size: number } {
    return { hits: this.hits, misses: this.misses, size: this.cache.size };
  }

  clearCache(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }
}

// ---------------------------------------------------------------------------
// Optional Hugging Face transformers embedding (open-source, local).
// Lazily loaded; falls back to hash embeddings when the model is unavailable
// (offline CI, missing cache). Keeps the architecture provider-agnostic.
// ---------------------------------------------------------------------------

export class TransformersEmbeddingService implements EmbeddingService {
  readonly provider = 'transformers';
  readonly dimensions: number;
  private readonly fallback: HashEmbeddingService;
  private pipelinePromise: Promise<unknown> | null = null;
  private warned = false;

  constructor(dimensions?: number) {
    this.dimensions = dimensions ?? getRagConfig().embeddingDimensions;
    this.fallback = new HashEmbeddingService(this.dimensions);
  }

  private loadPipeline(): Promise<unknown> {
    if (!this.pipelinePromise) {
      this.pipelinePromise = (async () => {
        const mod = await import('@huggingface/transformers');
        const pipeline = (mod as unknown as { pipeline: (...args: unknown[]) => Promise<unknown> }).pipeline;
        return pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
          dtype: 'fp32',
        });
      })();
    }
    return this.pipelinePromise;
  }

  private toFixedDim(values: number[]): number[] {
    const { dimensions } = this;
    let vec = values.slice(0, dimensions);
    if (vec.length < dimensions) vec = vec.concat(new Array(dimensions - vec.length).fill(0));
    let norm = 0;
    for (const v of vec) norm += v * v;
    norm = Math.sqrt(norm) || 1;
    return vec.map((v) => v / norm);
  }

  async generateEmbedding(text: string): Promise<number[]> {
    if (typeof text !== 'string' || text.trim().length === 0) {
      throw new Error('Embedding input must be a non-empty string');
    }
    try {
      const pipe = (await this.loadPipeline()) as (t: string, o: unknown) => Promise<{ data: number[] | Float32Array; tolist?: () => number[] }>;
      const out = await pipe(text.slice(0, 2000), { pooling: 'mean', normalize: true });
      const arr = Array.from(typeof out.tolist === 'function' ? out.tolist() : (out.data as number[]));
      return this.toFixedDim(arr);
    } catch {
      if (!this.warned) {
        this.warned = true;
      }
      return this.fallback.generateEmbedding(text);
    }
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (!Array.isArray(texts) || texts.length === 0) {
      throw new Error('Embedding batch input must be a non-empty array');
    }
    const out: number[][] = [];
    for (const t of texts) out.push(await this.generateEmbedding(t));
    return out;
  }
}

let singleton: EmbeddingService | null = null;

export function getEmbeddingService(): EmbeddingService {
  if (!singleton) {
    const { embeddingProvider, embeddingDimensions } = getRagConfig();
    singleton =
      embeddingProvider === 'transformers'
        ? new TransformersEmbeddingService(embeddingDimensions)
        : new HashEmbeddingService(embeddingDimensions);
  }
  return singleton;
}

/** Test helper: reset the process-wide singleton. */
export function resetEmbeddingService(): void {
  singleton = null;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
