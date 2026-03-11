// Ticket / Expense Routes
import express from "express";
import TicketController from "../controllers/ticket.controller.js";
import * as schema from "../validation/ticket.schema.js";
import { validate } from "../middleware/validate.js";
import { uploadReceipt } from "../middleware/upload.js";
import discussionRoutes from "./discussion.routes.js";

const router = express.Router();

//! Ticket Routes [ALL Methods /api/users/expenses]

//* List Tickets [GET /api/users/expenses]
router.get(
  "/",
  validate(schema.listTicketsValidation),
  TicketController.list,
);

//* Get Ticket Stats [GET /api/users/expenses/stats]
router.get("/stats", TicketController.getStats);

//* Create Ticket [POST /api/users/expenses]
router.post(
  "/",
  uploadReceipt,
  validate(schema.createTicketValidation),
  TicketController.create,
);

//* Receipt Scan (AI-first draft) [POST /api/users/expenses/receipt-scan]
router.post("/receipt-scan", uploadReceipt, TicketController.receiptScan);

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

//* Submit Draft [POST /api/users/expenses/:id/submit]
router.post("/:id/submit", TicketController.submitDraft);

//? Discussion sub-resource [ALL Methods /api/users/expenses/:ticketId/discussion]
router.use("/:ticketId/discussion", discussionRoutes);

export default router;
