// Error Handler Middleware
import { Request, Response, NextFunction } from 'express';
import { config } from '../config/env.js';
import { AppError } from '../types/errors.js';

// Re-export AppError and createError for backwards compat with controllers/services
export { AppError } from '../types/errors.js';

/**
 * Creates a structured AppError.
 * Usage: throw createError(400, 'Bad Request', 'BAD_REQUEST')
 */
export const createError = (
  statusCode: number,
  message: string,
  code: string | number = 'ERROR'
): AppError => new AppError(statusCode, message, code);

/**
 * Global error handler — must have 4 params for Express to treat it as error middleware.
 */
export const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void => {
  if (err instanceof Error) {
    console.error('[Error]', err.message);
  } else {
    console.error('[Error]', err);
  }

  // Type-narrow for duck-typed Multer / Mongoose errors
  const anyErr = err as Record<string, unknown>;

  // Multer errors
  if (anyErr['code'] === 'LIMIT_FILE_SIZE') {
    res.status(400).json({
      success: false,
      error: { code: 'FILE_TOO_LARGE', message: 'Receipt file must be under 5 MB' },
    });
    return;
  }

  // Mongoose validation errors
  if (anyErr['name'] === 'ValidationError') {
    const errors = anyErr['errors'] as Record<string, { path: string; message: string }>;
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: Object.values(errors).map((e) => ({ field: e.path, message: e.message })),
      },
    });
    return;
  }

  // Mongoose duplicate key (code is a number: 11000)
  if (anyErr['code'] === 11000) {
    const keyValue = anyErr['keyValue'] as Record<string, unknown> | undefined;
    const field = keyValue ? Object.keys(keyValue)[0] : 'field';
    res.status(409).json({
      success: false,
      error: { code: 'DUPLICATE_KEY', message: `${field} already exists` },
    });
    return;
  }

  const statusCode = typeof anyErr['statusCode'] === 'number' ? anyErr['statusCode'] : 500;
  const message =
    err instanceof Error ? err.message : 'Internal Server Error';
  const code =
    typeof anyErr['code'] === 'string' || typeof anyErr['code'] === 'number'
      ? anyErr['code']
      : 'SERVER_ERROR';

  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      ...(config.nodeEnv === 'development' && err instanceof Error && { stack: err.stack }),
    },
  });
};

/**
 * 404 handler — placed after all routes.
 */
export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.originalUrl} not found`,
    },
  });
};
