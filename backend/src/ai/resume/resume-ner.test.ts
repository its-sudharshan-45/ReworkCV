// cspell:ignore huggingface
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { chunkResumeText, extractRawEntities, getResumeNER, resetResumeNERPipeline } from './resume-ner.js';

vi.mock('@huggingface/transformers', () => {
  const mockNer = vi.fn().mockImplementation(async (text: string) => {
    if (text.includes('John Doe')) {
      return [
        { entity: 'B-NAME', word: 'John', score: 0.99, index: 1 },
        { entity: 'I-NAME', word: 'Doe', score: 0.98, index: 2 },
        { entity: 'B-EMAIL', word: 'john@example.com', score: 0.95, index: 3 },
        { entity: 'B-SKILL', word: 'Java', score: 0.92, index: 4 },
        { entity: 'B-SKILL', word: 'React', score: 0.94, index: 5 },
      ];
    }
    return [];
  });

  return {
    env: { cacheDir: '' },
    pipeline: vi.fn().mockResolvedValue(mockNer),
  };
});

describe('Hugging Face Resume NER', () => {
  beforeEach(() => {
    resetResumeNERPipeline();
  });

  it('initializes as a singleton and reuses the pipeline', async () => {
    const pipeline1 = getResumeNER();
    const pipeline2 = getResumeNER();
    expect(pipeline1).toBe(pipeline2);

    const resolved = await pipeline1;
    expect(resolved).toBeDefined();
  });

  it('reuses one loaded pipeline across repeated analyses (no per-request reload)', async () => {
    const { pipeline } = await import('@huggingface/transformers');
    vi.mocked(pipeline).mockClear();
    await extractRawEntities('John Doe john@example.com Skills: Java React');
    await extractRawEntities('John Doe john@example.com Skills: Java React');
    // One model load for any number of sequential analyses; each analysis
    // only pays for chunked inference, never a second 261MB weight load.
    expect(vi.mocked(pipeline)).toHaveBeenCalledTimes(1);
  });

  it('chunks long resume text into 512-token compatible blocks', () => {
    const longText = Array(400).fill('word').join(' ') + '\n\n' + Array(200).fill('test').join(' ');
    const chunks = chunkResumeText(longText, 300);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].split(/\s+/).length).toBeLessThanOrEqual(300);
  });

  it('extracts raw entities from sample text', async () => {
    const entities = await extractRawEntities('John Doe john@example.com Skills: Java React');

    expect(entities.length).toBeGreaterThan(0);
    expect(entities[0].entity).toBe('B-NAME');
    expect(entities[0].word).toBe('John');
  });

  it('returns empty array when text is empty', async () => {
    const entities = await extractRawEntities('');
    expect(entities).toEqual([]);
  });
});
