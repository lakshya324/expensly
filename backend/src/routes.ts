import express, { Router, Response, NextFunction } from "express";
import { AuthRequest } from "./types/types.js";
import { logInfo } from "./utils/logger.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import exchangeRatesRoutes from "./routes/exchangeRates.routes.js";
import departmentRoutes from "./routes/department.routes.js";
import analyticsRoutes from "./routes/analytics.routes.js";
import userRoutes from "./routes/user.routes.js";
import authRoutes from "./routes/auth.routes.js";
import healthRoutes from "./routes/health.routes.js";
import superAdminRoutes from "./routes/superadmin.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import merchantRoutes from "./routes/merchant.routes.js";
import categoryRoutes from "./routes/category.routes.js";
import bundleRoutes from "./routes/bundle.routes.js";
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

//* Admin: Department Routes [ALL Methods /api/admin/departments]
router.use(
  "/api/admin/departments",
  apiLimiter,
  authenticate,
  authorize(ROLES.ADMIN),
  departmentRoutes,
);

//* Admin: Exchange Rate Routes [ALL Methods /api/admin/exchange-rates]
router.use(
  "/api/admin/exchange-rates",
  apiLimiter,
  authenticate,
  authorize(ROLES.ADMIN),
  exchangeRatesRoutes,
);

//* Admin: Analytics Routes [ALL Methods /api/admin/analytics]
router.use(
  "/api/admin/analytics",
  apiLimiter,
  authenticate,
  authorize(ROLES.ADMIN),
  analyticsRoutes,
);

//* Admin: Merchant Routes [ALL Methods /api/admin/merchants]
//* NOTE: Returns 501 until Merchant Management feature ships
router.use(
  "/api/admin/merchants",
  apiLimiter,
  authenticate,
  authorize(ROLES.ADMIN),
  merchantRoutes,
);

//* Admin: Category Routes [ALL Methods /api/admin/categories]
//* NOTE: Returns 501 until Merchant Management feature ships
router.use(
  "/api/admin/categories",
  apiLimiter,
  authenticate,
  authorize(ROLES.ADMIN),
  categoryRoutes,
);

//* User: Bundle Routes [ALL Methods /api/users/expenses/bundles]
//* NOTE: Returns 501 until Expense Bundling feature ships
router.use(
  "/api/users/expenses/bundles",
  apiLimiter,
  authenticate,
  authorize(ROLES.USER, ROLES.ADMIN),
  bundleRoutes,
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
