import 'dotenv/config';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';

const app = createApp();

const port = env.PORT ?? env.BACKEND_PORT;

app.listen(port, '0.0.0.0', () => {
  logger.info({ port }, 'UpSkilr API server started');
});
