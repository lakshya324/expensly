import express from "express";
import AuthController from "../controllers/auth.controller.js";
import { authenticate } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import {
  loginValidation,
  signupValidation,
  verifyOtpValidation,
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

//* Token Refresh [POST /api/refresh]
router.post("/refresh", AuthController.refresh);

//* Logout [POST /api/logout]
router.post("/logout", authenticate, AuthController.logout);

export default router;
