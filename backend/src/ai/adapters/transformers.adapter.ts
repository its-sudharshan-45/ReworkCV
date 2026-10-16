import path from 'node:path';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import type { IModelAdapter } from '../core/model.adapter.js';
import {
  ModelInferenceError,
  ModelInitializationError,
} from '../core/model.errors.js';
import type {
  InferenceOptions,
  ModelHandle,
  ModelHealth,
  ModelInput,
  ModelLoadContext,
  ModelManifest,
  ModelOutput,
} from '../core/model.types.js';

export class TransformersAdapter implements IModelAdapter {
  readonly library = 'transformers';

  canHandle(manifest: ModelManifest): boolean {
    return manifest.architecture.library === 'transformers';
  }

  async validate(manifest: ModelManifest): Promise<void> {
    if (!manifest.hub.modelId) {
      throw new Error(`Transformers manifest '${manifest.id}' missing hub modelId`);
    }
  }

  async load(manifest: ModelManifest, context: ModelLoadContext): Promise<ModelHandle> {
    await this.validate(manifest);

    try {
      const { env: hfEnv, pipeline } = await import('@huggingface/transformers');

      // Configure persistent cache directory
      const cacheDir = context.cacheDir || env.HF_CACHE_DIR || '.cache/huggingface';
      hfEnv.cacheDir = path.resolve(process.cwd(), cacheDir);

      if (context.authToken || env.HF_TOKEN) {
        // HF Token if configured
        (hfEnv as unknown as { token?: string }).token = context.authToken || env.HF_TOKEN;
      }

      const task = manifest.architecture.task;
      const isQuantized = context.quantization ? context.quantization !== 'fp32' : manifest.capabilities.quantization;

      logger.info(
        { modelId: manifest.hub.modelId, task, quantized: isQuantized, device: context.device || 'cpu' },
        'Loading Hugging Face Transformers model pipeline...',
      );

      // transformers.js v3 selects the weight file from `dtype` (not the
      // legacy v2 `quantized` flag): dtype 'q8' loads `model_quantized.onnx`
      // (~66MB for resume-ner) while the default fp32 loads `model.onnx`
      // (~261MB) and OOMs a 512MB instance once request buffers are added.
      const pipelineInstance = await pipeline(task as Parameters<typeof pipeline>[0], manifest.hub.modelId, {
        dtype: isQuantized ? 'q8' : 'fp32',
        device: 'cpu',
        revision: manifest.hub.revision || 'main',
      } as Record<string, unknown>);

      logger.info({ modelId: manifest.id }, 'Transformers pipeline loaded successfully.');

      const handle: ModelHandle = {
        id: manifest.id,
        manifest,
        instance: pipelineInstance,
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
      logger.error({ modelId: manifest.id, error }, 'Failed to initialize Transformers pipeline');
      throw new ModelInitializationError(manifest.id, error);
    }
  }

  async unload(handle: ModelHandle): Promise<void> {
    logger.info({ modelId: handle.id }, 'Unloading Transformers pipeline instance');
    handle.instance = null;
  }

  async predict(
    handle: ModelHandle,
    input: ModelInput,
    options?: InferenceOptions,
  ): Promise<ModelOutput> {
    const startTime = Date.now();
    try {
      const runner = handle.instance as (
        input: unknown,
        opts?: Record<string, unknown>,
      ) => Promise<unknown>;

      if (!runner || typeof runner !== 'function') {
        throw new Error(`Model pipeline instance '${handle.id}' is not callable or unloaded`);
      }

      const inputText = input.text || input.prompt || (input.texts ? input.texts.join('\n') : '');
      const rawResult = await runner(inputText, {
        temperature: options?.temperature,
        max_new_tokens: options?.maxTokens,
      });

      const latencyMs = Date.now() - startTime;

      if (handle.manifest.architecture.task === 'token-classification') {
        const entities: Array<{
          entity: string;
          score: number;
          word: string;
          start?: number;
          end?: number;
          index?: number;
        }> = [];

        if (Array.isArray(rawResult)) {
          for (const item of rawResult) {
            entities.push({
              entity: item.entity || item.entity_group || '',
              score: typeof item.score === 'number' ? item.score : 1.0,
              word: item.word || item.text || '',
              start: item.start,
              end: item.end,
              index: item.index,
            });
          }
        }

        return {
          raw: rawResult,
          entities,
          latencyMs,
          modelId: handle.id,
          device: handle.device,
        };
      }

      return {
        raw: rawResult,
        text: typeof rawResult === 'string' ? rawResult : JSON.stringify(rawResult),
        latencyMs,
        modelId: handle.id,
        device: handle.device,
      };
    } catch (error) {
      logger.error({ modelId: handle.id, error }, 'Transformers inference execution failed');
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
          error: 'Instance is not loaded',
        };
      }

      // Quick smoke test prediction
      const smokeResult = await this.predict(handle, { text: 'Test text' });
      const latencyMs = Date.now() - startTime;

      return {
        modelId: handle.id,
        status: 'Healthy',
        latencyMs,
        lastCheckedAt: new Date().toISOString(),
        details: { device: handle.device, outputSampleCount: smokeResult.entities?.length ?? 1 },
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

export const transformersAdapter = new TransformersAdapter();
