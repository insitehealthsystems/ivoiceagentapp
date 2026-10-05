import express, { type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

import type { AppConfig } from './config/environment.js';
import { attachServices } from './services/registry.js';
import { requestLogger } from './middleware/requestLogger.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { healthRouter } from './routes/health.routes.js';
import { conversationRouter } from './routes/conversation.routes.js';
import { speechRouter } from './routes/speech.routes.js';

export function createApp(config: AppConfig): Express {
  const app = express();
  attachServices(app, config);

  app.disable('x-powered-by');
  app.use(requestLogger);
  app.use(helmet());
  app.use(cors({ origin: config.clientOrigin }));

  const limiter = rateLimit({
    windowMs: config.rateLimitWindowMs,
    max: config.rateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'RATE_LIMITED', message: 'Too many requests. Please slow down.' },
  });
  app.use('/api', limiter);

  app.use('/api/health', healthRouter);

  // JSON parsing applies to the conversation/session/synthesize routes.
  // /api/speech/transcribe overrides this with a raw-body parser scoped to
  // just that route (see speech.routes.ts) -- express.json() no-ops when
  // the request's Content-Type isn't application/json, so there's no
  // conflict between the two.
  app.use('/api', express.json({ limit: '100kb' }));
  app.use('/api', conversationRouter);
  app.use('/api', speechRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
