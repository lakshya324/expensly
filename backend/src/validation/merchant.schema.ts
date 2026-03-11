import { body } from "express-validator";

export const createMerchantValidation = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Merchant name is required")
    .isLength({ max: 120 })
    .withMessage("Merchant name must be at most 120 characters"),
];

export const updateMerchantValidation = [
  body("name")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Merchant name cannot be empty")
    .isLength({ max: 120 })
    .withMessage("Merchant name must be at most 120 characters"),
  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean"),
];
