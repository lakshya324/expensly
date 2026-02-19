import express from 'express';
import {
  AuthController,
  signupValidation,
  loginValidation,
} from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = express.Router();

router.post('/auth/signup', validate(signupValidation), AuthController.signup);
router.post('/auth/login', validate(loginValidation), AuthController.login);

// FE compatibility aliases
router.post('/auth/superadmin', validate(loginValidation), AuthController.loginSuperAdmin);
router.post('/auth/admin', validate(loginValidation), AuthController.login);
router.post('/auth/user', validate(loginValidation), AuthController.login);

router.post('/auth/refresh', AuthController.refresh);
router.post('/auth/logout', authenticate, AuthController.logout);
router.get('/auth/me', authenticate, AuthController.me);

export default router;
