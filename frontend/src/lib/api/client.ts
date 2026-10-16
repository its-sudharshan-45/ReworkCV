import { clientEnv } from '@/lib/env';
import { createClient } from '@/lib/supabase/client';

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId?: string;
  };
}

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, body: ApiErrorBody) {
    super(body.error.message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = body.error.code;
    this.details = body.error.details;
  }
}

export type ApiFetchInit = RequestInit & {
  /**
   * Client-side timeout in ms. Aborts the request before Render/proxy
   * idle-timeouts turn a slow analyze-job call into an opaque network
   * reset. Must exceed the backend chain (AI fallback budget + RAG
   * timeout + DB) so valid slow reports still resolve.
   */
  timeoutMs?: number;
};

/** Bounds the cosmetic "Preparing your personalized report" stage. */
export const DEFAULT_API_TIMEOUT_MS = 120_000;

export async function apiFetch<T>(path: string, init?: ApiFetchInit): Promise<T> {
  const headers = new Headers(init?.headers);

  if (!headers.has('Content-Type') && init?.body && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const timeoutMs = init?.timeoutMs ?? DEFAULT_API_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId =
    timeoutMs > 0 ? setTimeout(() => controller.abort(new DOMException('Timeout', 'TimeoutError')), timeoutMs) : null;
  // Honor a caller-supplied signal without losing the timeout.
  const callerSignal = init?.signal;
  if (callerSignal) {
    if (callerSignal.aborted) controller.abort(callerSignal.reason);
    else callerSignal.addEventListener('abort', () => controller.abort(callerSignal.reason), { once: true });
  }

  let response: Response;
  try {
    const { timeoutMs: _timeout, ...fetchInit } = init ?? {};
    void _timeout;
    response = await fetch(`${clientEnv.VITE_API_URL}${path}`, {
      ...fetchInit,
      headers,
      signal: controller.signal,
    });
  } catch (err) {
    // Timeout: the backend chain (RAG/AI fallback + persist) can exceed
    // proxy limits on slow reports. Surface as actionable TIMEOUT_ERROR so
    // the UI never misreports it as offline/CORS and loading can resolve.
    if (err instanceof DOMException && (err.name === 'TimeoutError' || controller.signal.aborted)) {
      throw new ApiClientError(0, {
        error: {
          code: 'TIMEOUT_ERROR',
          message: 'The request timed out. Please try again.',
        },
      });
    }
    if (err instanceof Error && err.name === 'AbortError') {
      throw new ApiClientError(0, {
        error: {
          code: 'TIMEOUT_ERROR',
          message: 'The request timed out. Please try again.',
        },
      });
    }
    // Transport-level failure: DNS, connection refused, offline, or a CORS
    // rejection (no Access-Control-Allow-Origin header). These reject the
    // fetch promise instead of returning a response, so without this mapping
    // callers only see an opaque TypeError with no actionable message.
    throw new ApiClientError(0, {
      error: {
        code: 'NETWORK_ERROR',
        message: 'Could not reach the server. Check your connection and try again.',
      },
    });
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }

  if (!response.ok) {
    let body: ApiErrorBody;

    try {
      body = (await response.json()) as ApiErrorBody;
    } catch {
      throw new ApiClientError(response.status, {
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Request failed. Please try again.',
        },
      });
    }

    throw new ApiClientError(response.status, body);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get('content-type');
  if (!contentType?.includes('application/json')) {
    throw new ApiClientError(response.status, {
      error: {
        code: 'UNEXPECTED_RESPONSE',
        message: `Unexpected ${contentType || 'empty'} response (HTTP ${response.status}). Please try again.`,
      },
    });
  }

  return (await response.json()) as T;
}

export async function authenticatedApiFetch<T>(path: string, init?: ApiFetchInit): Promise<T> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new ApiClientError(401, {
      error: {
        code: 'AUTHENTICATION_ERROR',
        message: 'Authentication required',
      },
    });
  }

  const headers = new Headers(init?.headers);
  headers.set('Authorization', `Bearer ${session.access_token}`);

  return apiFetch<T>(path, {
    ...init,
    headers,
  });
}
