// Admin Routes
import express from 'express';
import { AdminController } from '../controllers/admin.controller.js';

// Router factory that accepts WebSocket server instance
export const createAdminRoutes = (wss) => {
  const router = express.Router();

  // PUT /api/admin/users/:id - Edit user details
  router.put('/admin/users/:id', (req, res) => {
    AdminController.editUser(req, res, wss);
  });

  // PATCH /api/admin/users/:id/disable - Disable/Enable user
  router.patch('/admin/users/:id/disable', (req, res) => {
    AdminController.toggleUserStatus(req, res, wss);
  });

  return router;
};
