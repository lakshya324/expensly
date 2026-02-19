// Admin Routes — mounted at /api/admin
import { Router } from 'express';
import {
  AdminController,
  createUserValidation,
  addDepartmentValidation,
} from '../controllers/admin.controller.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { ROLES } from '../config/constants.js';

const router = Router();
const adminOnly = [authenticate, authorize(ROLES.ADMIN)] as const;

// ─── Users ────────────────────────────────────────────────────────────────────
router.get('/users', ...adminOnly, AdminController.listUsers);
router.post('/users', ...adminOnly, validate(createUserValidation), AdminController.createUser);
router.put('/users/:id', ...adminOnly, AdminController.editUser);
router.patch('/users/:id/disable', ...adminOnly, AdminController.toggleUserStatus);

// ─── Departments ──────────────────────────────────────────────────────────────
router.get('/departments', ...adminOnly, AdminController.listDepartments);
router.post('/departments', ...adminOnly, validate(addDepartmentValidation), AdminController.addDepartment);
router.patch('/departments/:id', ...adminOnly, AdminController.editDepartment);
router.post('/departments/:id/reset', ...adminOnly, AdminController.resetDepartmentSpent);

export default router;
