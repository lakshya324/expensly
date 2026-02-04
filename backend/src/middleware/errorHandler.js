// Error Handler Middleware
// Catches all errors and returns consistent error responses

import { config } from "../config/env";

export const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    success: false,
    message,
    error: config.nodeEnv === 'development' ? err.stack : undefined,
  });
};

// 404 Not Found Handler
export const notFoundHandler = (req, res) => {
  console.log(`Received REST request: ${req.method} ${req.originalUrl}`);
  res.status(200).json({
    success: true,
    message: "This is a dummy response from Expensly backend.",
    timestamp: new Date().toISOString(),
    data: {},
  });
};
