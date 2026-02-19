import express, { Router, Request, Response, NextFunction } from "express";
import { AuthRequest } from "./types/types.js";
import { logInfo } from "./utils/logger.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import exchangeRatesRoutes from "./routes/exchangeRates.routes.js";
import userRoutes from "./routes/user.routes.js";
import authRoutes from "./routes/auth.routes.js";
import healthRoutes from "./routes/health.routes.js";
import superAdminRoutes from "./routes/superadmin.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import { apiLimiter, authLimiter } from "./middleware/rateLimiter.js";
import { authenticate } from "./middleware/auth.js";
import { authorize } from "./middleware/authorize.js";
import { ROLES } from "./config/constants.js";

const router: Router = express.Router();

//! Log Middleware
router.use((req: AuthRequest, res: Response, next: NextFunction) => {
  logInfo(
    `${req.method} ${req.originalUrl} - User: ${req.user ? req.user._id.toString() : "Guest"} - IP: ${req.ip}`,
  );
  next();
});

//! Routes

//* Health APIs [ALL Methods /api/health]
router.use("/api/health", apiLimiter, healthRoutes);

// //* Exchange Rates (SSE) [ALL Methods /api/exchange-rates]
// router.use("/api/exchange-rates", exchangeRatesRoutes);
// // Note: No rate limiting on exchange rates since it's a streaming endpoint and doesn't cause heavy load

//* Auth APIs [ALL Methods /api/auth]
router.use("/api/auth", authLimiter, authRoutes);

//* User Routes [ALL Methods /api/users]
router.use(
  "/api/users",
  apiLimiter,
  authenticate,
  authorize(ROLES.USER, ROLES.ADMIN),
  userRoutes,
);

//* Admin Routes [ALL Methods /api/admin]
router.use(
  "/api/admin",
  apiLimiter,
  authenticate,
  authorize(ROLES.ADMIN),
  adminRoutes,
);

//* Super Admin Routes [ALL Methods /api/superadmin]
router.use(
  "/api/superadmin",
  apiLimiter,
  authenticate,
  authorize(ROLES.SUPER_ADMIN),
  superAdminRoutes,
);

//! 404 Middleware
router.use(notFoundHandler);

//! Error Handling Middleware
router.use(errorHandler);

export default router;
