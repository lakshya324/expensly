// Server Entry Point
import http from 'http';
import { createApp } from './app.js';
import { setupWebSocket } from './websocket/wsServer.js';
import { config } from './config/env.js';

// Create HTTP server
const server = http.createServer();

// Setup WebSocket server
const wss = setupWebSocket(server);

// Create Express app with WebSocket instance
const app = createApp(wss);

// Attach Express app to HTTP server
server.on('request', app);

// Start server
server.listen(config.port, () => {
  console.log("\x1b[36m%s\x1b[0m", `Server started on port ${config.port}`);
  console.log("\x1b[36m%s\x1b[0m", `WebSocket ready for connections`);
});
