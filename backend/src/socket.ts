import { Server } from "socket.io";
import { createServer, Server as HttpServer } from "http";
import AuthHandler from "./websocket/auth.js";
import ConnectionHandler from "./websocket/events/connection.js";
import { Express } from "express";
import config from "./config/env.config.js";

let io: Server;

export const initializeSocket = (app: Express): HttpServer => {
    const server = createServer(app);
    io = new Server(server, {
        cors: {
            origin: config.corsOrigin,
            methods: ["GET", "POST"],
            credentials: true,
        },
    });

    // Middleware to authenticate socket connections
    io.use(AuthHandler(io));

    // Handle new socket connections
    io.on("connection", ConnectionHandler(io));

    return server;
};

export { io };
