// Ticket Routes
import express from 'express';
import { TicketController } from '../controllers/ticket.controller.js';

const router = express.Router();

// GET /api/expenses/:id/approval - Long polling for ticket approval
router.get('/expenses/:id/approval', TicketController.getTicketApproval);

export default router;
