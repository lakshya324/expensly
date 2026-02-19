// Super Admin Routes — mounted at /api/superadmin
import { Router } from 'express';
import { SuperAdminController } from '../controllers/superadmin.controller.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { ROLES } from '../config/constants.js';

const router = Router();
const superAdminOnly = [authenticate, authorize(ROLES.SUPER_ADMIN)] as const;

router.get('/organizations', ...superAdminOnly, SuperAdminController.listOrganizations);
router.patch('/organizations/:id/disable', ...superAdminOnly, SuperAdminController.toggleOrgStatus);
router.get('/users', ...superAdminOnly, SuperAdminController.listAllUsers);

export default router;
