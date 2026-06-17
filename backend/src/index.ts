import express from "express";

import logs from "./logs.js";
import router from "./routes.js";
import databases from "./databases.js";
import setupEnvironment from "./setup.js";
import middlewares from "./middlewares.js";
import config from "./config/env.config.js";
import { logError, logSuccess } from "./utils/logger.js";
import { initializeSocket } from "./socket.js";
import { startCronJobs } from "./cron.js";
import { mountSwagger } from "./swagger.js";
import mongoose from "mongoose";
import getRedisClient from "./config/redis.config.js";

// Setup Environment
setupEnvironment();

const app = express();

// Server Middlewares
middlewares(app);

// Logging
logs(app);

// Swagger UI (development only)
mountSwagger(app);

// Routes
app.use(router);

// Connect to Database and Start Server with Socket
databases()
  .then(async () => {
    const server = initializeSocket(app);
    server.listen(config.port, () =>
      logSuccess(`Server started on port ${config.port}`),
    );
    startCronJobs();

    const shutdown = (signal: string) => {
      logSuccess("Graceful shutdown started", { signal });
      server.close(() => {
        Promise.allSettled([
          mongoose.disconnect(),
          getRedisClient().quit(),
        ]).finally(() => {
          logSuccess("Graceful shutdown completed", { signal });
          process.exit(0);
        });
      });
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  })
  .catch((err) =>
    logError(err, {
      message: "Failed to start server",
      status: 500,
      code: "SERVER_START_FAILED",
    }),
  );
