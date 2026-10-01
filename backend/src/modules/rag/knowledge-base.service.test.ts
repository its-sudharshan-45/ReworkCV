import { describe, expect, it } from 'vitest';
import { chunkText, cleanText } from './chunking.service.js';
import { KnowledgeBaseService, hashContent } from './knowledge-base.service.js';
import { InMemoryKnowledgeRepository } from './knowledge.repository.js';

describe('chunking', () => {
  it('returns no chunks for empty input', () => {
    expect(chunkText('   \n  ')).toEqual([]);
  });

  it('keeps short documents as a single chunk', () => {
    const chunks = chunkText('A concise paragraph about resume summaries.');
    expect(chunks).toHaveLength(1);
  });

  it('splits long documents with overlap and preserves order', () => {
    const para = 'Achievement-oriented bullets state what was done, how, and what changed for the team. ';
    const long = Array.from({ length: 30 }, (_, i) => `Paragraph ${i}: ${para.repeat(4)}`).join('\n\n');
    const chunks = chunkText(long, { chunkSize: 800, chunkOverlap: 100 });
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(1700);
    expect(chunks[0]).toContain('Paragraph 0');
  });

  it('removes duplicate content', () => {
    const dup = 'Identical guidance paragraph about ATS parsing principles. '.repeat(10);
    const chunks = chunkText(`${dup}\n\n${dup}`, { chunkSize: 800, chunkOverlap: 0 });
    const unique = new Set(chunks.map((c) => c.toLowerCase()));
    expect(unique.size).toBe(chunks.length);
  });

  it('normalizes whitespace', () => {
    expect(cleanText('a\t\tb\r\n\r\n\nc')).toBe('a b\n\nc');
  });
});

describe('ingestion pipeline', () => {
  it('ingests, detects duplicates, and supports re-index replacement', async () => {
    const repo = new InMemoryKnowledgeRepository();
    const service = new KnowledgeBaseService(repo);

    const first = await service.ingestDocument({
      title: 'Test Doc',
      content: 'Resume summaries should be two to three sentences tailored to the target role.',
      category: 'resume_fundamentals',
      source: 'test-source',
      version: 'v1',
    });
    expect(first.chunkCount).toBeGreaterThan(0);
    expect(first.skippedAsDuplicate).toBe(false);

    const second = await service.ingestDocument({
      title: 'Test Doc',
      content: 'Resume summaries should be two to three sentences tailored to the target role.',
      category: 'resume_fundamentals',
      source: 'test-source',
      version: 'v1',
    });
    expect(second.skippedAsDuplicate).toBe(true);

    const countBefore = await repo.countChunks();
    await service.ingestDocument({
      title: 'Test Doc',
      content: 'Completely replaced content about STAR bullet construction and quantification.',
      category: 'resume_writing',
      source: 'test-source',
      version: 'v1',
    });
    expect(await repo.countChunks()).toBeLessThanOrEqual(countBefore);

    expect(await service.deleteDocument(first.documentId)).toBe(true);
    expect(await repo.countChunks()).toBe(0);
  });

  it('hashes cleaned content deterministically', () => {
    expect(hashContent('a  b')).toBe(hashContent('a b'));
  });

  it('ingests the full seed corpus into memory', async () => {
    const repo = await KnowledgeBaseService.buildInMemorySeeded();
    const chunks = await repo.listChunks({ limit: 5000 });
    expect(chunks.length).toBeGreaterThan(30);
    const categories = new Set(chunks.map((c) => c.category));
    expect(categories.has('ats')).toBe(true);
    expect(categories.has('resume_writing')).toBe(true);
    expect(categories.has('role_guidance')).toBe(true);
    const roles = new Set(chunks.map((c) => c.role).filter(Boolean));
    expect(roles.size).toBeGreaterThanOrEqual(13);
  }, 60000);
});
