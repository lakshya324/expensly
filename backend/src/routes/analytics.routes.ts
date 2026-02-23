import { Router } from "express";
import AnalyticsController from "../controllers/analytics.controller.js";

const router = Router();

//! Analytics Routes [ALL Methods /api/admin/analytics]

//* Get Org Analytics [GET /api/admin/analytics]
router.get("/", AnalyticsController.getAnalytics);

//* Refresh Org Analytics [POST /api/admin/analytics/refresh]
router.post("/refresh", AnalyticsController.refreshAnalytics);

export default router;
