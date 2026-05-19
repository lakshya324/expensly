import { Router } from "express";
import { ReportsController } from "../controllers/reports.controller.js";

const router = Router();

/** GET  /api/users/reports         - list last 5 saved reports */
router.get("/", ReportsController.listReports);

/** GET  /api/users/reports/export  - generate & download CSV */
router.get("/export", ReportsController.exportCsv);

/** POST /api/users/reports/:id/email - email a saved report to the user */
router.post("/:id/email", ReportsController.emailReport);

export default router;
