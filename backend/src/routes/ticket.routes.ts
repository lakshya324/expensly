// Ticket / Expense Routes
import express from 'express';
import {
  TicketController,
  createTicketValidation,
  updateStatusValidation,
  listTicketsValidation,
} from '../controllers/ticket.controller.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { uploadReceipt } from '../middleware/upload.js';

const router = express.Router();

router.get('/expenses', authenticate, validate(listTicketsValidation), TicketController.list);
router.post('/expenses', authenticate, uploadReceipt, validate(createTicketValidation), TicketController.create);
router.get('/expenses/:id', authenticate, TicketController.getOne);
router.patch('/expenses/:id', authenticate, TicketController.update);
router.delete('/expenses/:id', authenticate, TicketController.remove);
router.patch('/expenses/:id/flag', authenticate, TicketController.flag);
router.patch(
  '/expenses/:id/status',
  authenticate,
  validate(updateStatusValidation),
  TicketController.updateStatus
);
router.get('/expenses/:id/receipt', authenticate, TicketController.getReceipt);

export default router;
