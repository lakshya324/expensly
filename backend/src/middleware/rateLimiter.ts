import rateLimit from "express-rate-limit";
import {
  IErrorResponseData,
  ResponsePayload,
} from "../types/payloads.types.js";
import config from "../config/env.config.js";

export const authLimiter = rateLimit({
  windowMs: config.ratelimit.auth.windowMs,
  max: config.ratelimit.auth.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many login attempts. Please try again later.",
    timestamp: new Date().toISOString(),
    data: { code: "RATE_LIMITED" },
  } as ResponsePayload<IErrorResponseData>,
});

export const apiLimiter = rateLimit({
  windowMs: config.ratelimit.api.windowMs,
  max: config.ratelimit.api.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests. Please try again later.",
    timestamp: new Date().toISOString(),
    data: { code: "RATE_LIMITED" },
  } as ResponsePayload<IErrorResponseData>,
});
