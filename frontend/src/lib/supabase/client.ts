import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { clientEnv } from '@/lib/env';

let supabaseInstance: ReturnType<typeof createSupabaseClient> | null = null;

const REMEMBER_ME_KEY = 'reworkcv-remember-me';

function isPersistenceEnabled(): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return true;
    return window.localStorage.getItem(REMEMBER_ME_KEY) !== 'off';
  } catch {
    return true;
  }
}

/**
 * Choose whether the auth session persists across browser restarts.
 * Must be called before sign-in; resets the client so the chosen
 * storage backend applies. Defaults to persistent.
 */
export function setRememberMe(persist: boolean) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(REMEMBER_ME_KEY, persist ? 'on' : 'off');
    }
  } catch {
    // Storage unavailable — fall back to the default persistent session.
  }
  supabaseInstance = null;
}

function sessionOnlyStorage() {
  if (typeof window !== 'undefined' && window.sessionStorage) {
    return window.sessionStorage;
  }
  const memory = new Map<string, string>();
  return {
    getItem: (key: string) => (memory.has(key) ? (memory.get(key) as string) : null),
    setItem: (key: string, value: string) => {
      memory.set(key, value);
    },
    removeItem: (key: string) => {
      memory.delete(key);
    },
  };
}

export function createClient() {
  if (!supabaseInstance) {
    supabaseInstance = createSupabaseClient(
      clientEnv.VITE_SUPABASE_URL,
      clientEnv.VITE_SUPABASE_ANON_KEY,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storage: isPersistenceEnabled() ? undefined : sessionOnlyStorage(),
        },
      },
    );
  }
  return supabaseInstance;
}
