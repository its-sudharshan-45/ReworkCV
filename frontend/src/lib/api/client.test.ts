import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiClientError, apiFetch } from '@/lib/api/client';

describe('ApiClientError', () => {
  it('preserves structured API error metadata', () => {
    const error = new ApiClientError(404, {
      error: {
        code: 'NOT_FOUND',
        message: 'Resource not found',
        requestId: 'req-123',
      },
    });

    expect(error.status).toBe(404);
    expect(error.code).toBe('NOT_FOUND');
    expect(error.message).toBe('Resource not found');
  });
});

describe('apiFetch', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function mockFetchOnce(impl: () => Promise<Response>) {
    vi.stubGlobal('fetch', vi.fn(impl));
  }

  function jsonResponse(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  it('maps transport failures (e.g. CORS-blocked requests) to an actionable NETWORK_ERROR', async () => {
    // Production signature: the browser rejects the promise with a bare
    // TypeError when the backend omits Access-Control-Allow-Origin.
    mockFetchOnce(() => Promise.reject(new TypeError('Failed to fetch')));

    const failure = await apiFetch('/resumes').catch((err: unknown) => err);
    expect(failure).toBeInstanceOf(ApiClientError);
    expect((failure as ApiClientError).code).toBe('NETWORK_ERROR');
    expect((failure as ApiClientError).message).toBe(
      'Could not reach the server. Check your connection and try again.',
    );
  });

  it('returns the parsed body for successful JSON responses (report rendering path)', async () => {
    mockFetchOnce(() =>
      Promise.resolve(jsonResponse({ success: true, data: { matchScore: 82 } })),
    );

    const body = await apiFetch<{ success: boolean; data: { matchScore: number } }>(
      '/resumes/id/analyze-job',
    );
    expect(body.data.matchScore).toBe(82);
  });

  it('preserves backend auth errors for missing or invalid tokens', async () => {
    mockFetchOnce(() =>
      Promise.resolve(
        jsonResponse(
          { error: { code: 'AUTHENTICATION_ERROR', message: 'Authentication required' } },
          401,
        ),
      ),
    );

    const failure = await apiFetch('/resumes').catch((err: unknown) => err);
    expect(failure).toBeInstanceOf(ApiClientError);
    expect((failure as ApiClientError).status).toBe(401);
    expect((failure as ApiClientError).code).toBe('AUTHENTICATION_ERROR');
  });

  it('preserves backend validation errors for invalid resume/JD input', async () => {
    mockFetchOnce(() =>
      Promise.resolve(
        jsonResponse(
          {
            error: {
              code: 'INVALID_JOB_DESCRIPTION',
              message: 'Job description is invalid: must be 10-20000 characters',
            },
          },
          400,
        ),
      ),
    );

    const failure = await apiFetch('/resumes/id/analyze-job').catch((err: unknown) => err);
    expect(failure).toBeInstanceOf(ApiClientError);
    expect((failure as ApiClientError).status).toBe(400);
    expect((failure as ApiClientError).code).toBe('INVALID_JOB_DESCRIPTION');
    expect((failure as ApiClientError).message).toContain('Job description is invalid');
  });

  it('preserves backend 5xx errors from analysis-service failures', async () => {
    mockFetchOnce(() =>
      Promise.resolve(
        jsonResponse(
          { error: { code: 'DATABASE_ERROR', message: 'Failed to save job analysis' } },
          500,
        ),
      ),
    );

    const failure = await apiFetch('/resumes/id/analyze-job').catch((err: unknown) => err);
    expect(failure).toBeInstanceOf(ApiClientError);
    expect((failure as ApiClientError).status).toBe(500);
    expect((failure as ApiClientError).code).toBe('DATABASE_ERROR');
  });

  it('maps non-JSON error bodies to a safe fallback instead of leaking raw payloads', async () => {
    mockFetchOnce(
      () => Promise.resolve(new Response('<html>proxy error</html>', { status: 502 })),
    );

    const failure = await apiFetch('/resumes/id/analyze-job').catch((err: unknown) => err);
    expect(failure).toBeInstanceOf(ApiClientError);
    expect((failure as ApiClientError).status).toBe(502);
    expect((failure as ApiClientError).code).toBe('INTERNAL_SERVER_ERROR');
  });

  it('rejects non-JSON success bodies as unexpected responses', async () => {
    mockFetchOnce(
      () => Promise.resolve(new Response('ok', { status: 200, headers: { 'Content-Type': 'text/plain' } })),
    );

    const failure = await apiFetch('/resumes').catch((err: unknown) => err);
    expect(failure).toBeInstanceOf(ApiClientError);
    expect((failure as ApiClientError).code).toBe('UNEXPECTED_RESPONSE');
  });

  it('resolves 204 responses as undefined', async () => {
    mockFetchOnce(() => Promise.resolve(new Response(null, { status: 204 })));

    await expect(apiFetch<void>('/resumes/id')).resolves.toBeUndefined();
  });
});
