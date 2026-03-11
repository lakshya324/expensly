import { body } from "express-validator";

/** Validation for creating a new expense bundle (stub — endpoint returns 501) */
export const createBundleValidation = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Bundle name is required")
    .isLength({ max: 200 })
    .withMessage("Bundle name must be at most 200 characters"),
  body("ticketIds")
    .isArray({ min: 1 })
    .withMessage("ticketIds must be a non-empty array"),
  body("ticketIds.*")
    .isMongoId()
    .withMessage("Each ticketId must be a valid MongoDB ObjectId"),
];

export const updateBundleValidation = [
  body("name")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Bundle name cannot be empty")
    .isLength({ max: 200 })
    .withMessage("Bundle name must be at most 200 characters"),
  body("ticketIds")
    .optional()
    .isArray({ min: 1 })
    .withMessage("ticketIds must be a non-empty array"),
  body("ticketIds.*")
    .optional()
    .isMongoId()
    .withMessage("Each ticketId must be a valid MongoDB ObjectId"),
];
