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

//dummy
const departments = ["Sales", "IT", "Marketing", "HR", "Finance"];
const actions = ["submitted", "approved", "rejected", "flagged"];
const users = ["Pranav", "Sneha", "Amit", "Riya", "Karan", "Anjali"];
const currencies = ["USD", "EUR", "GBP", "JPY", "INR", "CAD"];

// sp
app.get("/health", (req, res) => {
  res.json({
    status: "healthy", //todo: true or false
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
  console.log("Long poll started for:", req.params.id);

  const delay = Math.floor(Math.random() * 20000) + 5000; // 5-25 sec

  setTimeout(() => {
    res.status(200).json({
      expenseId: req.params.id,
      status: "pending", //todo
      timestamp: new Date().toISOString(),
    });
  }, delay);
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
  console.log(`Client connected: ${socket.id}`);

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

  // ping pong
  socket.on("message", (message) => {
    try {
      const data = JSON.parse(message);
      if (data.type === "ping") {
        socket.send(
          JSON.stringify({ type: "pong", timestamp: new Date().toISOString() })
        );
      }
    } catch (error) {
      console.error("Error parsing WebSocket message:", error);
    }
  });

  socket.on("disconnect", () => {
    clearInterval(auditInterval);
    console.log(`Client disconnected: ${socket.id}`);
  });
});

server.listen(3000, () => {
  console.log(`Expensly Server running on http://localhost:3000`);
  console.log(`Socket.IO ready for connections`);
});
