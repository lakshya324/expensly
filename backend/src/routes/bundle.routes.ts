import { Router } from "express";
import BundleController from "../controllers/bundle.controller.js";
import { validate } from "../middleware/validate.js";
import {
  createBundleValidation,
  updateBundleValidation,
} from "../validation/bundle.schema.js";

const router = Router();

//! Bundle Routes [ALL Methods /api/users/expenses/bundles]
//! NOTE: All endpoints return 501 Not Implemented until Expense Bundling ships.

//* List Bundles [GET /api/users/expenses/bundles]
router.get("/", BundleController.list);

//* Get Bundle [GET /api/users/expenses/bundles/:id]
router.get("/:id", BundleController.getOne);

//* Create Bundle [POST /api/users/expenses/bundles]
router.post("/", validate(createBundleValidation), BundleController.create);

//* Update Bundle [PATCH /api/users/expenses/bundles/:id]
router.patch(
  "/:id",
  validate(updateBundleValidation),
  BundleController.update,
);

//* Submit Bundle [POST /api/users/expenses/bundles/:id/submit]
router.post("/:id/submit", BundleController.submit);

//* Delete Bundle [DELETE /api/users/expenses/bundles/:id]
router.delete("/:id", BundleController.remove);

export default router;
