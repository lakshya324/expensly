import { body } from "express-validator";

/** Validation for creating a new expense bundle */
export const createBundleValidation = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Bundle name is required")
    .isLength({ max: 200 })
    .withMessage("Bundle name must be at most 200 characters"),
  body("description").optional().trim().isLength({ max: 2000 }),
  body("ticketIds")
    .optional()
    .isArray()
    .withMessage("ticketIds must be an array"),
  body("ticketIds.*")
    .optional()
    .isMongoId()
    .withMessage("Each ticketId must be a valid MongoDB ObjectId"),
  body("tags").optional().isArray().withMessage("tags must be an array"),
  body("tags.*").optional().isString(),
];

export const updateBundleValidation = [
  body("name")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Bundle name cannot be empty")
    .isLength({ max: 200 })
    .withMessage("Bundle name must be at most 200 characters"),
  body("description").optional().trim().isLength({ max: 2000 }),
  body("tags").optional().isArray().withMessage("tags must be an array"),
  body("tags.*").optional().isString(),
];

/** Validation for adding tickets to a bundle */
export const addTicketsValidation = [
  body("ticketIds")
    .isArray({ min: 1 })
    .withMessage("ticketIds must be a non-empty array"),
  body("ticketIds.*")
    .isMongoId()
    .withMessage("Each ticketId must be a valid MongoDB ObjectId"),
];

/** Validation for approving/rejecting a bundle at a given step */
export const updateBundleStatusValidation = [
  body("step")
    .isIn(["manager", "finance"])
    .withMessage("step must be 'manager' or 'finance'"),
  body("approved").isBoolean().withMessage("approved must be a boolean"),
  body("comments").optional().trim().isLength({ max: 2000 }),
];
