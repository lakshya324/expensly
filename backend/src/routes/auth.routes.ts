import express from "express";
import AuthController from "../controllers/auth.controller.js";
import { validate } from "../middleware/validate.js";
import {
  loginValidation,
  signupValidation,
  verifyOtpValidation,
  resendOtpValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
} from "../validation/auth.schema.js";

const router = express.Router();

//! Auth Routes [ALL Methods /api/auth]

//* Signup [POST /api/signup]
router.post("/signup", validate(signupValidation), AuthController.signup);

//* Login Step 1 — validate credentials → send OTP [POST /api/login]
router.post("/login", validate(loginValidation), AuthController.login);

//? FE compatibility aliases
router.post("/superadmin", validate(loginValidation), AuthController.login);
router.post("/admin", validate(loginValidation), AuthController.login);
router.post("/user", validate(loginValidation), AuthController.login);

//* Login Step 2 — verify OTP → issue tokens [POST /api/verify-otp]
router.post("/verify-otp", validate(verifyOtpValidation), AuthController.verifyOtp);

//* Resend OTP [POST /api/resend-otp]
router.post("/resend-otp", validate(resendOtpValidation), AuthController.resendOtp);

//* Forgot Password — send reset OTP [POST /api/forgot-password]
router.post("/forgot-password", validate(forgotPasswordValidation), AuthController.forgotPassword);

//* Reset Password — verify OTP + set new password [POST /api/reset-password]
router.post("/reset-password", validate(resetPasswordValidation), AuthController.resetPassword);

//* Token Refresh [POST /api/refresh]
router.post("/refresh", AuthController.refresh);

//* Logout [POST /api/logout]
router.post("/logout", AuthController.logout);

export default router;
