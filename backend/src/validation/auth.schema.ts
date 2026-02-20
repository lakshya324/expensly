import { body } from "express-validator";
import { userConfig } from "../config/data.config.js";

export const signupValidation = [
  body("userName").notEmpty().trim().withMessage("Admin user name is required"),
  body("orgName")
    .notEmpty()
    .trim()
    .withMessage("Organization name is required"),
  body("orgSlug")
    .notEmpty()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase()
    .trim()
    .withMessage("Organization slug is required"),
  body("adminEmail").toLowerCase().isEmail().withMessage("Valid admin email is required"),
  body("adminPassword")
    .trim()
    .isLength({ min: userConfig.password.minLength })
    .withMessage(
      `Password must be at least ${userConfig.password.minLength} characters`,
    ),
];

export const loginValidation = [
  body("email").toLowerCase().isEmail().withMessage("Valid email is required"),
  body("password").trim().notEmpty().withMessage("Password is required"),
];

export const verifyOtpValidation = [
  body("otpSessionId")
    .trim()
    .notEmpty()
    .withMessage("OTP session ID is required"),
  body("otp")
    .trim()
    .isLength({ min: 6, max: 6 })
    .isNumeric()
    .withMessage("OTP must be a 6-digit number"),
];
