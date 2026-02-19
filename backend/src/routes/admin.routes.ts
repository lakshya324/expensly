import { Router } from "express";
import AdminController from "../controllers/admin.controller.js";
import { validate } from "../middleware/validate.js";
import {
  addDepartmentValidation,
  createUserValidation,
} from "../validation/admin.schema.js";

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

//? Departments

//* List Departments [GET /api/admin/departments]
router.get("/departments", AdminController.listDepartments);

//* Add Department [POST /api/admin/departments]
router.post(
  "/departments",
  validate(addDepartmentValidation),
  AdminController.addDepartment,
);

//* Edit Department [PATCH /api/admin/departments/:id]
router.patch("/departments/:id", AdminController.editDepartment);

//* Delete Department [DELETE /api/admin/departments/:id]
// router.delete('/departments/:id', AdminController.deleteDepartment);

//* Reset Department Spent [POST /api/admin/departments/:id/reset]
router.post("/departments/:id/reset", AdminController.resetDepartmentSpent);

export default router;
