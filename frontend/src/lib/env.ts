import { z } from 'zod';

const clientEnvSchema = z.object({
  VITE_SUPABASE_URL: z.string().url(),
  VITE_SUPABASE_ANON_KEY: z.string().min(1),
  VITE_API_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_API_URL: z.string().url(),
});

function getEnvVar(viteKey: string, nextKey: string, fallback = ''): string {
  // Try Vite import.meta.env
  try {
    const metaEnv = import.meta.env;
    if (metaEnv && typeof metaEnv[viteKey] === 'string' && metaEnv[viteKey]) {
      return metaEnv[viteKey];
    }
    if (metaEnv && typeof metaEnv[nextKey] === 'string' && metaEnv[nextKey]) {
      return metaEnv[nextKey];
    }
  } catch {
    // import.meta.env might not be defined in some test runtimes
  }

  // Fallback to process.env (e.g. during Node/Vitest)
  if (typeof process !== 'undefined' && process.env) {
    if (process.env[viteKey]) return process.env[viteKey]!;
    if (process.env[nextKey]) return process.env[nextKey]!;
  }

  return fallback;
}

const rawSupabaseUrl = getEnvVar('VITE_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
const rawSupabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key');
const rawApiUrl = getEnvVar('VITE_API_URL', 'NEXT_PUBLIC_API_URL', 'http://localhost:4000/api/v1');

// Fail-closed in production: placeholder fallbacks must never ship to prod.
// In dev/test the fallbacks keep Vitest and local startup working.
function isProdBuild(): boolean {
  try {
    return typeof import.meta !== 'undefined' && Boolean(import.meta.env?.PROD);
  } catch {
    return false;
  }
}

if (isProdBuild()) {
  const placeholders = ['https://example.supabase.co', 'test-anon-key', 'http://localhost:4000/api/v1'];
  if (placeholders.includes(rawSupabaseUrl) || placeholders.includes(rawSupabaseAnonKey) || placeholders.includes(rawApiUrl)) {
    throw new Error(
      'Missing production configuration: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, and VITE_API_URL must be set.',
    );
  }
  if (rawApiUrl.startsWith('http://')) {
    throw new Error('Insecure production configuration: VITE_API_URL must use https:// in production.');
  }
}

export const clientEnv = clientEnvSchema.parse({
  VITE_SUPABASE_URL: rawSupabaseUrl,
  VITE_SUPABASE_ANON_KEY: rawSupabaseAnonKey,
  VITE_API_URL: rawApiUrl,
  NEXT_PUBLIC_SUPABASE_URL: rawSupabaseUrl,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: rawSupabaseAnonKey,
  NEXT_PUBLIC_API_URL: rawApiUrl,
});
