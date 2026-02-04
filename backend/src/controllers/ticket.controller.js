// Ticket Controller (Long Polling)
import { ticketStatusService } from "../services/ticketStatus.service.js";
import {
  LONG_POLL_TIMEOUT,
  LONG_POLL_CHECK_INTERVAL,
} from "../config/constants.js";

export class TicketController {
  // Long polling for ticket approval status
  static getTicketApproval(req, res) {
    const ticketId = req.params.id;
    console.log("Long poll started for:", ticketId);

    // Check if there's already an existing update
    const existingUpdate = ticketStatusService.getAndRemoveUpdate(ticketId);

    if (existingUpdate) {
      console.log("Returning existing update for:", ticketId);
      return res.status(200).json({
        expenseId: ticketId,
        status: existingUpdate.status,
        timestamp: existingUpdate.timestamp,
      });
    }

    // Otherwise, wait for an update with timeout
    const startTime = Date.now();

    const checkInterval = setInterval(() => {
      const existingUpdate = ticketStatusService.getAndRemoveUpdate(ticketId);

      if (existingUpdate) {
        clearInterval(checkInterval);
        console.log("LP > Update found for:", ticketId);
        res.status(200).json({
          expenseId: ticketId,
          status: existingUpdate.status,
          timestamp: existingUpdate.timestamp,
        });
      } else if (Date.now() - startTime >= LONG_POLL_TIMEOUT) {
        clearInterval(checkInterval);
        console.log("LP > Long poll timeout for:", ticketId);
        res.status(200).json({
          expenseId: ticketId,
          status: "pending",
          timestamp: new Date().toISOString(),
        });
      }
    }, LONG_POLL_CHECK_INTERVAL);

    req.on("close", () => {
      clearInterval(checkInterval);
      console.log("LP > Long poll connection closed for:", ticketId);
    });
  }
}
