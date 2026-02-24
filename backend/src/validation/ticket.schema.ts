import { body, query } from "express-validator";
import { CURRENCIES, MAX_LIMIT, TICKET_STATUS } from "../config/constants.js";

export const createTicketValidation = [
  body("title").trim().notEmpty().withMessage("Title is required"),
  body("amount")
    .isFloat({ min: 0.01 })
    .withMessage("Amount must be a positive number"),
  body("currency")
    .isIn(CURRENCIES)
    .withMessage(`Currency must be one of: ${CURRENCIES.join(", ")}`),
  body("department").trim().notEmpty().withMessage("Department is required"),
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
