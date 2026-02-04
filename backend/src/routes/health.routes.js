// Health Check Routes
import express from 'express';
import { HealthController } from '../controllers/health.controller.js';

const router = express.Router();

// GET /api/health - Short polling health check
router.get('/health', HealthController.getHealth);

export default router;
