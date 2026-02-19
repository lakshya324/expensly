import { Router } from "express";
import SuperAdminController from "../controllers/superadmin.controller.js";

const router = Router();

//! Super Admin Routes [ALL Methods /api/superadmin]

//* List Organizations [GET /api/superadmin/organizations]
router.get("/organizations", SuperAdminController.listOrganizations);

//* Disable/Enable Organization [PATCH /api/superadmin/organizations/:id/disable]
router.patch(
  "/organizations/:id/disable",
  SuperAdminController.toggleOrgStatus,
);

//* List All Users [GET /api/superadmin/users]
router.get("/users", SuperAdminController.listAllUsers);

export default router;
