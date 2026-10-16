import { logger } from '../../config/logger.js';
import type { IModelAdapter } from '../core/model.adapter.js';
import { ModelInferenceError, ModelInitializationError } from '../core/model.errors.js';
import type {
  InferenceOptions,
  ModelHandle,
  ModelHealth,
  ModelInput,
  ModelLoadContext,
  ModelManifest,
  ModelOutput,
} from '../core/model.types.js';

export class SentenceTransformersAdapter implements IModelAdapter {
  readonly library = 'sentence-transformers';

  canHandle(manifest: ModelManifest): boolean {
    return manifest.architecture.library === 'sentence-transformers';
  }

  async validate(manifest: ModelManifest): Promise<void> {
    if (!manifest.hub.modelId) {
      throw new Error(`Sentence-transformers manifest '${manifest.id}' missing hub modelId`);
    }
  }

  async load(manifest: ModelManifest, context: ModelLoadContext): Promise<ModelHandle> {
    await this.validate(manifest);

    try {
      const { pipeline } = await import('@huggingface/transformers');
      const isQuantized = context.quantization ? context.quantization !== 'fp32' : manifest.capabilities.quantization;

      logger.info(
        { modelId: manifest.hub.modelId, quantized: isQuantized },
        'Loading Sentence Transformers feature-extraction pipeline...',
      );

      // transformers.js v3 selects weights via `dtype` (see transformers.adapter).
      const extractor = await pipeline('feature-extraction', manifest.hub.modelId, {
        dtype: isQuantized ? 'q8' : 'fp32',
        device: 'cpu',
        revision: manifest.hub.revision || 'main',
      } as Record<string, unknown>);

      const handle: ModelHandle = {
        id: manifest.id,
        manifest,
        instance: extractor,
        loadedAt: new Date(),
        device: context.device || 'cpu',
        dtype: context.dtype || 'fp32',
        quantization: isQuantized ? 'q4' : 'fp32',
        predict: async (input: ModelInput, options?: InferenceOptions) => {
          return this.predict(handle, input, options);
        },
        unload: async () => {
          await this.unload(handle);
        },
        healthCheck: async () => {
          return this.healthCheck(handle);
        },
      };

      return handle;
    } catch (error) {
      logger.error({ modelId: manifest.id, error }, 'Failed to initialize Sentence Transformers pipeline');
      throw new ModelInitializationError(manifest.id, error);
    }
  }

  async unload(handle: ModelHandle): Promise<void> {
    logger.info({ modelId: handle.id }, 'Unloading Sentence Transformers instance');
    handle.instance = null;
  }

  async predict(
    handle: ModelHandle,
    input: ModelInput,
    _options?: InferenceOptions,
  ): Promise<ModelOutput> {
    const startTime = Date.now();
    try {
      const runner = handle.instance as (
        input: unknown,
        opts?: Record<string, unknown>,
      ) => Promise<unknown>;

      if (!runner) {
        throw new Error(`Pipeline instance '${handle.id}' is not loaded`);
      }

      const inputTexts = input.texts || [input.text || input.prompt || ''];
      const rawResult = await runner(inputTexts.length === 1 ? inputTexts[0] : inputTexts, {
        pooling: 'mean',
        normalize: true,
      });

      const latencyMs = Date.now() - startTime;
      let embedding: number[] | undefined;
      let embeddings: number[][] | undefined;

      if (rawResult && typeof rawResult === 'object' && 'tolist' in rawResult) {
        const list = (rawResult as { tolist: () => unknown }).tolist();
        if (Array.isArray(list)) {
          if (Array.isArray(list[0])) {
            embeddings = list as number[][];
            embedding = list[0] as number[];
          } else {
            embedding = list as number[];
            embeddings = [embedding];
          }
        }
      }

      return {
        raw: rawResult,
        embedding,
        embeddings,
        latencyMs,
        modelId: handle.id,
        device: handle.device,
      };
    } catch (error) {
      logger.error({ modelId: handle.id, error }, 'Sentence Transformers embedding inference failed');
      throw new ModelInferenceError(handle.id, error);
    }
  }

  async healthCheck(handle: ModelHandle): Promise<ModelHealth> {
    const startTime = Date.now();
    try {
      if (!handle.instance) {
        return {
          modelId: handle.id,
          status: 'Unavailable',
          lastCheckedAt: new Date().toISOString(),
          error: 'Instance not loaded',
        };
      }

      const res = await this.predict(handle, { text: 'Health check embedding' });
      const latencyMs = Date.now() - startTime;

      return {
        modelId: handle.id,
        status: 'Healthy',
        latencyMs,
        lastCheckedAt: new Date().toISOString(),
        details: { dimension: res.embedding?.length || 384 },
      };
    } catch (error) {
      return {
        modelId: handle.id,
        status: 'Degraded',
        lastCheckedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

export const sentenceTransformersAdapter = new SentenceTransformersAdapter();
