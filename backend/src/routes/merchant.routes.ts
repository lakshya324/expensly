import { Router } from "express";
import MerchantController from "../controllers/merchant.controller.js";
import { validate } from "../middleware/validate.js";
import {
  createMerchantValidation,
  updateMerchantValidation,
} from "../validation/merchant.schema.js";

const router = Router();

//! Merchant Routes [ALL Methods /api/admin/merchants]

//* List Merchants [GET /api/admin/merchants]
router.get("/", MerchantController.list);

//* Create Merchant [POST /api/admin/merchants]
router.post("/", validate(createMerchantValidation), MerchantController.create);

//* Update Merchant [PATCH /api/admin/merchants/:id]
router.patch(
  "/:id",
  validate(updateMerchantValidation),
  MerchantController.update,
);

//* Delete Merchant [DELETE /api/admin/merchants/:id]
router.delete("/:id", MerchantController.remove);

export default router;
