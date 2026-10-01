import { afterEach, describe, expect, it, vi } from 'vitest';
import { isRecoverableAiError } from './ai.errors.js';
import { localProvider } from './providers/local.provider.js';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function mockFetch(handler: (url: string, init?: RequestInit) => unknown) {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string, init?: RequestInit) => handler(url, init)));
}

describe('LocalProvider (Ollama-compatible)', () => {
  it('is configured via environment (no cloud API key required)', () => {
    expect(localProvider.isConfigured()).toBe(true);
    expect(localProvider.name).toBe('local');
  });

  it('sends a non-streaming chat request and returns content', async () => {
    let seenBody: Record<string, unknown> = {};
    mockFetch(async (_url, init) => {
      seenBody = JSON.parse(init?.body as string) as Record<string, unknown>;
      return {
        ok: true,
        json: async () => ({ message: { role: 'assistant', content: '{"summary":"ok"}' }, done: true }),
      };
    });

    const res = await localProvider.complete({
      messages: [{ role: 'user', content: 'hi' }],
      temperature: 0.3,
      maxTokens: 100,
      responseFormat: 'json',
    });

    expect(res.provider).toBe('local');
    expect(res.content).toBe('{"summary":"ok"}');
    expect(seenBody['stream']).toBe(false);
    expect(seenBody['format']).toBe('json');
    expect((seenBody['options'] as Record<string, unknown>)['num_predict']).toBe(100);
  });

  it('maps connection failures to recoverable errors (fallback proceeds)', async () => {
    mockFetch(async () => {
      throw new TypeError('fetch failed');
    });
    const err = await localProvider.complete({ messages: [{ role: 'user', content: 'hi' }] }).catch((e) => e);
    expect(isRecoverableAiError(err)).toBe(true);
  });

  it('maps server error statuses to recoverable errors', async () => {
    mockFetch(async () => ({ ok: false, status: 500 }));
    const err = await localProvider.complete({ messages: [{ role: 'user', content: 'hi' }] }).catch((e) => e);
    expect(isRecoverableAiError(err)).toBe(true);
  });

  it('rejects empty responses as invalid (recoverable)', async () => {
    mockFetch(async () => ({ ok: true, json: async () => ({ message: { content: '   ' } }) }));
    const err = await localProvider.complete({ messages: [{ role: 'user', content: 'hi' }] }).catch((e) => e);
    expect(isRecoverableAiError(err)).toBe(true);
  });

  it('healthCheck probes /api/tags lightly and never throws', async () => {
    let seenUrl = '';
    mockFetch(async (url) => {
      seenUrl = url;
      return { ok: true };
    });
    const status = await localProvider.healthCheck();
    expect(seenUrl).toContain('/api/tags');
    expect(status.available).toBe(true);

    mockFetch(async () => {
      throw new TypeError('fetch failed');
    });
    const down = await localProvider.healthCheck();
    expect(down.available).toBe(false);
    expect(down.configured).toBe(true);
    const asJson = JSON.stringify(down);
    expect(asJson).not.toContain('sk-');
  });
});
