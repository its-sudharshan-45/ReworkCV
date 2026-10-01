import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../utils/errors.js';
import { isRecoverableAiError } from './ai.errors.js';
import { AiService } from './ai.service.js';
import type { AiCompletionResult, IAiProvider } from './ai.types.js';

describe('AiService Provider Router & Fallback', () => {
  let mockGroq: IAiProvider;
  let mockAnthropic: IAiProvider;
  let mockOpenAi: IAiProvider;

  beforeEach(() => {
    mockGroq = {
      name: 'groq',
      isConfigured: vi.fn().mockReturnValue(true),
      complete: vi.fn().mockResolvedValue({
        content: 'Groq response',
        provider: 'groq',
        model: 'llama-3.3-70b-versatile',
        latencyMs: 150,
      } as AiCompletionResult),
      healthCheck: vi.fn().mockResolvedValue({
        provider: 'groq',
        configured: true,
        available: true,
        latencyMs: 100,
      }),
    };

    mockAnthropic = {
      name: 'anthropic',
      isConfigured: vi.fn().mockReturnValue(true),
      complete: vi.fn().mockResolvedValue({
        content: 'Anthropic response',
        provider: 'anthropic',
        model: 'claude-3-5-haiku-latest',
        latencyMs: 200,
      } as AiCompletionResult),
      healthCheck: vi.fn().mockResolvedValue({
        provider: 'anthropic',
        configured: true,
        available: true,
        latencyMs: 120,
      }),
    };

    mockOpenAi = {
      name: 'openai',
      isConfigured: vi.fn().mockReturnValue(true),
      complete: vi.fn().mockResolvedValue({
        content: 'OpenAI response',
        provider: 'openai',
        model: 'gpt-4o-mini',
        latencyMs: 180,
      } as AiCompletionResult),
      healthCheck: vi.fn().mockResolvedValue({
        provider: 'openai',
        configured: true,
        available: true,
        latencyMs: 130,
      }),
    };
  });

  it('routes to primary provider (groq) on success', async () => {
    const service = new AiService({
      groq: mockGroq,
      anthropic: mockAnthropic,
      openai: mockOpenAi,
    });

    const res = await service.complete({
      messages: [{ role: 'user', content: 'test' }],
    });

    expect(res.provider).toBe('groq');
    expect(res.content).toBe('Groq response');
    expect(mockGroq.complete).toHaveBeenCalledTimes(1);
    expect(mockAnthropic.complete).not.toHaveBeenCalled();
    expect(mockOpenAi.complete).not.toHaveBeenCalled();
  });

  it('falls back to Anthropic when Groq encounters a recoverable error', async () => {
    vi.mocked(mockGroq.complete).mockRejectedValue(
      new AppError('Groq rate limited', 429, 'AI_PROVIDER_RATE_LIMITED'),
    );

    const service = new AiService({
      groq: mockGroq,
      anthropic: mockAnthropic,
      openai: mockOpenAi,
    });

    const res = await service.complete({
      messages: [{ role: 'user', content: 'test' }],
    });

    expect(res.provider).toBe('anthropic');
    expect(res.content).toBe('Anthropic response');
    expect(mockGroq.complete).toHaveBeenCalledTimes(1);
    expect(mockAnthropic.complete).toHaveBeenCalledTimes(1);
    expect(mockOpenAi.complete).not.toHaveBeenCalled();
  });

  it('falls back to OpenAI when both Groq and Anthropic fail with recoverable errors', async () => {
    vi.mocked(mockGroq.complete).mockRejectedValue(
      new AppError('Groq timed out', 504, 'AI_PROVIDER_TIMEOUT'),
    );
    vi.mocked(mockAnthropic.complete).mockRejectedValue(
      new AppError('Anthropic service unavailable', 503, 'AI_PROVIDER_UNAVAILABLE'),
    );

    const service = new AiService({
      groq: mockGroq,
      anthropic: mockAnthropic,
      openai: mockOpenAi,
    });

    const res = await service.complete({
      messages: [{ role: 'user', content: 'test' }],
    });

    expect(res.provider).toBe('openai');
    expect(res.content).toBe('OpenAI response');
    expect(mockGroq.complete).toHaveBeenCalledTimes(1);
    expect(mockAnthropic.complete).toHaveBeenCalledTimes(1);
    expect(mockOpenAi.complete).toHaveBeenCalledTimes(1);
  });

  it('throws AI_ALL_PROVIDERS_FAILED when all configured providers fail', async () => {
    vi.mocked(mockGroq.complete).mockRejectedValue(
      new AppError('Groq down', 503, 'AI_PROVIDER_UNAVAILABLE'),
    );
    vi.mocked(mockAnthropic.complete).mockRejectedValue(
      new AppError('Anthropic down', 503, 'AI_PROVIDER_UNAVAILABLE'),
    );
    vi.mocked(mockOpenAi.complete).mockRejectedValue(
      new AppError('OpenAI down', 503, 'AI_PROVIDER_UNAVAILABLE'),
    );

    const service = new AiService({
      groq: mockGroq,
      anthropic: mockAnthropic,
      openai: mockOpenAi,
    });

    await expect(
      service.complete({
        messages: [{ role: 'user', content: 'test' }],
      }),
    ).rejects.toThrowError(AppError);

    try {
      await service.complete({ messages: [{ role: 'user', content: 'test' }] });
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).code).toBe('AI_ALL_PROVIDERS_FAILED');
      expect((err as AppError).statusCode).toBe(503);
    }
  });

  it('does NOT fallback on non-recoverable errors (e.g. invalid arguments or validation error)', async () => {
    vi.mocked(mockGroq.complete).mockRejectedValue(
      new AppError('Invalid prompt structure', 400, 'VALIDATION_ERROR'),
    );

    const service = new AiService({
      groq: mockGroq,
      anthropic: mockAnthropic,
      openai: mockOpenAi,
    });

    await expect(
      service.complete({
        messages: [{ role: 'user', content: 'test' }],
      }),
    ).rejects.toThrowError('Invalid prompt structure');

    expect(mockGroq.complete).toHaveBeenCalledTimes(1);
    expect(mockAnthropic.complete).not.toHaveBeenCalled();
    expect(mockOpenAi.complete).not.toHaveBeenCalled();
  });

  it('skips unconfigured providers cleanly', async () => {
    vi.mocked(mockGroq.isConfigured).mockReturnValue(false);

    const service = new AiService({
      groq: mockGroq,
      anthropic: mockAnthropic,
      openai: mockOpenAi,
    });

    const res = await service.complete({
      messages: [{ role: 'user', content: 'test' }],
    });

    expect(mockGroq.complete).not.toHaveBeenCalled();
    expect(res.provider).toBe('anthropic');
  });

  it('checks provider health without exposing sensitive keys', async () => {
    const service = new AiService({
      groq: mockGroq,
      anthropic: mockAnthropic,
      openai: mockOpenAi,
    });

    const health = await service.checkProviderHealth();
    expect(health).toHaveLength(4);
    expect(health[0].provider).toBe('local');
    expect(health[1].provider).toBe('groq');
    expect(health[1].configured).toBe(true);
    expect(health[1].available).toBe(true);
    expect(health[2].provider).toBe('anthropic');
    expect(health[3].provider).toBe('openai');

    const jsonString = JSON.stringify(health);
    expect(jsonString).not.toContain('apiKey');
    expect(jsonString).not.toContain('sk-');
    expect(jsonString).not.toContain('gsk_');
  });

  it('correctly identifies recoverable AI errors', () => {
    expect(isRecoverableAiError(new AppError('rate limit', 429, 'AI_PROVIDER_RATE_LIMITED'))).toBe(true);
    expect(isRecoverableAiError(new AppError('timeout', 504, 'AI_PROVIDER_TIMEOUT'))).toBe(true);
    expect(isRecoverableAiError(new AppError('auth fail', 502, 'AI_PROVIDER_AUTHENTICATION_FAILED'))).toBe(true);
    expect(isRecoverableAiError(new AppError('invalid params', 400, 'VALIDATION_ERROR'))).toBe(false);
    expect(isRecoverableAiError(new Error('plain JS error'))).toBe(false);
  });
});
