import type { NextFunction, Request, Response } from 'express';
import crypto from 'node:crypto';
import { logger } from '../config/logger.js';

declare module 'express-serve-static-core' {
  interface Request {
    id: string;
  }
}

/** Assigns/propagates a correlation id and logs method/path/status/duration for every request. */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.headers['x-request-id'];
  req.id = typeof incoming === 'string' && incoming.trim() ? incoming.trim().slice(0, 100) : crypto.randomUUID();
  res.setHeader('X-Request-ID', req.id);

  const startedAt = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Math.round(Number(process.hrtime.bigint() - startedAt) / 1e6);
    logger.info('HTTP request', {
      requestId: req.id,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs,
    });
  });

  next();
}
