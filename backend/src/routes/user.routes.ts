import { Router } from "express";
import ticketRoutes from "./ticket.routes.js";
import reportsRoutes from "./reports.routes.js";

const router = Router();

//! User Routes [ALL Methods /api/users]

//* Expenses Routes [ALL Methods /api/users/expenses]
router.use("/expenses", ticketRoutes);

//* Reports Routes [ALL Methods /api/users/reports]
router.use("/reports", reportsRoutes);

export default router;
