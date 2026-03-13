import { body, query } from "express-validator";
import { RECEIPT_USE_CASE } from "../config/constants.js";

export const uploadReceiptValidation = [
    query("useCase")
        .optional()
        .trim()
        .notEmpty()
        .withMessage("useCase is required")
        .isIn(Object.values(RECEIPT_USE_CASE))
        .withMessage(`useCase must be either ${Object.values(RECEIPT_USE_CASE).join(", ")}`),
];
