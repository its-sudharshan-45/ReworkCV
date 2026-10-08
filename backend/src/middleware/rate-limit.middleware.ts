import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

// Rate limiting is relaxed in tests so suites stay deterministic.
const skipInTest = (): boolean => env.NODE_ENV === 'test';

/**
 * Rate limiters (API-abuse protection).
 *
 * - `apiLimiter`: broad guard on every /api/v1 request (high ceiling so
 *   normal multi-tab use is unaffected).
 * - `aiLimiter`: strict guard on LLM/GPU-costly endpoints (analyze, process,
 *   cover-letter generate/rewrite, AI coach chat, RAG analyze). These fan out
 *   to paid providers and heavy local inference — unbounded calls = cost and
 *   resource-exhaustion DoS.
 *
 * Responses use the standard RateLimit-* headers; bodies stay JSON.
 */
export const apiLimiter = rateLimit({
  windowMs: 60_000,
  limit: 300,
  skip: skipInTest,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many requests. Please slow down and try again shortly.',
    },
  },
});

export const aiLimiter = rateLimit({
  windowMs: 60_000,
  limit: 20,
  skip: skipInTest,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMITED',
      message: 'AI request budget exceeded for this minute. Please try again shortly.',
    },
  },
});

export const authBurstLimiter = rateLimit({
  windowMs: 60_000,
  limit: 60,
  skip: skipInTest,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many requests. Please slow down and try again shortly.',
    },
  },
});

/**
 * `adminLimiter`: strict guard on admin-key endpoints (RAG ingest/reindex/
 * delete, AI model scan/drift). These are sensitive and infrequent — a tight
 * budget blunts admin-key brute force without affecting normal use.
 */
export const adminLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 100,
  skip: skipInTest,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many admin requests. Please try again later.',
    },
  },
});
