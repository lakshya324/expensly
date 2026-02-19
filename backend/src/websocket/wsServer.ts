// WebSocket Server — raw ws library (matches FE's native WebSocket API)
import { WebSocket, WebSocketServer } from 'ws';
import type { IncomingMessage } from 'http';
import type { Server } from 'http';
import { verifyAccessToken } from '../services/auth.service.js';
import { WebSocketHandlers } from './handlers.js';

export interface IOLike {
  to(room: string): {
    emit(event: string, payload: Record<string, unknown>): void;
  };
}

/** Map<orgId|userId → Set<WebSocket>> — tracks rooms by string key */
const rooms = new Map<string, Set<WebSocket>>();

function joinRoom(key: string, ws: WebSocket): void {
  if (!rooms.has(key)) rooms.set(key, new Set());
  rooms.get(key)!.add(ws);
}

function leaveAllRooms(ws: WebSocket): void {
  for (const [key, clients] of rooms.entries()) {
    clients.delete(ws);
    if (clients.size === 0) rooms.delete(key);
  }
}

function broadcastToRoom(key: string, payload: Record<string, unknown>): void {
  const clients = rooms.get(key);
  if (!clients || clients.size === 0) return;
  const msg = JSON.stringify(payload);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  }
}

/**
 * Public broadcast API used by controllers.
 * Mirrors a subset of the socket.io `io.to(room).emit()` interface.
 */
export const getIO = (): IOLike => ({
  to(room: string) {
    return {
      emit(event: string, payload: Record<string, unknown>) {
        broadcastToRoom(room, { type: event, ...payload });
      },
    };
  },
});

let wss: WebSocketServer | null = null;

/**
 * Initialise the WebSocket server on an existing http.Server.
 * Call this after mongoose.connect().
 */
export function initWS(httpServer: Server): WebSocketServer {
  wss = new WebSocketServer({ server: httpServer });

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    // ── JWT Auth ──────────────────────────────────────────────────────────
    // Client must pass token as query param: ws://host:3000?token=<accessToken>
    let user: { id: string; orgId: string | null } | null = null;
    try {
      const params = new URL(req.url ?? '', 'http://localhost').searchParams;
      const token = params.get('token');
      if (token) {
        const payload = verifyAccessToken(token);
        user = {
          id: payload.sub,
          orgId: payload.orgId,
        };
      }
    } catch {
      // unauthenticated — still allow connection but no org room
    }

    // ── Join Rooms ────────────────────────────────────────────────────────
    if (user) {
      if (user.orgId) joinRoom(user.orgId, ws);
      joinRoom(user.id, ws);
      console.log(`[WS] User ${user.id} connected (org: ${user.orgId ?? 'n/a'})`);
    } else {
      console.log('[WS] Unauthenticated client connected');
    }

    // ── Message Handling ──────────────────────────────────────────────────
    ws.on('message', (raw: Buffer) => {
      try {
        const data = JSON.parse(raw.toString()) as { type: string };
        switch (data.type) {
          case 'ping':
            WebSocketHandlers.handlePing(ws);
            break;
          default:
            console.log(`[WS] Unknown message type: ${data.type}`);
        }
      } catch (err) {
        if (err instanceof Error) {
          console.error('[WS] Parse error:', err.message);
        }
      }
    });

    ws.on('close', () => {
      leaveAllRooms(ws);
      if (user) console.log(`[WS] User ${user.id} disconnected`);
      else console.log('[WS] Unauthenticated client disconnected');
    });

    ws.on('error', (err: Error) => console.error('[WS] Socket error:', err.message));
  });

  console.log('[WS] WebSocket server initialised');
  return wss;
}
