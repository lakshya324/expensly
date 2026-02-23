import { body } from "express-validator";
import { userConfig } from "../config/data.config.js";

export const createUserValidation = [
  body("name").trim().notEmpty().withMessage("Name is required"),
  body("email").isEmail().withMessage("Valid email is required"),
  body("password")
    .isLength({ min: userConfig.password.minLength })
    .withMessage(
      `Password must be at least ${userConfig.password.minLength} characters`,
    ),
  body("department").trim().notEmpty().withMessage("Department ID is required"),
];
