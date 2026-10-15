import 'dotenv/config';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { parseCorsOrigins } from './config/cors.js';
import { logger } from './config/logger.js';

const app = createApp();

const port = env.PORT ?? env.BACKEND_PORT;

// Sanitized boot diagnostics: the allowlist shape (count only, never the
// origins themselves) makes a missing-frontend-origin misconfiguration
// visible in hosting logs without leaking deployment topology.
logger.info(
  { port, nodeEnv: env.NODE_ENV, corsOriginCount: parseCorsOrigins(env.CORS_ORIGIN).length },
  'UpSkilr API server starting',
);

app.listen(port, '0.0.0.0', () => {
  logger.info({ port }, 'UpSkilr API server started');
});
