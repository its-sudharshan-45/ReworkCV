import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeApiUrl } from '@/lib/env';

/**
 * Production connectivity regression.
 *
 * Incident: the deployed SPA showed "Could not reach the server" for every
 * resume call. Live verification showed:
 *   - `GET https://reworkcv-2.onrender.com/` → 404 NOT_FOUND (expected: no
 *     route is mounted at `/`; the API lives under `/api/v1`).
 *   - `GET https://reworkcv-2.onrender.com/api/v1/health` → 200 ok (backend
 *     is up; database ok).
 *   - Same health/resource requests carrying
 *     `Origin: https://reworkcv-kappa.vercel.app` returned no
 *     `access-control-allow-origin` header and preflight returned
 *     `Allow` instead of `204` + ACAO (backend `CORS_ORIGIN` missing the
 *     frontend origin). Browsers reject the fetch promise, which `apiFetch`
 *     maps to NETWORK_ERROR "Could not reach the server."
 *   - `GET https://reworkcv-kappa.vercel.app/api/v1/health` → Vercel 500
 *     FUNCTION_INVOCATION_FAILED (the Vercel backend service is not usable
 *     in this split deployment).
 *
 * Contract locked here:
 *   - Production browsers must call Render directly
 *     (`https://reworkcv-2.onrender.com/api/v1` + `/resumes...`), never the
 *     Vercel `/api` rewrite.
 *   - The deployed bare-host `VITE_API_URL` keeps working only because
 *     `normalizeApiUrl` appends `/api/v1`; the canonical dashboard value
 *     must still include the path.
 *   - The frontend-only `frontend/vercel.json` (SPA fallback) would serve
 *     `index.html` for `/api/*`, so a same-origin `VITE_API_URL=/api/v1`
 *     cannot work on `reworkcv-kappa.vercel.app`.
 */

const RENDER_HOST = 'https://reworkcv-2.onrender.com';
const RENDER_API = 'https://reworkcv-2.onrender.com/api/v1';

function loadJson(relativePath: string): unknown {
  const here = dirname(fileURLToPath(import.meta.url));
  return JSON.parse(readFileSync(resolve(here, relativePath), 'utf8')) as unknown;
}

describe('production connectivity', () => {
  it('recovers the canonical API base from the deployed bare-host VITE_API_URL', () => {
    expect(normalizeApiUrl(RENDER_HOST)).toBe(RENDER_API);
    expect(normalizeApiUrl(`${RENDER_HOST}/`)).toBe(RENDER_API);
  });

  it('builds versioned resume/health paths against the Render base (no double slashes)', () => {
    const base = normalizeApiUrl(RENDER_HOST);
    expect(`${base}/resumes`).toBe(`${RENDER_API}/resumes`);
    expect(`${base}/health`).toBe(`${RENDER_API}/health`);
  });

  it('requires the Vercel frontend-only fallback to leave /api/* to the SPA (proving same-origin cannot reach Render)', () => {
    // frontend/vercel.json in a frontend-only Vercel project: every path,
    // including /api/v1/health, falls back to /index.html. That HTML body
    // is what apiFetch reports as UNEXPECTED_RESPONSE — a different failure
    // from the observed NETWORK_ERROR, confirming production does not (and
    // must not) use same-origin /api in this split deployment.
    const frontendOnly = loadJson('../vercel.json') as {
      rewrites?: Array<{ source?: string; destination?: string }>;
    };
    const catchAll = (frontendOnly.rewrites ?? []).find(
      (r) => r.source === '/(.*)' && r.destination === '/index.html',
    );
    expect(catchAll).toBeDefined();
    const hasApiRewrite = (frontendOnly.rewrites ?? []).some((r) =>
      (r.source ?? '').startsWith('/api'),
    );
    expect(hasApiRewrite).toBe(false);
  });

  it('treats the backend root 404 as expected (API lives under /api/v1)', () => {
    // Guards against misdiagnosing `GET /` → NOT_FOUND as "server down".
    // Only versioned paths are valid; the root intentionally has no route.
    const base = normalizeApiUrl(RENDER_HOST);
    expect(base).toBe(RENDER_API);
    expect(base.endsWith('/api/v1')).toBe(true);
  });
});
