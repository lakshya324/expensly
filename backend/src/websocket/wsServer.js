// WebSocket Server Setup
import { WebSocketServer } from 'ws';
import { WebSocketHandlers } from './handlers.js';
import { 
  DEPARTMENTS, 
  ACTIONS, 
  USERS, 
  CURRENCIES,
  WS_AUDIT_MIN_INTERVAL,
  WS_AUDIT_MAX_INTERVAL 
} from '../config/constants.js';

export function setupWebSocket(server) {
  const wss = new WebSocketServer({ server });

  wss.on("connection", (socket) => {
    console.log(`Client connected`);

    // Send periodic audit events
    const auditInterval = setInterval(() => {
      const event = {
        type: "audit",
        action: ACTIONS[Math.floor(Math.random() * ACTIONS.length)],
        department: DEPARTMENTS[Math.floor(Math.random() * DEPARTMENTS.length)],
        user: USERS[Math.floor(Math.random() * USERS.length)],
        amount: (Math.random() * 5000 + 100).toFixed(2),
        currency: CURRENCIES[Math.floor(Math.random() * CURRENCIES.length)],
        timestamp: new Date().toISOString(),
      };

      socket.send(JSON.stringify(event));
    }, Math.floor(Math.random() * (WS_AUDIT_MAX_INTERVAL - WS_AUDIT_MIN_INTERVAL)) + WS_AUDIT_MIN_INTERVAL);

    // Handle incoming messages
    socket.on("message", (message) => {
      try {
        const data = JSON.parse(message);

        switch (data.type) {
          case "ping":
            WebSocketHandlers.handlePing(socket);
            break;
          case "update_ticket_status":
            WebSocketHandlers.handleTicketStatusUpdate(data, wss);
            break;
          case "ticket_update":
            WebSocketHandlers.handleTicketUpdate(data, wss);
            break;
          case "ticket_delete":
            WebSocketHandlers.handleTicketDelete(data, wss);
            break;
          case "ticket_flag":
            WebSocketHandlers.handleTicketFlag(data, wss);
            break;
          case "new_ticket":
            WebSocketHandlers.handleNewTicket(data, wss);
            break;
          default:
            console.log(`Unknown message type: ${data.type}`);
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    });

    socket.on("close", () => {
      clearInterval(auditInterval);
      console.log(`Client disconnected`);
    });
  });

  return wss;
}
