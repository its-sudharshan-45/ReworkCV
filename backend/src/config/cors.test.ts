import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Express } from 'express';
import request from 'supertest';
import { isCorsOriginAllowed, parseCorsOrigins } from './cors.js';

describe('parseCorsOrigins', () => {
  it('splits a comma-separated dashboard value and trims whitespace', () => {
    expect(parseCorsOrigins('https://a.example.com, https://b.example.com')).toEqual([
      'https://a.example.com',
      'https://b.example.com',
    ]);
  });

  it('drops empty entries from stray commas', () => {
    expect(parseCorsOrigins('https://a.example.com,, ,https://b.example.com,')).toEqual([
      'https://a.example.com',
      'https://b.example.com',
    ]);
  });

  it('returns an empty list when unset', () => {
    expect(parseCorsOrigins(undefined)).toEqual([]);
    expect(parseCorsOrigins('')).toEqual([]);
  });
});

describe('isCorsOriginAllowed', () => {
  const allowlist = ['https://app.example.com', 'https://preview.example.com'];

  it('allows requests without an Origin header (curl, mobile, server-to-server)', () => {
    expect(isCorsOriginAllowed(undefined, allowlist)).toBe(true);
    expect(isCorsOriginAllowed(undefined, [])).toBe(true);
  });

  it('allows exactly listed origins', () => {
    expect(isCorsOriginAllowed('https://app.example.com', allowlist)).toBe(true);
    expect(isCorsOriginAllowed('https://preview.example.com', allowlist)).toBe(true);
  });

  it('rejects unlisted origins', () => {
    expect(isCorsOriginAllowed('https://evil.example.com', allowlist)).toBe(false);
  });

  it('rejects lookalike origins that merely contain an allowlisted value', () => {
    expect(isCorsOriginAllowed('https://app.example.com.evil.com', allowlist)).toBe(false);
    expect(isCorsOriginAllowed('https://evil-app.example.com', allowlist)).toBe(false);
    expect(isCorsOriginAllowed('https://app.example.com/', allowlist)).toBe(false);
  });
});

describe('production CORS allowlist regression', () => {
  // Incident: the deployed SPA origin was missing from the backend
  // CORS_ORIGIN dashboard value, so every browser API call (upload, process,
  // analyze) was blocked without an Access-Control-Allow-Origin header and
  // the UI could only show "Unable to analyze resume against job
  // description. Please try again." These tests lock the dashboard contract:
  // a comma-separated CORS_ORIGIN must admit each listed https origin
  // through preflight end-to-end while still rejecting unlisted origins.
  const originalCorsOrigin = process.env.CORS_ORIGIN;

  afterEach(() => {
    process.env.CORS_ORIGIN = originalCorsOrigin;
    vi.resetModules();
  });

  async function bootAppWithAllowlist(allowlist: string) {
    process.env.CORS_ORIGIN = allowlist;
    vi.resetModules();
    const { createApp } = await import('../app.js');
    return createApp();
  }

  function preflight(app: Express, origin: string) {
    return request(app)
      .options('/api/v1/resumes')
      .set('Origin', origin)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'authorization,content-type');
  }

  it('answers preflight with ACAO headers for every allowlisted origin', async () => {
    const app = await bootAppWithAllowlist(
      'https://reworkcv-kappa.vercel.app, https://preview.example.com',
    );

    for (const origin of ['https://reworkcv-kappa.vercel.app', 'https://preview.example.com']) {
      const response = await preflight(app, origin);
      expect(response.status).toBe(204);
      expect(response.headers['access-control-allow-origin']).toBe(origin);
    }
  });

  it('still rejects origins outside the allowlist (no ACAO header)', async () => {
    const app = await bootAppWithAllowlist('https://reworkcv-kappa.vercel.app');

    const response = await preflight(app, 'https://evil.example.com');
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });
});
