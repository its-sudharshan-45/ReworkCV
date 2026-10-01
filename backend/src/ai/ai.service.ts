import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { AppError } from '../utils/errors.js';
import { isRecoverableAiError } from './ai.errors.js';
import type {
  AiCompletionOptions,
  AiCompletionResult,
  AiProviderName,
  AiProviderStatus,
  IAiProvider,
} from './ai.types.js';
import { anthropicProvider } from './providers/anthropic.provider.js';
import { groqProvider } from './providers/groq.provider.js';
import { localProvider } from './providers/local.provider.js';
import { openAiProvider } from './providers/openai.provider.js';

const ALL_PROVIDERS: AiProviderName[] = ['local', 'groq', 'anthropic', 'openai'];

export interface AiServiceOptions {
  /** Overrides env AI_PRIMARY_PROVIDER (useful for tests). */
  primaryProvider?: AiProviderName;
  /** Overrides env AI_FALLBACK_PROVIDERS (useful for tests). */
  fallbackProviders?: AiProviderName[];
  /** Overrides env AI_FALLBACK_ENABLED (useful for tests). */
  fallbackEnabled?: boolean;
  /** Overrides env AI_FALLBACK_BUDGET_MS (useful for tests). */
  fallbackBudgetMs?: number;
}

/**
 * Central AI provider router: primary-first with ordered fallback.
 * Default chain: local -> groq -> anthropic -> openai -> deterministic-only
 * (the caller degrades to deterministic when every provider fails).
 */
export class AiService {
  private readonly providers: Map<AiProviderName, IAiProvider>;
  private readonly options: AiServiceOptions;

  constructor(
    customProviders?: Partial<Record<AiProviderName, IAiProvider>>,
    options?: AiServiceOptions,
  ) {
    this.providers = new Map<AiProviderName, IAiProvider>([
      ['local', customProviders?.local ?? localProvider],
      ['groq', customProviders?.groq ?? groqProvider],
      ['anthropic', customProviders?.anthropic ?? anthropicProvider],
      ['openai', customProviders?.openai ?? openAiProvider],
    ]);
    this.options = options ?? {};
  }

  private getProvider(name: AiProviderName): IAiProvider {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new AppError(
        `AI provider '${name}' is not supported`,
        500,
        'AI_PROVIDER_UNAVAILABLE',
      );
    }
    return provider;
  }

  private getProviderExecutionOrder(): AiProviderName[] {
    const primary = this.options.primaryProvider ?? (env.AI_PRIMARY_PROVIDER as AiProviderName);
    const order: AiProviderName[] = [primary];

    const fallbackEnabled = this.options.fallbackEnabled ?? env.AI_FALLBACK_ENABLED;
    if (fallbackEnabled) {
      const fallbackNames = (
        this.options.fallbackProviders ??
        env.AI_FALLBACK_PROVIDERS.split(',').map((p) => p.trim().toLowerCase() as AiProviderName)
      ).filter((p): p is AiProviderName => ALL_PROVIDERS.includes(p));

      for (const fallback of fallbackNames) {
        if (!order.includes(fallback)) {
          order.push(fallback);
        }
      }
    }

    return order;
  }

  /** Per-provider timeout cap: provider-specific env, else global AI_TIMEOUT_MS. */
  private resolveProviderTimeout(providerName: AiProviderName, requested?: number): number {
    if (requested !== undefined) return requested;
    switch (providerName) {
      case 'local':
        return env.LOCAL_AI_TIMEOUT_MS;
      case 'groq':
        return env.GROQ_TIMEOUT_MS ?? env.AI_TIMEOUT_MS;
      case 'anthropic':
        return env.ANTHROPIC_TIMEOUT_MS ?? env.AI_TIMEOUT_MS;
      case 'openai':
        return env.OPENAI_TIMEOUT_MS ?? env.AI_TIMEOUT_MS;
      default:
        return env.AI_TIMEOUT_MS;
    }
  }

  async complete(options: AiCompletionOptions): Promise<AiCompletionResult> {
    const executionOrder = this.getProviderExecutionOrder();
    const attempts: { provider: string; error: string }[] = [];
    const budgetMs = this.options.fallbackBudgetMs ?? env.AI_FALLBACK_BUDGET_MS;
    const deadline = Date.now() + budgetMs;

    for (let i = 0; i < executionOrder.length; i++) {
      const providerName = executionOrder[i];
      const provider = this.getProvider(providerName);

      if (!provider.isConfigured()) {
        logger.debug({ provider: providerName }, 'AI provider skipped (not configured)');
        attempts.push({ provider: providerName, error: 'Not configured' });
        continue;
      }

      // Never start a provider we cannot give a meaningful time slice to.
      const remainingMs = deadline - Date.now();
      if (i > 0 && remainingMs <= 0) {
        logger.warn({ provider: providerName }, 'AI fallback budget exhausted; stopping chain');
        attempts.push({ provider: providerName, error: 'Fallback budget exhausted' });
        break;
      }

      try {
        logger.debug({ provider: providerName }, 'Attempting AI completion with provider');
        const timeoutMs = Math.min(
          this.resolveProviderTimeout(providerName, options.timeoutMs),
          Math.max(remainingMs, 1),
        );
        const result = await provider.complete({ ...options, timeoutMs, validate: undefined });

        // Validation-triggered fallback: malformed JSON / schema failures
        // count as provider failures and move to the next provider.
        if (options.validate) {
          try {
            options.validate(result.content);
          } catch (validationError) {
            const message =
              validationError instanceof Error ? validationError.message : String(validationError);
            throw new AppError(
              `AI provider '${providerName}' returned invalid output: ${message.slice(0, 160)}`,
              502,
              'AI_PROVIDER_INVALID_RESPONSE',
            );
          }
        }

        logger.info(
          { provider: providerName, model: result.model, latencyMs: result.latencyMs },
          'AI completion succeeded',
        );
        return result;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        attempts.push({ provider: providerName, error: errorMsg });

        logger.warn(
          { provider: providerName, error: errorMsg, isLast: i === executionOrder.length - 1 },
          'AI provider failed during completion',
        );

        // Do not fallback for non-recoverable / application errors
        if (!isRecoverableAiError(err)) {
          throw err;
        }

        // If fallback is disabled or this was the last provider in line, break
        const fallbackEnabled = this.options.fallbackEnabled ?? env.AI_FALLBACK_ENABLED;
        if (!fallbackEnabled || i === executionOrder.length - 1) {
          break;
        }
      }
    }

    logger.error({ attempts }, 'All configured AI providers failed to fulfill the request');
    throw new AppError(
      'The AI service is temporarily unavailable. Please try again shortly.',
      503,
      'AI_ALL_PROVIDERS_FAILED',
      { attempts: attempts.map((a) => ({ provider: a.provider })) },
    );
  }

  async checkProviderHealth(): Promise<AiProviderStatus[]> {
    const statuses: AiProviderStatus[] = [];

    for (const name of ALL_PROVIDERS) {
      const provider = this.getProvider(name);
      if (!provider.isConfigured()) {
        statuses.push({
          provider: name,
          configured: false,
          available: false,
          error: name === 'local' ? 'Local AI not configured' : 'API key not configured',
        });
      } else {
        const status = await provider.healthCheck();
        statuses.push(status);
      }
    }

    return statuses;
  }
}

export const aiService = new AiService();
