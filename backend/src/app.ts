// Express Application Setup
import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';

import { corsMiddleware } from './middleware/cors.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

// Routes
import healthRoutes from './routes/health.routes.js';
import exchangeRatesRoutes from './routes/exchangeRates.routes.js';
import authRoutes from './routes/auth.routes.js';
import ticketRoutes from './routes/ticket.routes.js';
import adminRoutes from './routes/admin.routes.js';
import superAdminRoutes from './routes/superadmin.routes.js';
import reportsRoutes from './routes/reports.routes.js';

export function createApp(): express.Application {
  const app = express();

  // ── Security ──────────────────────────────────────────────────────────────
  app.use(helmet());
  app.use(corsMiddleware);

  // ── Rate Limiting ─────────────────────────────────────────────────────────
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests' } },
  });
  const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests' } },
  });

  // ── Body Parsing ──────────────────────────────────────────────────────────
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // ── Routes ────────────────────────────────────────────────────────────────
  app.use('/api', apiLimiter, healthRoutes);
  app.use('/api', exchangeRatesRoutes); // SSE — no rate limit

  app.use('/api/auth', authLimiter, authRoutes);
  app.use('/api/expenses', apiLimiter, ticketRoutes);
  app.use('/api/admin', apiLimiter, adminRoutes);
  app.use('/api/superadmin', apiLimiter, superAdminRoutes);
  app.use('/api/reports', apiLimiter, reportsRoutes);

  // FE bug workaround: admin-departments.js calls /api/api/admin/departments
  app.use('/api/api/admin', apiLimiter, adminRoutes);

  // ── 404 + Error Handlers ──────────────────────────────────────────────────
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
