import { afterEach, describe, expect, it } from 'vitest';
import { KnowledgeBaseService, setKnowledgeRepository } from './knowledge-base.service.js';
import { clearRetrievalCache, ragRetrievalService } from './retrieval.service.js';

async function seedMemory(): Promise<void> {
  const repo = await KnowledgeBaseService.buildInMemorySeeded();
  setKnowledgeRepository(repo);
  clearRetrievalCache();
}

afterEach(() => {
  setKnowledgeRepository(null);
  clearRetrievalCache();
});

describe('RAG retrieval', () => {
  it('performs similarity search and returns top-K structured context', async () => {
    await seedMemory();
    const results = await ragRetrievalService.retrieve({
      query: 'ATS keyword optimization skills section placement',
      topK: 3,
    });
    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBeLessThanOrEqual(3);
    for (const r of results) {
      expect(r.content.length).toBeGreaterThan(0);
      expect(r.similarity).toBeGreaterThanOrEqual(0);
      expect(typeof r.combinedScore).toBe('number');
    }
    // Sorted best-first
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1]!.combinedScore).toBeGreaterThanOrEqual(results[i]!.combinedScore);
    }
  }, 60000);

  it('applies role filtering', async () => {
    await seedMemory();
    const results = await ragRetrievalService.retrieve({
      query: 'backend API development experience evaluation',
      role: 'backend_developer',
      topK: 5,
    });
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      expect(r.role === 'backend_developer' || r.role === null).toBe(true);
    }
    expect(results.some((r) => r.role === 'backend_developer')).toBe(true);
  }, 60000);

  it('applies category filtering', async () => {
    await seedMemory();
    const results = await ragRetrievalService.retrieve({
      query: 'resume writing bullets',
      categories: ['ats'],
      topK: 5,
    });
    for (const r of results) expect(r.category).toBe('ats');
  }, 60000);

  it('returns empty results when nothing can match', async () => {
    await seedMemory();
    const results = await ragRetrievalService.retrieve({
      query: 'anything',
      categories: ['nonexistent_category'],
      topK: 5,
    });
    expect(results).toEqual([]);
  }, 60000);

  it('prefers semantically and lexically relevant chunks over unrelated ones', async () => {
    await seedMemory();
    const results = await ragRetrievalService.retrieve({
      query: 'Evaluate backend experience with Node.js Express REST APIs against job requirements',
      role: 'backend_developer',
      topK: 5,
    });
    expect(results.length).toBeGreaterThan(0);
    const topText = results.slice(0, 2).map((r) => `${r.category} ${r.subcategory ?? ''} ${r.role ?? ''} ${r.content}`.toLowerCase()).join(' ');
    expect(topText.includes('backend') || topText.includes('api') || topText.includes('experience')).toBe(true);
  }, 60000);

  it('merges multi-query retrieval without duplicates', async () => {
    await seedMemory();
    const results = await ragRetrievalService.retrieveForAnalysis(
      ['Are resume bullets achievement-oriented?', 'Which missing skills matter most?'],
      { role: 'full_stack_developer' },
    );
    const ids = results.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(results.length).toBeLessThanOrEqual(7);
  }, 60000);
});
