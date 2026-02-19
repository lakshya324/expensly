// Reports Routes — mounted at /api/reports
import { Router } from "express";
import { ReportsController } from "../controllers/reports.controller.js";
import { authenticate } from "../middleware/auth.js";
import { authorize } from "../middleware/authorize.js";
import { ROLES } from "../config/constants.js";

const router = Router();

router.get("/export", ReportsController.exportCsv);

export default router;
