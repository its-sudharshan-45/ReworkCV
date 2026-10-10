import { z } from 'zod';

const clientEnvSchema = z.object({
  VITE_SUPABASE_URL: z.string().url(),
  VITE_SUPABASE_ANON_KEY: z.string().min(1),
  VITE_API_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_API_URL: z.string().url(),
});

// Dev/test fallbacks. These must never silently ship to production, so the
// prod-build guard below rejects a build where any value was NOT explicitly
// provided (i.e. fell through to these sentinels).
const FALLBACK_SUPABASE_URL = 'https://example.supabase.co';
const FALLBACK_SUPABASE_ANON_KEY = 'test-anon-key';
const FALLBACK_API_URL = 'http://localhost:4000/api/v1';

/**
 * Reads an explicitly configured value (Vite `import.meta.env` first, then
 * `process.env` for Node/Vitest runtimes). Returns `undefined` when unset so
 * callers can distinguish "configured" from "fallback" — comparing against
 * sentinel strings cannot, because a deployer may legitimately set the same
 * value (e.g. a local/preview backend at http://localhost:4000/api/v1).
 */
function readExplicitEnv(viteKey: string, nextKey: string): string | undefined {
  // Try Vite import.meta.env
  try {
    const metaEnv = import.meta.env;
    if (metaEnv) {
      const viteValue = metaEnv[viteKey];
      if (typeof viteValue === 'string' && viteValue) return viteValue;
      const nextValue = metaEnv[nextKey];
      if (typeof nextValue === 'string' && nextValue) return nextValue;
    }
  } catch {
    // import.meta.env might not be defined in some test runtimes
  }

  // Fallback to process.env (e.g. during Node/Vitest)
  if (typeof process !== 'undefined' && process.env) {
    if (process.env[viteKey]) return process.env[viteKey]!;
    if (process.env[nextKey]) return process.env[nextKey]!;
  }

  return undefined;
}

const explicitSupabaseUrl = readExplicitEnv('VITE_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL');
const explicitSupabaseAnonKey = readExplicitEnv('VITE_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY');
const explicitApiUrl = readExplicitEnv('VITE_API_URL', 'NEXT_PUBLIC_API_URL');

const rawSupabaseUrl = explicitSupabaseUrl ?? FALLBACK_SUPABASE_URL;
const rawSupabaseAnonKey = explicitSupabaseAnonKey ?? FALLBACK_SUPABASE_ANON_KEY;
const rawApiUrl = explicitApiUrl ?? FALLBACK_API_URL;

// Fail-closed in production: every value must be explicitly configured.
// In dev/test the fallbacks keep Vitest and local startup working.
function isProdBuild(): boolean {
  try {
    return typeof import.meta !== 'undefined' && Boolean(import.meta.env?.PROD);
  } catch {
    return false;
  }
}

if (isProdBuild()) {
  const missing: string[] = [];
  if (!explicitSupabaseUrl) missing.push('VITE_SUPABASE_URL');
  if (!explicitSupabaseAnonKey) missing.push('VITE_SUPABASE_ANON_KEY');
  if (!explicitApiUrl) missing.push('VITE_API_URL');
  if (missing.length > 0) {
    throw new Error(
      `Missing production configuration: ${missing.join(', ')} must be set.`,
    );
  }
  // Cleartext API URLs to non-loopback hosts are almost certainly a
  // misconfiguration (and browsers block them as mixed content under https).
  // Loopback is allowed so production builds stay testable via vite preview.
  if (/^http:\/\/(?!localhost([:/]|$)|127\.0\.0\.1([:/]|$))/i.test(rawApiUrl)) {
    throw new Error('Insecure production configuration: VITE_API_URL must use https:// except for localhost.');
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
