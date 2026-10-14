import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Deployment routing regression tests.
 *
 * Incident: direct requests to client-side routes (notably /auth/callback
 * after Google sign-in) returned Vercel 404 because nothing rewrote them to
 * the SPA shell. These tests lock the vercel.json routing contract:
 *   - /api/* always reaches the backend service (never the SPA fallback),
 *   - every other path lands in the frontend service with an index.html
 *     fallback (never a service 404),
 *   - static assets keep working via an explicit filesystem checkpoint.
 */

interface ServiceRewrite {
  handle?: string;
  source?: string;
  destination?: string | { service: string; path?: string };
}

interface ServiceConfig {
  root: string;
  framework?: string;
  rewrites?: ServiceRewrite[];
}

interface RootRewrite {
  handle?: string;
  source?: string;
  destination?: string | { service: string; path?: string };
}

interface VercelConfig {
  services?: Record<string, ServiceConfig>;
  rewrites?: RootRewrite[];
}

function loadRootConfig(): VercelConfig {
  const configPath = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'vercel.json');
  return JSON.parse(readFileSync(configPath, 'utf8')) as VercelConfig;
}

function loadFrontendConfig(): VercelConfig {
  const configPath = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'vercel.json');
  return JSON.parse(readFileSync(configPath, 'utf8')) as VercelConfig;
}

/** Minimal matcher for the source patterns this project uses. */
function sourceMatches(source: string, requestPath: string): boolean {
  if (source === '/(.*)') return true;
  if (/^\/api\/\(\.\*\)$/.test(source)) {
    return requestPath === '/api' || requestPath.startsWith('/api/');
  }
  throw new Error(`Unsupported source pattern in test matcher: ${source}`);
}

type Resolution =
  | { target: 'backend' }
  | { target: 'frontend-file-or-spa' }
  | { target: 'frontend-404' };

/**
 * Simulates Vercel routing from the committed config: top-level rewrites
 * first, then the frontend service's own rules. Anything reaching no rule
 * inside the frontend service is the service's own 404 (the reported bug).
 */
function resolveRequest(config: VercelConfig, requestPath: string): Resolution {
  for (const rule of config.rewrites ?? []) {
    if (rule.handle || !rule.source || !sourceMatches(rule.source, requestPath)) continue;
    const dest = rule.destination;
    if (dest === '/index.html') return { target: 'frontend-file-or-spa' };
    if (typeof dest === 'object' && dest !== null) {
      if (dest.service === 'backend') return { target: 'backend' };
      if (dest.service === 'frontend') {
        if (dest.path === '/index.html') return { target: 'frontend-file-or-spa' };
        for (const serviceRule of config.services?.frontend?.rewrites ?? []) {
          if (serviceRule.handle) continue;
          if (!serviceRule.source || !sourceMatches(serviceRule.source, requestPath)) continue;
          if (serviceRule.destination === '/index.html') {
            return { target: 'frontend-file-or-spa' };
          }
        }
        return { target: 'frontend-404' };
      }
    }
  }
  throw new Error(`No top-level rewrite matched ${requestPath}`);
}

describe('vercel deployment routing', () => {
  const config = loadRootConfig();
  const frontendConfig = loadFrontendConfig();

  it('routes the OAuth callback to the SPA instead of a 404', () => {
    expect(resolveRequest(config, '/auth/callback')).toEqual({
      target: 'frontend-file-or-spa',
    });
  });

  it('serves every client-side route from the SPA shell', () => {
    for (const path of [
      '/',
      '/login',
      '/signup',
      '/forgot-password',
      '/reset-password',
      '/analysis',
      '/resume/report/resume-1/analysis-1',
    ]) {
      expect(resolveRequest(config, path), path).toEqual({ target: 'frontend-file-or-spa' });
    }
  });

  it('keeps API traffic on the backend service', () => {
    for (const path of ['/api/v1/health', '/api/v1/resumes', '/api/v1/rag']) {
      expect(resolveRequest(config, path), path).toEqual({ target: 'backend' });
    }
  });

  it('leaves static assets servable from the frontend service', () => {
    for (const path of ['/assets/index-abc123.js', '/vite.svg', '/favicon.ico']) {
      expect(resolveRequest(config, path), path).toEqual({ target: 'frontend-file-or-spa' });
    }
  });

  it('orders the backend rewrite before the frontend catch-all', () => {
    const rewrites = config.rewrites ?? [];
    const apiIndex = rewrites.findIndex(
      (r) => typeof r.destination === 'object' && r.destination?.service === 'backend',
    );
    const catchAllIndex = rewrites.findIndex(
      (r) =>
        r.source === '/(.*)' &&
        typeof r.destination === 'object' &&
        r.destination?.service === 'frontend',
    );
    expect(apiIndex).toBeGreaterThanOrEqual(0);
    expect(catchAllIndex).toBeGreaterThan(apiIndex);
  });

  it('keeps service rewrites within the Vercel services schema', () => {
    // Vercel rejects unknown properties in service rewrites (e.g. `handle`
    // is top-level only). Only source/destination-style keys are allowed.
    const allowedKeys = new Set(['source', 'destination', 'has', 'missing']);
    for (const [name, service] of Object.entries(config.services ?? {})) {
      for (const rule of service.rewrites ?? []) {
        for (const key of Object.keys(rule)) {
          expect(allowedKeys.has(key), `${name} rewrite key "${key}"`).toBe(true);
        }
      }
    }
  });

  it('falls back to the SPA shell inside the frontend service', () => {
    const serviceRewrites = config.services?.frontend?.rewrites ?? [];
    const fallback = serviceRewrites.find(
      (r) => r.source === '/(.*)' && r.destination === '/index.html',
    );
    expect(fallback).toBeDefined();
  });

  it('declares both services with the expected roots', () => {
    expect(config.services?.backend?.root).toBe('backend');
    expect(config.services?.frontend?.root).toBe('frontend');
  });

  it('keeps a fallback when Vercel Root Directory is set to frontend', () => {
    expect(frontendConfig.rewrites).toEqual([
      { source: '/(.*)', destination: '/index.html' },
    ]);
  });

  it('would have caught the incident: no service fallback means a service 404', () => {
    const brokenConfig: VercelConfig = {
      services: {
        backend: { root: 'backend', framework: 'express' },
        frontend: { root: 'frontend', framework: 'vite' },
      },
      rewrites: [
        { source: '/api/(.*)', destination: { service: 'backend' } },
        { source: '/(.*)', destination: { service: 'frontend' } },
      ],
    };
    expect(resolveRequest(brokenConfig, '/auth/callback')).toEqual({
      target: 'frontend-404',
    });
    expect(resolveRequest(brokenConfig, '/api/v1/health')).toEqual({ target: 'backend' });
  });
});
