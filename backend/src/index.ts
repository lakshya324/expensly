import express from "express";

import logs from "./logs.js";
import router from "./routes.js";
import databases from "./databases.js";
import setupEnvironment from "./setup.js";
import middlewares from "./middlewares.js";
import config from "./config/env.config.js";
import { logError, logSuccess } from "./utils/logger.js";
import { initializeSocket } from "./socket.js";

// Setup Environment
setupEnvironment();

const app = express();

// Server Middlewares
middlewares(app);

// Logging
logs(app);

// Routes
app.use(router);

// Connect to Database and Start Server with Socket
databases()
  .then(async () => {
    const server = initializeSocket(app);
    server.listen(config.port, () =>
      logSuccess(`Server started on port ${config.port}`),
    );
  })
  .catch((err) =>
    logError(err, {
      message: "Failed to start server",
      status: 500,
      code: "SERVER_START_FAILED",
    }),
  );
