// Ticket / Expense Routes
import express from "express";
import TicketController from "../controllers/ticket.controller.js";
import * as schema from "../validation/ticket.schema.js";
import { validate } from "../middleware/validate.js";
import { uploadReceipt } from "../middleware/upload.js";

const router = express.Router();

//! Ticket Routes [ALL Methods /api/users/expenses]

//* List Tickets [GET /api/users/expenses]
router.get(
  "/",
  validate(schema.listTicketsValidation),
  TicketController.list,
);

//* Create Ticket [POST /api/users/expenses]
router.post(
  "/",
  uploadReceipt,
  validate(schema.createTicketValidation),
  TicketController.create,
);

//* Get Ticket Details [GET /api/users/expenses/:id]
router.get("/:id", TicketController.getOne);

//* Update Ticket [PATCH /api/users/expenses/:id]
router.patch("/:id", TicketController.update);

//* Delete Ticket [DELETE /api/users/expenses/:id]
router.delete("/:id", TicketController.remove);

//* Flag Ticket [PATCH /api/users/expenses/:id/flag]
router.patch("/:id/flag", TicketController.flag);

//* Update Ticket Status [PATCH /api/users/expenses/:id/status]
router.patch(
  "/:id/status",
  validate(schema.updateStatusValidation),
  TicketController.updateStatus,
);

//* Get Receipt Image [GET /api/users/expenses/:id/receipt]
router.get("/:id/receipt", TicketController.getReceipt);

export default router;
