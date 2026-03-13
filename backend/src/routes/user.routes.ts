import { Router } from "express";
import ticketRoutes from "./ticket.routes.js";
import reportsRoutes from "./reports.routes.js";
import bundleRoutes from "./bundle.routes.js";
import receiptRoutes from "./receipt.routes.js";
import DepartmentController from "../controllers/department.controller.js";
import MerchantController from "../controllers/merchant.controller.js";
import CategoryController from "../controllers/category.controller.js";

const router = Router();

//! User Routes [ALL Methods /api/users]

//* Expenses Routes [ALL Methods /api/users/expenses]
router.use("/expenses", ticketRoutes);

//* Bundle Routes [ALL Methods /api/users/bundles]
router.use("/bundles", bundleRoutes);

//* Receipt Routes [ALL Methods /api/users/receipts]
router.use("/receipts", receiptRoutes);

//* Reports Routes [ALL Methods /api/users/reports]
router.use("/reports", reportsRoutes);

//* List Departments (user view) [GET /api/users/departments]
router.get("/departments", DepartmentController.listForUser);

//* Get Department Tags [GET /api/users/departments/:id/tags]
router.get("/departments/:id/tags", DepartmentController.getTags);

//* List Merchants (user view) [GET /api/users/merchants]
router.get("/merchants", MerchantController.list);

//* List Categories (user view) [GET /api/users/categories]
router.get("/categories", CategoryController.list);

export default router;
