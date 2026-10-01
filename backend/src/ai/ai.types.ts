export type AiProviderName = 'local' | 'groq' | 'anthropic' | 'openai';

export interface AiChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AiCompletionOptions {
  messages: AiChatMessage[];
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'text' | 'json';
  timeoutMs?: number;
  /**
   * Optional per-provider response validator. Runs after each provider
   * returns, before the result is accepted: throw (or let JSON.parse / Zod
   * throw) to mark the provider failed and fall through to the next one.
   * Must NOT reject legitimate content such as empty arrays.
   */
  validate?: (content: string) => void;
}

export interface AiCompletionResult {
  content: string;
  provider: AiProviderName;
  model: string;
  latencyMs: number;
}

export interface AiProviderStatus {
  provider: AiProviderName;
  configured: boolean;
  available: boolean;
  latencyMs?: number;
  error?: string;
}

export interface IAiProvider {
  readonly name: AiProviderName;
  isConfigured(): boolean;
  complete(options: AiCompletionOptions): Promise<AiCompletionResult>;
  healthCheck(): Promise<AiProviderStatus>;
}
