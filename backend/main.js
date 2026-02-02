import express from "express";
import http from "http";
import { WebSocketServer } from "ws";
import cors from "cors";

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// middleware
app.use(cors());
app.use(express.json());

// Shared array for ticket status updates
const ticketStatusUpdates = [];
const MAX_UPDATES = 100; // Limit array size

// Helper function to add status update
function addStatusUpdate(ticketId, status) {
  const update = {
    ticketId,
    status,
    timestamp: new Date().toISOString(),
  };
  
  ticketStatusUpdates.push(update);
  
  // Keep array size manageable
  if (ticketStatusUpdates.length > MAX_UPDATES) {
    ticketStatusUpdates.shift();
  }
  
  return update;
}

//dummy
const departments = ["Sales", "IT", "Marketing", "HR", "Finance"];
const actions = ["submitted", "approved", "rejected", "flagged"];
const users = ["Pranav", "Sneha", "Amit", "Riya", "Karan", "Anjali"];
const currencies = ["USD", "EUR", "GBP", "JPY", "INR", "CAD"];

// sp
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Expensly Backend is running",
    timestamp: new Date().toISOString(),
  });
});

// sse
app.get("/api/exchange-rates", (req, res) => {
  console.log("SSE connection established for exchange rates");

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const sendRates = () => {
    const rates = {
      USD: 1,
      EUR: (0.85 + Math.random() * 0.05).toFixed(4),
      GBP: (0.73 + Math.random() * 0.05).toFixed(4),
      JPY: (110 + Math.random() * 10).toFixed(2),
      INR: (74 + Math.random() * 5).toFixed(2),
      CAD: (1.25 + Math.random() * 0.05).toFixed(4),
    };

    res.write(`data: ${JSON.stringify(rates)}\n\n`);
  };

  sendRates();
  const interval = setInterval(sendRates, 5000); // 5sec

  req.on("close", () => {
    clearInterval(interval);
    console.log("SSE connection closed");
  });
});

// lp
app.get("/api/expenses/:id/approval", (req, res) => {
  const ticketId = req.params.id;
  console.log("Long poll started for:", ticketId);

  // check for ticket status update and deleting it aswell
  const existingUpdateIndex = ticketStatusUpdates.findIndex(u => u.ticketId === ticketId);
  
  if (existingUpdateIndex !== -1) {
    console.log("Returning existing update for:", ticketId);

    const existingUpdate = ticketStatusUpdates[existingUpdateIndex];
    ticketStatusUpdates.splice(existingUpdateIndex, 1); // Remove the update after returning
    
    return res.status(200).json({
      expenseId: ticketId,
      status: existingUpdate.status,
      timestamp: existingUpdate.timestamp,
    });
  }

  // Otherwise, wait for an update with timeout
  const timeout = 30000; // 30 sec max wait
  const startTime = Date.now();
  
  const checkInterval = setInterval(() => {
    const update = ticketStatusUpdates.find(u => u.ticketId === ticketId);
    
    if (update) {
      clearInterval(checkInterval);
      console.log("LP > Update found for:", ticketId);
      res.status(200).json({
        expenseId: ticketId,
        status: update.status,
        timestamp: update.timestamp,
      });
    } else if (Date.now() - startTime >= timeout) {
      clearInterval(checkInterval);
      console.log("LP > Long poll timeout for:", ticketId);
      res.status(200).json({
        expenseId: ticketId,
        status: "pending",
        timestamp: new Date().toISOString(),
      });
    }
  }, 500); // 500ms
  
  req.on("close", () => {
    clearInterval(checkInterval);
    console.log("LP > Long poll connection closed for:", ticketId);
  });
});

// universal 200 api
app.use((req, res) => {
  console.log(`Received REST request: ${req.method} ${req.originalUrl}`);
  res.status(200).json({
    success: true,
    message: "This is a dummy response from Expensly backend.",
    timestamp: new Date().toISOString(),
    data: {},
  });
});

// ws
wss.on("connection", (socket) => {
  console.log(`Client connected`);

  const auditInterval = setInterval(() => {
    const event = {
      type: "audit",
      action: actions[Math.floor(Math.random() * actions.length)],
      department: departments[Math.floor(Math.random() * departments.length)],
      user: users[Math.floor(Math.random() * users.length)],
      amount: (Math.random() * 5000 + 100).toFixed(2),
      currency: currencies[Math.floor(Math.random() * currencies.length)],
      timestamp: new Date().toISOString(),
    };

    socket.send(JSON.stringify(event));
  }, Math.floor(Math.random() * 4000) + 4000); // 4-8 sec

  // ping pong and ticket status updates
  socket.on("message", (message) => {
    try {
      const data = JSON.parse(message);
      if (data.type === "ping") {
        socket.send(
          JSON.stringify({ type: "pong", timestamp: new Date().toISOString() })
        );
      }
      // Handle ticket status updates from client
      else if (data.type === "update_ticket_status") {
        const update = addStatusUpdate(data.ticketId, data.status);
        console.log(`Ticket update: ${data.ticketId} -> ${data.status}`);
        
        // Broadcast to all connected clients
        wss.clients.forEach((client) => {
          if (client.readyState === 1) { // OPEN
            client.send(JSON.stringify({
              type: "ticket_status_change",
              ticketId: update.ticketId,
              status: update.status,
              timestamp: update.timestamp,
            }));

            // also sending for live audit
            client.send(JSON.stringify({
              type: "audit",
              action: update.status,
              department: "N/A",
              user: "N/A",
              amount: 0,
              currency: "N/A",
              timestamp: new Date().toISOString(),
            }));
          }
        });
      }
      // Handle ticket update (edit)
      else if (data.type === "ticket_update") {
        console.log(`Ticket edit: ${data.ticketId}`);
        
        // Broadcast to all connected clients
        wss.clients.forEach((client) => {
          if (client.readyState === 1) {
            client.send(JSON.stringify({
              type: "ticket_update",
              ticketId: data.ticketId,
              updatedData: data.updatedData,
              timestamp: data.timestamp,
            }));
          }
        });
      }
      // Handle ticket delete
      else if (data.type === "ticket_delete") {
        console.log(`Ticket delete: ${data.ticketId}`);
        
        // Broadcast to all connected clients
        wss.clients.forEach((client) => {
          if (client.readyState === 1) {
            client.send(JSON.stringify({
              type: "ticket_delete",
              ticketId: data.ticketId,
              timestamp: data.timestamp,
            }));
          }
        });
      }
      // Handle ticket flag
      else if (data.type === "ticket_flag") {
        console.log(`Ticket flag: ${data.ticketId} -> ${data.flagged}`);
        
        // Broadcast to all connected clients
        wss.clients.forEach((client) => {
          if (client.readyState === 1) {
            client.send(JSON.stringify({
              type: "ticket_flag",
              ticketId: data.ticketId,
              flagged: data.flagged,
              timestamp: data.timestamp,
            }));
          }
        });
      }
      // Handle new ticket
      else if (data.type === "new_ticket") {
        console.log(`New ticket: ${data.ticketId}`);
        
        // Broadcast to all connected clients
        wss.clients.forEach((client) => {
          if (client.readyState === 1) {
            client.send(JSON.stringify({
              type: "new_ticket",
              ticketId: data.ticketId,
              ticketData: data.ticketData,
              timestamp: data.timestamp,
            }));
          }
        });
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

server.listen(3000, () => {
  console.log(`Expensly Server running on http://localhost:3000`);
  console.log(`Socket.IO ready for connections`);
});
