import { body } from "express-validator";

export const postMessageValidation = [
  body("text")
    .trim()
    .notEmpty()
    .withMessage("Message text is required")
    .isLength({ max: 4000 })
    .withMessage("Message must be at most 4000 characters"),
];

export const editMessageValidation = [
  body("text")
    .trim()
    .notEmpty()
    .withMessage("Message text cannot be empty")
    .isLength({ max: 4000 })
    .withMessage("Message must be at most 4000 characters"),
];
