import { body, query } from "express-validator";
import { CURRENCIES, MAX_LIMIT, TICKET_STATUS } from "../config/constants.js";

export const createTicketValidation = [
  body("statusIntent")
    .optional()
    .isIn(["draft", "pending"])
    .withMessage("statusIntent must be 'draft' or 'pending'"),
  body("title")
    .optional()
    .custom((value, { req }) => {
      if (req.body["statusIntent"] !== "draft" && !`${value ?? ""}`.trim())
        throw new Error("Title is required");
      return true;
    }),
  body("amount")
    .optional()
    .custom((value, { req }) => {
      const isDraft = req.body["statusIntent"] === "draft";
      if (isDraft && (value === undefined || value === "")) return true;
      const parsedAmount = parseFloat(`${value ?? ""}`);
      if (Number.isNaN(parsedAmount) || parsedAmount < 0.01)
        throw new Error("Amount must be a positive number");
      return true;
    }),
  body("currency")
    .optional()
    .custom((value, { req }) => {
      const isDraft = req.body["statusIntent"] === "draft";
      if (isDraft && (value === undefined || value === "")) return true;
      if (!CURRENCIES.includes(value))
        throw new Error(`Currency must be one of: ${CURRENCIES.join(", ")}`);
      return true;
    }),
  body("department")
    .optional()
    .custom((value, { req }) => {
      if (req.body["statusIntent"] !== "draft" && !`${value ?? ""}`.trim())
        throw new Error("Department is required");
      return true;
    }),
  body("bundleId")
    .optional()
    .isMongoId()
    .withMessage("bundleId must be a valid MongoDB ObjectId"),
  body("merchant")
    .optional()
    .isMongoId()
    .withMessage("merchant must be a valid MongoDB ObjectId"),
  body("category")
    .optional()
    .isMongoId()
    .withMessage("category must be a valid MongoDB ObjectId"),
];

export const updateStatusValidation = [
  body("status")
    .isIn(Object.values(TICKET_STATUS))
    .withMessage(
      `Status must be one of: ${Object.values(TICKET_STATUS).join(", ")}`,
    ),
];

export const listTicketsValidation = [
  query("page").optional().isInt({ min: 1 }),
  query("limit").optional().isInt({ min: 1, max: MAX_LIMIT }),
  query("status").optional().isIn(Object.values(TICKET_STATUS)),
  query("department").optional().isMongoId().withMessage("Invalid department id"),
  query("userId").optional().isMongoId().withMessage("Invalid userId"),
  query("from").optional().isISO8601().withMessage("Invalid from date"),
  query("to").optional().isISO8601().withMessage("Invalid to date"),
  query("flagged").optional().isIn(["true", "false"]).withMessage("flagged must be true or false"),
  query("minAmount").optional().isFloat({ min: 0 }).withMessage("minAmount must be a non-negative number"),
  query("maxAmount").optional().isFloat({ min: 0 }).withMessage("maxAmount must be a non-negative number"),
];
