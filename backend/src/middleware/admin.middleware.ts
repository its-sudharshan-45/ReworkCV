import { timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';

/**
 * Require the RAG admin API key (x-admin-api-key) using a constant-time
 * comparison. In production, when no admin key is configured, deny by
 * default so sensitive operations (codebase scan, drift checks, knowledge
 * ingestion) are never exposed to any authenticated user. In development
 * and test, fall through so local workflows keep working.
 */
export function requireAdminKey(req: Request, _res: Response, next: NextFunction): void {
  const adminApiKey = env.RAG_ADMIN_API_KEY;

  if (!adminApiKey) {
    if (env.NODE_ENV === 'production') {
      next(new AppError('Admin authorization required', 403, 'AUTHORIZATION_ERROR'));
      return;
    }
    next();
    return;
  }

  const provided = Buffer.from(req.header('x-admin-api-key') ?? '');
  const expected = Buffer.from(adminApiKey);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    next(new AppError('Admin authorization required', 403, 'AUTHORIZATION_ERROR'));
    return;
  }

  next();
}
