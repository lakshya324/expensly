import { Router } from "express";
import CategoryController from "../controllers/category.controller.js";
import { validate } from "../middleware/validate.js";
import {
  createCategoryValidation,
  updateCategoryValidation,
} from "../validation/category.schema.js";

const router = Router();

//! Category Routes [ALL Methods /api/admin/categories]

//* List Categories [GET /api/admin/categories]
router.get("/", CategoryController.list);

//* Create Category [POST /api/admin/categories]
router.post(
  "/",
  validate(createCategoryValidation),
  CategoryController.create,
);

//* Update Category [PATCH /api/admin/categories/:id]
router.patch(
  "/:id",
  validate(updateCategoryValidation),
  CategoryController.update,
);

//* Delete Category [DELETE /api/admin/categories/:id]
router.delete("/:id", CategoryController.remove);

export default router;
