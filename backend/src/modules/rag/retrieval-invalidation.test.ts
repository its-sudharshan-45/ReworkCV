import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import {
  KnowledgeBaseService,
  setKnowledgeRepository,
} from './knowledge-base.service.js';
import { InMemoryKnowledgeRepository } from './knowledge.repository.js';
import { clearRetrievalCache, ragRetrievalService } from './retrieval.service.js';

// ---------------------------------------------------------------------------
// Retrieval-cache correctness + admin fail-closed behavior.
//
// The retrieval cache is process-local (single-replica deployment constraint,
// see docs/deployment.md). Knowledge mutations must invalidate it or readers
// see stale chunks until TTL expiry. The controller calls
// clearRetrievalCache() after ingest/reindex/delete; these tests pin the
// contract: staleness without clearing, freshness after clearing, and 403
// fail-closed admin endpoints when no admin key is configured (test env).
// ---------------------------------------------------------------------------

describe('Retrieval cache invalidation', () => {
  beforeEach(() => {
    clearRetrievalCache();
    setKnowledgeRepository(new InMemoryKnowledgeRepository());
  });

  afterEach(() => {
    setKnowledgeRepository(null);
    clearRetrievalCache();
  });

  it('serves stale results until the cache is cleared after ingest', async () => {
    const query = { query: 'quantum zebra resume summaries', topK: 3 };

    const before = await ragRetrievalService.retrieve(query);
    expect(before).toEqual([]);

    const repo = new InMemoryKnowledgeRepository();
    setKnowledgeRepository(repo);
    const service = new KnowledgeBaseService(repo);
    const result = await service.ingestDocument({
      title: 'Zebra Doc',
      content:
        'Quantum zebra resume summaries should be two sentences tailored to the target role. '.repeat(5),
      category: 'resume_fundamentals',
      source: 'test-zebra',
      version: 'v1',
    });
    expect(result.skippedAsDuplicate).toBe(false);

    // Cache still holds the pre-ingest empty result: stale by design.
    const stale = await ragRetrievalService.retrieve(query);
    expect(stale).toEqual([]);

    // This is exactly what the mutation controllers do after a real ingest.
    clearRetrievalCache();
    const fresh = await ragRetrievalService.retrieve(query);
    expect(fresh.length).toBeGreaterThan(0);
    expect(fresh[0]?.content).toContain('zebra');
  });

  it('duplicate ingests skip re-embedding (no invalidation needed)', async () => {
    const repo = new InMemoryKnowledgeRepository();
    const service = new KnowledgeBaseService(repo);
    const input = {
      title: 'Dup Doc',
      content: 'Achievement-oriented bullets state what was done and what changed. '.repeat(5),
      category: 'resume_fundamentals' as const,
      source: 'test-dup',
      version: 'v1',
    };
    const first = await service.ingestDocument(input);
    const second = await service.ingestDocument(input);
    expect(first.skippedAsDuplicate).toBe(false);
    expect(second.skippedAsDuplicate).toBe(true);
  });
});

describe('RAG admin endpoints fail closed without a configured key', () => {
  const app = createApp();

  it('rejects ingest without admin configuration', async () => {
    const res = await request(app).post('/api/v1/rag/ingest').send({});
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('AUTHORIZATION_ERROR');
  });

  it('rejects reindex without admin configuration', async () => {
    const res = await request(app).post('/api/v1/rag/reindex').send({});
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('AUTHORIZATION_ERROR');
  });

  it('rejects document deletion without admin configuration', async () => {
    const res = await request(app).delete('/api/v1/rag/documents/some-id').send();
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('AUTHORIZATION_ERROR');
  });
});
