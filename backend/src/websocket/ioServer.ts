import { Server } from "socket.io";
import { io } from "../socket.js";

/**
 * Returns the socket.io Server instance.
 * Controllers use this to broadcast events to rooms:
 *   getIO().to(orgId).emit('event', payload)
 */
export function getIO(): Server {
    if (!io) throw new Error("[Socket.IO] Server not yet initialized");
    return io;
}