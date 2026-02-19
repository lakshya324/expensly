import { AuthSocket } from "../types/types.js";

export class WebSocketHandlers {
    /** Respond to a ping with a pong */
    static handlePing(socket: AuthSocket): void {
        socket.emit("pong", { timestamp: new Date().toISOString() });
    }
}
