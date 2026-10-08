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

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);

  if (!headers.has('Content-Type') && init?.body && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${clientEnv.VITE_API_URL}${path}`, {
    ...init,
    headers,
  });

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

export async function authenticatedApiFetch<T>(path: string, init?: RequestInit): Promise<T> {
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
