import { env } from '../../config/env.js';
import { AppError } from '../../utils/errors.js';
import { classifyAiError } from '../ai.errors.js';
import type {
  AiCompletionOptions,
  AiCompletionResult,
  AiProviderName,
  AiProviderStatus,
  IAiProvider,
} from '../ai.types.js';

// Local-first LLM provider backed by an Ollama-compatible inference server.
// No cloud API key required. Uses global fetch — no additional SDK dependency.
// NOTE: This reuses the existing IAiProvider abstraction (complete /
// healthCheck / isConfigured) rather than introducing a parallel interface.

interface OllamaChatResponse {
  message?: { role?: string; content?: string };
  done?: boolean;
  error?: string;
}

export class LocalProvider implements IAiProvider {
  readonly name: AiProviderName = 'local';

  private get baseUrl(): string {
    return (env.LOCAL_AI_BASE_URL ?? '').replace(/\/+$/, '');
  }

  private get model(): string {
    return env.LOCAL_AI_MODEL;
  }

  isConfigured(): boolean {
    return Boolean(env.LOCAL_AI_ENABLED && this.baseUrl.length > 0 && this.model.length > 0);
  }

  async complete(options: AiCompletionOptions): Promise<AiCompletionResult> {
    if (!this.isConfigured()) {
      throw new AppError(
        'Local AI provider is not configured (LOCAL_AI_ENABLED/LOCAL_AI_BASE_URL/LOCAL_AI_MODEL)',
        502,
        'AI_PROVIDER_AUTHENTICATION_FAILED',
      );
    }

    const start = Date.now();
    const timeoutMs = options.timeoutMs ?? env.LOCAL_AI_TIMEOUT_MS;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          messages: options.messages.map((m) => ({ role: m.role, content: m.content })),
          stream: false,
          format: options.responseFormat === 'json' ? 'json' : undefined,
          options: {
            temperature: options.temperature ?? 0.3,
            ...(options.maxTokens ? { num_predict: options.maxTokens } : {}),
          },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new AppError(
          `Local AI server responded with status ${response.status}`,
          502,
          'AI_PROVIDER_UNAVAILABLE',
        );
      }

      const data = (await response.json()) as OllamaChatResponse;
      if (data.error) {
        throw new AppError(`Local AI server error: ${data.error.slice(0, 120)}`, 502, 'AI_PROVIDER_ERROR');
      }
      const content = data.message?.content ?? '';
      if (!content.trim()) {
        throw new AppError('Local AI returned an empty response', 502, 'AI_PROVIDER_INVALID_RESPONSE');
      }

      return {
        content,
        provider: this.name,
        model: this.model,
        latencyMs: Date.now() - start,
      };
    } catch (err) {
      throw classifyAiError(err, this.name);
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Lightweight availability probe. A plain GET on /api/tags — never a full
   * analysis request. Never throws; reports availability instead.
   */
  async healthCheck(): Promise<AiProviderStatus> {
    if (!this.isConfigured()) {
      return { provider: this.name, configured: false, available: false, error: 'Local AI not configured' };
    }
    const start = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.min(env.LOCAL_AI_TIMEOUT_MS, 5000));
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, { signal: controller.signal });
      if (!response.ok) {
        return {
          provider: this.name,
          configured: true,
          available: false,
          latencyMs: Date.now() - start,
          error: `Local AI server status ${response.status}`,
        };
      }
      return { provider: this.name, configured: true, available: true, latencyMs: Date.now() - start };
    } catch (err) {
      return {
        provider: this.name,
        configured: true,
        available: false,
        latencyMs: Date.now() - start,
        error: err instanceof Error ? err.message.slice(0, 120) : String(err).slice(0, 120),
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

export const localProvider = new LocalProvider();
