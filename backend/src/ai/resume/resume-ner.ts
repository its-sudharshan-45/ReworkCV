// cspell:ignore huggingface oksomu
import { env as hfEnv } from '@huggingface/transformers';
import path from 'node:path';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { AppError } from '../../utils/errors.js';
import { modelFactory } from '../factory/model-factory.js';
import { BatchingEngine } from '../runtime/batching-engine.js';
import type { RawNEREntity } from './resume-types.js';

// Configure Hugging Face persistent cache directory
hfEnv.cacheDir = path.resolve(process.cwd(), env.HF_CACHE_DIR);

let nerPipelinePromise: Promise<unknown> | null = null;

/**
 * Returns the singleton Hugging Face token-classification pipeline for oksomu/resume-ner.
 * Protects against concurrent initialization race conditions using ModelFactory.
 */
export function getResumeNER(): Promise<unknown> {
  if (!nerPipelinePromise) {
    nerPipelinePromise = (async () => {
      logger.info({ model: 'oksomu/resume-ner' }, 'Initializing Hugging Face Resume NER pipeline via ModelFactory...');
      try {
        const handle = await modelFactory.load('resume-ner');
        const mem = process.memoryUsage();
        logger.info(
          {
            model: 'oksomu/resume-ner',
            rssMB: Math.round(mem.rss / 1048576),
            heapUsedMB: Math.round(mem.heapUsed / 1048576),
          },
          'Hugging Face Resume NER pipeline initialized successfully via ModelFactory.',
        );
        return handle.instance;
      } catch (error) {
        nerPipelinePromise = null;
        logger.error({ error }, 'Failed to initialize Hugging Face Resume NER model');
        throw new AppError(
          'Resume analysis model could not be initialized',
          500,
          'EXTERNAL_SERVICE_ERROR',
        );
      }
    })();
  }

  return nerPipelinePromise;
}

/**
 * Reset pipeline cache (useful for testing and retry logic).
 */
export function resetResumeNERPipeline(): void {
  nerPipelinePromise = null;
  modelFactory.unload('resume-ner').catch(() => {});
}

/**
 * Chunks resume text into 512-token-compatible blocks.
 * Uses a safe word count threshold (~300 words per chunk).
 */
export function chunkResumeText(text: string, maxWordsPerChunk = 300): string[] {
  return BatchingEngine.chunkText(text, maxWordsPerChunk);
}

/**
 * Executes NER inference over all chunks of text and collects raw entities.
 */
export async function extractRawEntities(text: string): Promise<RawNEREntity[]> {
  if (!text || !text.trim()) {
    return [];
  }

  const chunks = chunkResumeText(text);
  if (chunks.length === 0) {
    return [];
  }

  let nerRunner: ((chunk: string) => Promise<unknown>) | null = null;
  try {
    nerRunner = (await getResumeNER()) as (chunk: string) => Promise<unknown>;
  } catch (error) {
    logger.warn({ error }, 'NER pipeline unavailable, proceeding with regex extraction fallback');
    return [];
  }

  const allEntities: RawNEREntity[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    try {
      const results = await nerRunner(chunk);
      if (Array.isArray(results)) {
        for (const item of results) {
          allEntities.push({
            entity: item.entity || item.entity_group || '',
            score: typeof item.score === 'number' ? item.score : 1.0,
            index: typeof item.index === 'number' ? item.index : 0,
            word: item.word || item.text || '',
            start: item.start,
            end: item.end,
          });
        }
      }
    } catch (error) {
      logger.error({ chunkIndex: i, error }, 'Error during NER inference on chunk');
      throw new AppError('Resume analysis failed during entity extraction', 500, 'INTERNAL_SERVER_ERROR');
    }
  }

  return allEntities;
}
