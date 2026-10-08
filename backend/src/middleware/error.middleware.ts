import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { AppError, isAppError } from '../utils/errors.js';

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId?: string;
  };
}

const isProd = env.NODE_ENV === 'production';

export function notFoundHandler(_req: Request, res: Response): void {
  const response: ApiErrorResponse = {
    error: {
      code: 'NOT_FOUND',
      message: 'Resource not found',
      requestId: res.locals.requestId,
    },
  };

  res.status(404).json(response);
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const requestId = res.locals.requestId as string | undefined;

  if (err instanceof ZodError) {
    logger.warn({ requestId, issues: err.issues }, 'Validation error');

    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        // Never redact validation field errors — they are safe to expose.
        details: err.flatten(),
        requestId,
      },
    } satisfies ApiErrorResponse);

    return;
  }

  if (isAppError(err)) {
    const appError: AppError = err;
    const logMethod = appError.statusCode >= 500 ? 'error' : 'warn';
    logger[logMethod](
      { requestId, code: appError.code, details: appError.details },
      appError.message,
    );

    res.status(appError.statusCode).json({
      error: {
        code: appError.code,
        message: appError.message,
        // Redact operational details in production for 5xx errors.
        details: isProd && appError.statusCode >= 500 ? undefined : appError.details,
        requestId,
      },
    } satisfies ApiErrorResponse);

    return;
  }

  logger.error({ requestId, err }, 'Unhandled error');

  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      // In production, never leak internal error messages.
      message: isProd ? 'An unexpected error occurred' : (err instanceof Error ? err.message : 'An unexpected error occurred'),
      requestId,
    },
  } satisfies ApiErrorResponse);
}

