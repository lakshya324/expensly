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

//* Signup [POST /api/auth/signup]
router.post("/auth/signup", validate(signupValidation), AuthController.signup);

//* Login Step 1 — validate credentials → send OTP [POST /api/auth/login]
router.post("/auth/login", validate(loginValidation), AuthController.login);

//? FE compatibility aliases
router.post("/auth/superadmin", validate(loginValidation), AuthController.login);
router.post("/auth/admin", validate(loginValidation), AuthController.login);
router.post("/auth/user", validate(loginValidation), AuthController.login);

//* Login Step 2 — verify OTP → issue tokens [POST /api/auth/verify-otp]
router.post("/auth/verify-otp", validate(verifyOtpValidation), AuthController.verifyOtp);

//* Token Refresh [POST /api/auth/refresh]
router.post("/auth/refresh", AuthController.refresh);

//* Logout [POST /api/auth/logout]
router.post("/auth/logout", authenticate, AuthController.logout);

export default router;
