// cspell:ignore huggingface
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  BACKEND_PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  RESUME_STORAGE_BUCKET: z.string().min(1).default('resumes'),
  RESUME_MAX_FILE_SIZE_BYTES: z.coerce.number().int().positive().default(5_242_880),

  // AI Provider Configuration
  GROQ_API_KEY: z.string().optional(),
  GROQ_MODEL: z.string().default('groq/compound-mini'),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default('claude-3-5-haiku-latest'),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  AI_PRIMARY_PROVIDER: z.enum(['local', 'groq', 'anthropic', 'openai']).default('local'),
  AI_FALLBACK_ENABLED: z
    .preprocess((val) => {
      if (val === undefined || val === '') return true;
      if (typeof val === 'boolean') return val;
      return val === 'true' || val === '1';
    }, z.boolean())
    .default(true),
  AI_FALLBACK_PROVIDERS: z.string().default('groq,anthropic,openai'),
  AI_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
  AI_FALLBACK_BUDGET_MS: z.coerce.number().int().positive().default(60_000),

  // Local-first LLM (Ollama-compatible). No cloud API key required.
  LOCAL_AI_ENABLED: z
    .preprocess((val) => {
      if (val === undefined || val === '') return true;
      if (typeof val === 'boolean') return val;
      return val === 'true' || val === '1';
    }, z.boolean())
    .default(true),
  LOCAL_AI_BASE_URL: z.string().default('http://localhost:11434'),
  LOCAL_AI_MODEL: z.string().default('llama3.1:8b'),
  LOCAL_AI_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),

  // Optional per-provider timeout caps (fall back to AI_TIMEOUT_MS).
  GROQ_TIMEOUT_MS: z.coerce.number().int().positive().optional(),
  ANTHROPIC_TIMEOUT_MS: z.coerce.number().int().positive().optional(),
  OPENAI_TIMEOUT_MS: z.coerce.number().int().positive().optional(),

  // Hugging Face Configuration
  HF_CACHE_DIR: z.string().default('.cache/huggingface'),
  HF_TOKEN: z.string().optional(),

  // RAG Configuration (all tunable; never hardcoded in the engine)
  RAG_ENABLED: z
    .preprocess((val) => {
      if (val === undefined || val === '') return true;
      if (typeof val === 'boolean') return val;
      return val === 'true' || val === '1';
    }, z.boolean())
    .default(true),
  RAG_TOP_K: z.coerce.number().int().min(1).max(20).default(5),
  RAG_SIMILARITY_THRESHOLD: z.coerce.number().min(0).max(1).default(0.1),
  RAG_CHUNK_SIZE: z.coerce.number().int().positive().default(800),
  RAG_CHUNK_OVERLAP: z.coerce.number().int().min(0).default(100),
  EMBEDDING_PROVIDER: z.enum(['hash', 'transformers']).default('hash'),
  EMBEDDING_DIMENSIONS: z.coerce.number().int().positive().default(384),
  RAG_MAX_CONTEXT_CHARS: z.coerce.number().int().positive().default(6000),
  RAG_CACHE_TTL_MS: z.coerce.number().int().positive().default(300_000),
  RAG_TIMEOUT_MS: z.coerce.number().int().positive().default(15_000),
  RAG_ADMIN_API_KEY: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const formatted = parsed.error.flatten().fieldErrors;
    console.error('Invalid environment configuration:', formatted);
    process.exit(1);
  }

  return parsed.data;
}

export const env = loadEnv();
