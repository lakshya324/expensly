import { Router } from "express";
import DepartmentController from "../controllers/department.controller.js";
import { validate } from "../middleware/validate.js";
import {
  createDepartmentValidation,
  updateDepartmentValidation,
  updateDepartmentPermissionsValidation,
} from "../validation/department.schema.js";

const router = Router();

//! Department Routes [ALL Methods /api/admin/departments]

//* List Departments [GET /api/admin/departments]
router.get("/", DepartmentController.list);

//* Get Single Department [GET /api/admin/departments/:id]
router.get("/:id", DepartmentController.getOne);

//* Create Department [POST /api/admin/departments]
router.post(
  "/",
  validate(createDepartmentValidation),
  DepartmentController.create,
);

//* Update Department [PATCH /api/admin/departments/:id]
router.patch(
  "/:id",
  validate(updateDepartmentValidation),
  DepartmentController.update,
);

//* Update Department Permissions [PATCH /api/admin/departments/:id/permissions]
router.patch(
  "/:id/permissions",
  validate(updateDepartmentPermissionsValidation),
  DepartmentController.updatePermissions,
);

//* Deactivate Department [DELETE /api/admin/departments/:id]
router.delete("/:id", DepartmentController.deactivate);

//* Reset Department Budget [POST /api/admin/departments/:id/reset-budget]
router.post("/:id/reset-budget", DepartmentController.resetBudget);

//* Get Department Tags [GET /api/admin/departments/:id/tags]
router.get("/:id/tags", DepartmentController.getTags);

//* Remove Department Tag [DELETE /api/admin/departments/:id/tags/:tag]
router.delete("/:id/tags/:tag", DepartmentController.removeTag);

export default router;
