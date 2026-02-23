import { Router } from "express";
import ticketRoutes from "./ticket.routes.js";
import reportsRoutes from "./reports.routes.js";
import DepartmentController from "../controllers/department.controller.js";

const router = Router();

//! User Routes [ALL Methods /api/users]

//* Expenses Routes [ALL Methods /api/users/expenses]
router.use("/expenses", ticketRoutes);

//* Reports Routes [ALL Methods /api/users/reports]
router.use("/reports", reportsRoutes);

//* List Departments (user view) [GET /api/users/departments]
router.get("/departments", DepartmentController.listForUser);

//* Get Department Tags [GET /api/users/departments/:id/tags]
router.get("/departments/:id/tags", DepartmentController.getTags);

export default router;
