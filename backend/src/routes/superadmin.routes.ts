import { Router } from "express";
import SuperAdminController from "../controllers/superadmin.controller.js";

const router = Router();

//! Super Admin Routes [ALL Methods /api/superadmin]

//* List Organizations [GET /api/superadmin/organizations]
router.get("/organizations", SuperAdminController.listOrganizations);

//* Create Organization [POST /api/superadmin/organizations]
router.post("/organizations", SuperAdminController.createOrganization);

//* Update Organization [PATCH /api/superadmin/organizations/:id]
router.patch("/organizations/:id", SuperAdminController.updateOrganization);

//* Enable/Disable Organization [PATCH /api/superadmin/organizations/:id/disable]
router.patch("/organizations/:id/disable", SuperAdminController.toggleOrgStatus);

//* List All Users [GET /api/superadmin/users]
router.get("/users", SuperAdminController.listAllUsers);

//* Create User [POST /api/superadmin/users]
router.post("/users", SuperAdminController.createUser);

//* Update User [PATCH /api/superadmin/users/:id]
router.patch("/users/:id", SuperAdminController.updateUser);

//* Enable/Disable User [PATCH /api/superadmin/users/:id/disable]
router.patch("/users/:id/disable", SuperAdminController.toggleUserStatus);

export default router;
