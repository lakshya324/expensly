// WebSocket Message Handlers
import { ticketStatusService } from '../services/ticketStatus.service.js';

export class WebSocketHandlers {
  // Handle ping/pong messages
  static handlePing(socket) {
    socket.send(
      JSON.stringify({ 
        type: "pong", 
        timestamp: new Date().toISOString() 
      })
    );
  }

  // Handle ticket status updates
  static handleTicketStatusUpdate(data, wss) {
    const update = ticketStatusService.addStatusUpdate(data.ticketId, data.status);
    console.log(`Ticket update: ${data.ticketId} -> ${data.status}`);

    // Broadcast to all connected clients
    wss.clients.forEach((client) => {
      if (client.readyState === 1) { // OPEN
        client.send(
          JSON.stringify({
            type: "ticket_status_change",
            ticketId: update.ticketId,
            status: update.status,
            timestamp: update.timestamp,
          })
        );

        // Also send live audit event
        client.send(
          JSON.stringify({
            type: "audit",
            action: update.status,
            department: "N/A",
            user: "N/A",
            amount: 0,
            currency: "N/A",
            timestamp: new Date().toISOString(),
          })
        );
      }
    });
  }

  // Handle ticket edit
  static handleTicketUpdate(data, wss) {
    console.log(`Ticket edit: ${data.ticketId}`);

    wss.clients.forEach((client) => {
      if (client.readyState === 1) {
        client.send(
          JSON.stringify({
            type: "ticket_update",
            ticketId: data.ticketId,
            updatedData: data.updatedData,
            timestamp: data.timestamp,
          })
        );
      }
    });
  }

  // Handle ticket delete
  static handleTicketDelete(data, wss) {
    console.log(`Ticket delete: ${data.ticketId}`);

    wss.clients.forEach((client) => {
      if (client.readyState === 1) {
        client.send(
          JSON.stringify({
            type: "ticket_delete",
            ticketId: data.ticketId,
            timestamp: data.timestamp,
          })
        );
      }
    });
  }

  // Handle ticket flag
  static handleTicketFlag(data, wss) {
    console.log(`Ticket flag: ${data.ticketId} -> ${data.flagged}`);

    wss.clients.forEach((client) => {
      if (client.readyState === 1) {
        client.send(
          JSON.stringify({
            type: "ticket_flag",
            ticketId: data.ticketId,
            flagged: data.flagged,
            timestamp: data.timestamp,
          })
        );
      }
    });
  }

  // Handle new ticket
  static handleNewTicket(data, wss) {
    console.log(`New ticket: ${data.ticketId}`);

    wss.clients.forEach((client) => {
      if (client.readyState === 1) {
        client.send(
          JSON.stringify({
            type: "new_ticket",
            ticketId: data.ticketId,
            ticketData: data.ticketData,
            timestamp: data.timestamp,
          })
        );
      }
    });
  }
}
