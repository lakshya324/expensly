import { body } from "express-validator";
import { CURRENCIES, BUDGET_RESET_PERIODS } from "../config/constants.js";

export const createDepartmentValidation = [
  body("name").trim().notEmpty().withMessage("Department name is required"),
  body("budget")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Budget must be a non-negative number"),
  body("currency")
    .optional()
    .isIn(CURRENCIES)
    .withMessage(`Currency must be one of: ${CURRENCIES.join(", ")}`),
  body("budgetResetPeriod")
    .optional()
    .isIn(Object.values(BUDGET_RESET_PERIODS))
    .withMessage(
      `Budget reset period must be one of: ${Object.values(BUDGET_RESET_PERIODS).join(", ")}`,
    ),
  body("approvalThresholds")
    .optional()
    .isObject()
    .withMessage("approvalThresholds must be an object"),
  body("tags")
    .optional()
    .isArray()
    .withMessage("tags must be an array of strings"),
];

export const updateDepartmentValidation = [
  body("name")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Department name cannot be empty"),
  body("budget")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Budget must be a non-negative number"),
  body("currency")
    .optional()
    .isIn(CURRENCIES)
    .withMessage(`Currency must be one of: ${CURRENCIES.join(", ")}`),
  body("budgetResetPeriod")
    .optional()
    .isIn(Object.values(BUDGET_RESET_PERIODS))
    .withMessage(
      `Budget reset period must be one of: ${Object.values(BUDGET_RESET_PERIODS).join(", ")}`,
    ),
  body("approvalThresholds")
    .optional()
    .isObject()
    .withMessage("approvalThresholds must be an object"),
  body("tags")
    .optional()
    .isArray()
    .withMessage("tags must be an array of strings"),
];

export const updateDepartmentPermissionsValidation = [
  body("permissions")
    .optional()
    .isObject()
    .withMessage("permissions must be an object"),
  body("policyId")
    .optional({ nullable: true })
    .custom((v) => v === null || typeof v === "string")
    .withMessage("policyId must be a string or null"),
];

export const updateUserPermissionsValidation = [
  body("permissions")
    .optional()
    .isObject()
    .withMessage("permissions must be an object"),
  body("policyId")
    .optional({ nullable: true })
    .custom((v) => v === null || typeof v === "string")
    .withMessage("policyId must be a string or null"),
];
