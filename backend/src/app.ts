import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { AppError } from './utils/errors.js';
import { correlationLogger, httpLogger } from './middleware/logging.middleware.js';
import { requestIdMiddleware } from './middleware/request-id.middleware.js';
import { errorHandler, notFoundHandler } from './middleware/error.middleware.js';
import { apiLimiter } from './middleware/rate-limit.middleware.js';
import { apiRouter } from './routes/index.js';

export function createApp() {
  const app = express();

  // Behind a reverse proxy / LB (production TLS termination), client IPs
  // come from X-Forwarded-For. Trust only the first hop so express-rate-limit
  // keys by real client IP without allowing spoofed-header bypass.
  app.set('trust proxy', 1);

  app.disable('x-powered-by');
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
      frameguard: { action: 'deny' },
      hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
      referrerPolicy: { policy: 'no-referrer' },
    }),
  );
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
        if (!origin) {
          callback(null, true);
          return;
        }

        // In development or test mode, automatically permit any localhost / 127.0.0.1 port (3000, 3001, etc.)
        if (env.NODE_ENV !== 'production' && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
          callback(null, true);
          return;
        }

        const allowedOrigins = env.CORS_ORIGIN.split(',').map((o) => o.trim());
        // Never treat '*' as an allowed origin: with credentials enabled the
        // browser would send cookies/Authorization to any site (credential
        // leakage). Configure explicit origins instead.
        if (allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }

        callback(null, false);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'X-Admin-Api-Key'],
      maxAge: 600,
      optionsSuccessStatus: 204,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  // Map JSON body-parser failures (malformed JSON, payload too large) to
  // structured API errors instead of leaking raw parser HTML/500s.
  app.use(
    (
      err: unknown,
      _req: express.Request,
      _res: express.Response,
      next: express.NextFunction,
    ): void => {
      if (err instanceof SyntaxError && 'body' in (err as unknown as Record<string, unknown>)) {
        next(new AppError('Malformed JSON request body', 400, 'VALIDATION_ERROR'));
        return;
      }
      const status = (err as { status?: unknown; type?: unknown } | null)?.status;
      const type = (err as { status?: unknown; type?: unknown } | null)?.type;
      if (status === 413 || type === 'entity.too.large') {
        next(
          new AppError('Request body exceeds the 1mb limit', 413, 'INVALID_JOB_DESCRIPTION'),
        );
        return;
      }
      next(err);
    },
  );
  app.use(requestIdMiddleware);
  app.use(httpLogger);
  app.use(correlationLogger);

  app.use('/api/v1', apiLimiter, apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
