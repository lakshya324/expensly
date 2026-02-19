// WebSocket Message Handlers
import { WebSocket } from 'ws';

export class WebSocketHandlers {
  /** Respond to a ping with a pong */
  static handlePing(ws: WebSocket): void {
    ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
  }
}
