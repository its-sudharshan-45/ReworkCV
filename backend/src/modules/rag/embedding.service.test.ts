import { describe, expect, it } from 'vitest';
import {
  HashEmbeddingService,
  cosineSimilarity,
  hashEmbed,
} from './embedding.service.js';

describe('HashEmbeddingService', () => {
  it('generates a normalized embedding of the configured dimensions', async () => {
    const service = new HashEmbeddingService(384);
    const vec = await service.generateEmbedding('ATS keyword optimization for backend resumes');
    expect(vec).toHaveLength(384);
    const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
    expect(norm).toBeCloseTo(1, 5);
  });

  it('is deterministic for identical input', async () => {
    const service = new HashEmbeddingService(64);
    const a = await service.generateEmbedding('Built REST APIs using Node.js and Express');
    const b = await service.generateEmbedding('Built REST APIs using Node.js and Express');
    expect(a).toEqual(b);
  });

  it('produces similar vectors for overlapping text and dissimilar for unrelated text', async () => {
    const service = new HashEmbeddingService(384);
    const base = await service.generateEmbedding('Built REST APIs using Node.js and Express with PostgreSQL');
    const related = await service.generateEmbedding('Node.js Express REST API development with PostgreSQL database');
    const unrelated = await service.generateEmbedding('Watercolor painting techniques for landscapes');
    expect(cosineSimilarity(base, related)).toBeGreaterThan(cosineSimilarity(base, unrelated));
  });

  it('supports batch embedding with one vector per input', async () => {
    const service = new HashEmbeddingService(32);
    const vecs = await service.generateEmbeddings(['one', 'two', 'three']);
    expect(vecs).toHaveLength(3);
    for (const v of vecs) expect(v).toHaveLength(32);
  });

  it('caches repeated queries instead of recomputing', async () => {
    const service = new HashEmbeddingService(32);
    await service.generateEmbedding('cache me');
    await service.generateEmbedding('cache me');
    const stats = service.getCacheStats();
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(1);
  });

  it('rejects invalid input', async () => {
    const service = new HashEmbeddingService(32);
    await expect(service.generateEmbedding('')).rejects.toThrow();
    await expect(service.generateEmbedding('   ')).rejects.toThrow();
    await expect(service.generateEmbeddings([])).rejects.toThrow();
  });

  it('hashEmbed handles empty text without NaN', () => {
    const vec = hashEmbed('', 16);
    expect(vec).toHaveLength(16);
    expect(vec.every((v) => Number.isFinite(v))).toBe(true);
  });

  it('cosineSimilarity guards mismatched and empty vectors', () => {
    expect(cosineSimilarity([], [])).toBe(0);
    expect(cosineSimilarity([1, 0], [1])).toBe(0);
    expect(cosineSimilarity([0, 0], [0, 0])).toBe(0);
  });
});
