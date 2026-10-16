import { describe, expect, it, vi } from 'vitest';

const pipelineMock = vi.fn();

vi.mock('@huggingface/transformers', () => ({
  env: { cacheDir: '' },
  pipeline: (...args: unknown[]) => pipelineMock(...args),
}));

import { transformersAdapter } from './transformers.adapter.js';
import type { ModelManifest } from '../core/model.types.js';

function manifest(overrides: Partial<ModelManifest> = {}): ModelManifest {
  return {
    id: 'resume-ner',
    name: 'Resume NER',
    description: 'test',
    hub: { provider: 'huggingface', modelId: 'oksomu/resume-ner', revision: 'main' },
    architecture: {
      library: 'transformers',
      architectureType: 'token-classification',
      task: 'token-classification',
      modality: 'text',
    },
    configuration: {},
    dependencies: [],
    capabilities: { batching: true, streaming: false, training: false, peft: false, quantization: true },
    runtime: { device: 'auto', dtype: 'fp32', quantization: 'auto' },
    security: { trusted: true, allowlisted: true, lastScannedAt: new Date().toISOString() },
    status: 'active',
    ...overrides,
  } as ModelManifest;
}

describe('TransformersAdapter memory-safe loading', () => {
  it('requests the quantized q8 weights on CPU (transformers.js v3 dtype API)', async () => {
    pipelineMock.mockResolvedValueOnce(vi.fn());
    await transformersAdapter.load(manifest(), { device: 'cpu', dtype: 'fp32', quantization: 'auto' });

    expect(pipelineMock).toHaveBeenCalledWith(
      'token-classification',
      'oksomu/resume-ner',
      expect.objectContaining({ dtype: 'q8', device: 'cpu', revision: 'main' }),
    );
    // The legacy v2 `quantized` flag is ignored by transformers v3 and must
    // not be relied upon: it previously loaded the 261MB fp32 model.onnx
    // instead of the 66MB model_quantized.onnx and OOMed 512MB instances.
    const opts = pipelineMock.mock.calls[0][2] as Record<string, unknown>;
    expect(opts).not.toHaveProperty('quantized');
  });

  it('loads fp32 only when the manifest is not quantizable', async () => {
    pipelineMock.mockResolvedValueOnce(vi.fn());
    await transformersAdapter.load(
      manifest({
        capabilities: { batching: true, streaming: false, training: false, peft: false, quantization: false },
        runtime: { device: 'auto', dtype: 'fp32', quantization: 'fp32' },
      }),
      { device: 'cpu', dtype: 'fp32', quantization: 'fp32' },
    );

    expect(pipelineMock).toHaveBeenCalledWith(
      'token-classification',
      'oksomu/resume-ner',
      expect.objectContaining({ dtype: 'fp32', device: 'cpu' }),
    );
  });
});
