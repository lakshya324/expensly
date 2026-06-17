import express from 'express';
import { HealthController } from '../controllers/health.controller.js';

const router = express.Router();

//! Health Routes [ALL Methods /api/health]

//* Health Check [GET /api/health]
router.get('/', HealthController.getHealth);
router.get('/live', HealthController.live);
router.get('/ready', HealthController.ready);
router.get('/dependencies', HealthController.dependencies);

export default router;
