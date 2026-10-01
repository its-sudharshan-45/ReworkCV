import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../utils/errors.js';
import { AiService } from './ai.service.js';
import type { AiCompletionResult, AiProviderName, IAiProvider } from './ai.types.js';

// ---------------------------------------------------------------------------
// AIProviderRouter (AiService) fallback tests: local-first chain.
// Order is injected via AiServiceOptions so these tests are env-independent.
// ---------------------------------------------------------------------------

function mockProvider(
  name: AiProviderName,
  opts: { configured?: boolean; content?: string; error?: AppError } = {},
): IAiProvider & { complete: ReturnType<typeof vi.fn> } {
  const { configured = true, content = `${name} response`, error } = opts;
  return {
    name,
    isConfigured: vi.fn().mockReturnValue(configured),
    complete: vi.fn().mockImplementation(async () => {
      if (error) throw error;
      return { content, provider: name, model: `${name}-model`, latencyMs: 5 } as AiCompletionResult;
    }),
    healthCheck: vi.fn().mockResolvedValue({ provider: name, configured, available: configured }),
  };
}

function buildService(overrides: {
  local?: IAiProvider;
  groq?: IAiProvider;
  anthropic?: IAiProvider;
  openai?: IAiProvider;
}) {
  const local = overrides.local ?? mockProvider('local');
  const groq = overrides.groq ?? mockProvider('groq');
  const anthropic = overrides.anthropic ?? mockProvider('anthropic');
  const openai = overrides.openai ?? mockProvider('openai');
  const service = new AiService(
    { local, groq, anthropic, openai },
    { primaryProvider: 'local', fallbackProviders: ['groq', 'anthropic', 'openai'] },
  );
  return { service, local, groq, anthropic, openai };
}

const opts = { messages: [{ role: 'user' as const, content: 'test' }] };

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AIProviderRouter local-first fallback', () => {
  it('local success: uses local with no fallback', async () => {
    const { service, groq, anthropic, openai } = buildService({});
    const res = await service.complete(opts);
    expect(res.provider).toBe('local');
    expect(groq.complete).not.toHaveBeenCalled();
    expect(anthropic.complete).not.toHaveBeenCalled();
    expect(openai.complete).not.toHaveBeenCalled();
  });

  it('local unavailable (unconfigured): groq is used', async () => {
    const { service, local, groq } = buildService({ local: mockProvider('local', { configured: false }) });
    const res = await service.complete(opts);
    expect(res.provider).toBe('groq');
    expect(local.complete).not.toHaveBeenCalled();
    expect(groq.complete).toHaveBeenCalledTimes(1);
  });

  it('local timeout: next provider is used', async () => {
    const { service, local } = buildService({
      local: mockProvider('local', { error: new AppError('Local AI request timed out', 504, 'AI_PROVIDER_TIMEOUT') }),
    });
    const res = await service.complete(opts);
    expect(res.provider).toBe('groq');
    expect(local.complete).toHaveBeenCalledTimes(1);
  });

  it('local + groq failure: claude is used', async () => {
    const { service, anthropic, openai } = buildService({
      local: mockProvider('local', { error: new AppError('local down', 503, 'AI_PROVIDER_UNAVAILABLE') }),
      groq: mockProvider('groq', { error: new AppError('groq rate limited', 429, 'AI_PROVIDER_RATE_LIMITED') }),
    });
    const res = await service.complete(opts);
    expect(res.provider).toBe('anthropic');
    expect(anthropic.complete).toHaveBeenCalledTimes(1);
    expect(openai.complete).not.toHaveBeenCalled();
  });

  it('local + groq + claude failure: openai is used', async () => {
    const { service, openai } = buildService({
      local: mockProvider('local', { error: new AppError('local down', 503, 'AI_PROVIDER_UNAVAILABLE') }),
      groq: mockProvider('groq', { error: new AppError('groq down', 503, 'AI_PROVIDER_UNAVAILABLE') }),
      anthropic: mockProvider('anthropic', { error: new AppError('claude down', 503, 'AI_PROVIDER_UNAVAILABLE') }),
    });
    const res = await service.complete(opts);
    expect(res.provider).toBe('openai');
    expect(openai.complete).toHaveBeenCalledTimes(1);
  });

  it('all providers fail: throws AI_ALL_PROVIDERS_FAILED (caller degrades to deterministic)', async () => {
    const down = (name: string) => mockProvider(name as AiProviderName, { error: new AppError(`${name} down`, 503, 'AI_PROVIDER_UNAVAILABLE') });
    const { service } = buildService({ local: down('local'), groq: down('groq'), anthropic: down('anthropic'), openai: down('openai') });
    await expect(service.complete(opts)).rejects.toMatchObject({ code: 'AI_ALL_PROVIDERS_FAILED' });
  });

  it('malformed JSON from local: treated as failure, next provider used', async () => {
    const { service, groq } = buildService({
      local: mockProvider('local', { content: 'this is not json{{{' }),
      groq: mockProvider('groq', { content: JSON.stringify({ summary: 'groq fallback ok' }) }),
    });
    const res = await service.complete({ ...opts, validate: (c) => { JSON.parse(c); } });
    expect(res.provider).toBe('groq');
    expect(groq.complete).toHaveBeenCalledTimes(1);
    expect(res.content).toContain('groq fallback ok');
  });

  it('schema-invalid JSON from local: treated as failure, next provider used', async () => {
    const { service } = buildService({
      local: mockProvider('local', { content: JSON.stringify({ wrongShape: true }) }),
      groq: mockProvider('groq', { content: JSON.stringify({ summary: 'groq fallback ok' }) }),
    });
    const res = await service.complete({
      ...opts,
      validate: (c) => {
        const parsed = JSON.parse(c) as { summary?: unknown };
        if (typeof parsed.summary !== 'string') throw new Error('schema violation: summary required');
      },
    });
    expect(res.provider).toBe('groq');
    expect(res.content).toContain('groq fallback ok');
  });

  it('legitimate empty arrays are NOT a failure: no fallback', async () => {
    const { service, local, groq } = buildService({
      local: mockProvider('local', { content: JSON.stringify({ summary: 'ok', recommendations: [] }) }),
    });
    const res = await service.complete({ ...opts, validate: (c) => { JSON.parse(c); } });
    expect(res.provider).toBe('local');
    expect(local.complete).toHaveBeenCalledTimes(1);
    expect(groq.complete).not.toHaveBeenCalled();
  });

  it('no cloud API keys + local available: full analysis path works', async () => {
    const { service, groq, anthropic, openai } = buildService({
      groq: mockProvider('groq', { configured: false }),
      anthropic: mockProvider('anthropic', { configured: false }),
      openai: mockProvider('openai', { configured: false }),
    });
    const res = await service.complete(opts);
    expect(res.provider).toBe('local');
    expect(groq.complete).not.toHaveBeenCalled();
    expect(anthropic.complete).not.toHaveBeenCalled();
    expect(openai.complete).not.toHaveBeenCalled();
  });

  it('fallback budget exhaustion stops the chain instead of stacking timeouts', async () => {
    const { service, groq } = buildService({
      local: mockProvider('local', { error: new AppError('local down', 503, 'AI_PROVIDER_UNAVAILABLE') }),
    });
    const budgeted = new AiService(
      {
        local: mockProvider('local', { error: new AppError('local down', 503, 'AI_PROVIDER_UNAVAILABLE') }),
        groq,
      },
      { primaryProvider: 'local', fallbackProviders: ['groq'], fallbackBudgetMs: 0 },
    );
    await expect(budgeted.complete(opts)).rejects.toMatchObject({ code: 'AI_ALL_PROVIDERS_FAILED' });
    expect(groq.complete).not.toHaveBeenCalled();
    expect(service).toBeDefined();
  });

  it('does not fall back on non-recoverable errors', async () => {
    const { service, groq } = buildService({
      local: mockProvider('local', { error: new AppError('bad args', 400, 'VALIDATION_ERROR') }),
    });
    await expect(service.complete(opts)).rejects.toThrow('bad args');
    expect(groq.complete).not.toHaveBeenCalled();
  });
});
