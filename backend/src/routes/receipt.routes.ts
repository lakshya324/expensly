import express from "express";
import ReceiptController from "../controllers/receipt.controller.js";
import {uploadReceiptValidation} from "../validation/receipt.validation.js";
import { uploadReceipt } from "../middleware/upload.js";
import { validate } from "../middleware/validate.js";

const router = express.Router();

//! Receipt Routes [ALL Methods /api/users/receipts]

//* Upload Receipt [POST /api/users/receipts]
router.post("/", uploadReceipt, validate(uploadReceiptValidation), ReceiptController.upload);

//* Get Receipt URL [GET /api/users/receipts/:id/url]
router.get("/:id/url", ReceiptController.getUrl);

//* Delete Receipt [DELETE /api/users/receipts/:id]
router.delete("/:id", ReceiptController.remove);

export default router;
