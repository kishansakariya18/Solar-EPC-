import cors from 'cors';
import express from 'express';
import { env } from './env';
import { errorHandler } from './middleware/error';
import { router } from './routes';

export function createApp() {
  const app = express();
  app.use(cors({ origin: env.webOrigin }));
  app.use(express.json({ limit: '1mb' }));
  app.get('/health', (_req, res) => res.json({ ok: true }));
  app.use('/api', router);
  app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
  app.use(errorHandler);
  return app;
}
