import { Router } from "express";
import BundleController from "../controllers/bundle.controller.js";
import { validate } from "../middleware/validate.js";
import {
  createBundleValidation,
  updateBundleValidation,
  updateBundleStatusValidation,
} from "../validation/bundle.schema.js";

const router = Router();

//! Bundle Routes [ALL Methods /api/users/bundles]

//* List Bundles [GET /api/users/bundles]
router.get("/", BundleController.list);

//* Get Bundle [GET /api/users/bundles/:id]
router.get("/:id", BundleController.getOne);

//* Create Bundle [POST /api/users/bundles]
router.post("/", validate(createBundleValidation), BundleController.create);

//* Update Bundle [PATCH /api/users/bundles/:id]
router.patch(
  "/:id",
  validate(updateBundleValidation),
  BundleController.update,
);

//* Submit Bundle [POST /api/users/bundles/:id/submit]
router.post("/:id/submit", BundleController.submit);

//* Approve / Reject Bundle [PATCH /api/users/bundles/:id/status]
router.patch(
  "/:id/status",
  validate(updateBundleStatusValidation),
  BundleController.updateStatus,
);

//* Delete Bundle [DELETE /api/users/bundles/:id]
router.delete("/:id", BundleController.remove);

export default router;
