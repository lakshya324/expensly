// Error Handler Middleware
import { Request, Response, NextFunction } from "express";
import config from "../config/env.config.js";
import { AppError } from "../types/error.types.js";
import {
  IErrorResponseData,
  ResponsePayload,
} from "../types/payloads.types.js";
import { logError } from "../utils/logger.js";

export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  logError(err);

  const statusCode = err.statusCode || 500;
  const errorCode = err.code || "ERROR";
  const message =
    config.nodeEnv === "production" && statusCode === 500
      ? "An unexpected error occurred."
      : err.message || "An error occurred.";
  const details = err.details || undefined;

  const payload: ResponsePayload<IErrorResponseData> = {
    success: false,
    message,
    timestamp: new Date().toISOString(),
    data: {
      code: errorCode,
      details,
    },
  };

  res.status(statusCode).json(payload);
};

/**
 * 404 handler - placed after all routes.
 */
export const notFoundHandler = (req: Request, res: Response): void => {
  const payload: ResponsePayload<IErrorResponseData> = {
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
    timestamp: new Date().toISOString(),
    data: {
      code: "NOT_FOUND",
    },
  };
  res.status(404).json(payload);
};
