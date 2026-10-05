import type { NextFunction, Request, Response } from 'express';
import { ApiError, Errors } from '../models/errors.js';
import { logger } from '../config/logger.js';

export function notFoundHandler(req: Request, res: Response, next: NextFunction): void {
  next(Errors.notFound());
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Express requires the 4-arg signature.
export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction): void {
  let apiError: ApiError;

  if (err instanceof ApiError) {
    apiError = err;
  } else if (err && typeof err === 'object' && 'type' in err && (err as { type?: string }).type === 'entity.too.large') {
    apiError = Errors.validation('Request body is too large.');
  } else if (err instanceof SyntaxError) {
    apiError = Errors.validation('Request body is not valid JSON.');
  } else {
    apiError = Errors.internal();
  }

  const message = err instanceof Error ? err.message : String(err);
  const logPayload = { requestId: req.id, statusCode: apiError.statusCode, code: apiError.code, message };

  if (apiError.statusCode >= 500) {
    logger.error('Request failed', { ...logPayload, stack: err instanceof Error ? err.stack : undefined });
  } else {
    logger.warn('Request rejected', logPayload);
  }

  res.status(apiError.statusCode).json({
    success: false,
    error: apiError.code,
    message: apiError.message,
    requestId: req.id,
  });
}
