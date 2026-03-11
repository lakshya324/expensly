import { Router } from "express";
import AdminController from "../controllers/admin.controller.js";
import { validate } from "../middleware/validate.js";
import { createUserValidation } from "../validation/admin.schema.js";
import { updateUserPermissionsValidation } from "../validation/department.schema.js";

const router = Router();

//! Admin Routes [ALL Methods /api/admin]

//? Users

//* List Users [GET /api/admin/users]
router.get("/users", AdminController.listUsers);

//* Create User [POST /api/admin/users]
router.post(
  "/users",
  validate(createUserValidation),
  AdminController.createUser,
);

//* Edit User [PUT /api/admin/users/:id]
router.put("/users/:id", AdminController.editUser);

//* Disable/Enable User [PATCH /api/admin/users/:id/disable]
router.patch("/users/:id/disable", AdminController.toggleUserStatus);

//* Update User Permissions [PATCH /api/admin/users/:id/permissions]
router.patch(
  "/users/:id/permissions",
  validate(updateUserPermissionsValidation),
  AdminController.updateUserPermissions,
);

//* Audit Log [GET /api/admin/audit-log]
router.get("/audit-log", AdminController.getAuditLog);

export default router;
