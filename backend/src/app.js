// Express Application Setup
import express from 'express';
import { corsMiddleware } from './middleware/cors.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

// Import routes
import healthRoutes from './routes/health.routes.js';
import exchangeRatesRoutes from './routes/exchangeRates.routes.js';
import ticketRoutes from './routes/ticket.routes.js';
import { createAdminRoutes } from './routes/admin.routes.js';

export function createApp(wss) {
  const app = express();

  // Middleware
  app.use(corsMiddleware);
  app.use(express.json());

  // Mount routes
  app.use('/api', healthRoutes);
  app.use('/api', exchangeRatesRoutes);
  app.use('/api', ticketRoutes);
  app.use('/api', createAdminRoutes(wss));

  // Catch-all route (universal 200 response for dummy endpoints)
  app.use(notFoundHandler);

  // Error handling middleware (should be last)
  app.use(errorHandler);

  return app;
}
