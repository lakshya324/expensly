import express from "express";
import AuthController from "../controllers/auth.controller.js";
import { authenticate } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import {
  loginValidation,
  signupValidation,
} from "../validation/auth.schema.js";

const router = express.Router();

//! Auth Routes [ALL Methods /api/auth]

//* Signup [POST /api/auth/signup]
router.post("/auth/signup", validate(signupValidation), AuthController.signup);

//* Login [POST /api/auth/login]
router.post("/auth/login", validate(loginValidation), AuthController.login);

//? FE compatibility aliases
// These endpoints are used by the FE to determine user role and render appropriate UI.
router.post("/auth/superadmin", validate(loginValidation), AuthController.login);
router.post("/auth/admin", validate(loginValidation), AuthController.login);
router.post("/auth/user", validate(loginValidation), AuthController.login);

//* Token Refresh [POST /api/auth/refresh]
router.post("/auth/refresh", AuthController.refresh);

//* Logout [POST /api/auth/logout]
router.post("/auth/logout", authenticate, AuthController.logout);

export default router;
