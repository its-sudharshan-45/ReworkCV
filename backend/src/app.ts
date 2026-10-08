import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { AppError } from './utils/errors.js';
import { correlationLogger, httpLogger } from './middleware/logging.middleware.js';
import { requestIdMiddleware } from './middleware/request-id.middleware.js';
import { errorHandler, notFoundHandler } from './middleware/error.middleware.js';
import { apiRouter } from './routes/index.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
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
        if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
          callback(null, true);
          return;
        }

        callback(null, false);
      },
      credentials: true,
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

  app.use('/api/v1', apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
