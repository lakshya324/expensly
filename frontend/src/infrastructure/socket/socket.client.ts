import { io, type Socket } from 'socket.io-client';
import { tokenStore } from '../storage/token.store';
import type { ClientSocketEvents, ServerSocketEvents } from '@/core/types/socket.types';
import { WS_BASE } from '@/config/env.config';

export type ServerSocketHandler<K extends keyof ServerSocketEvents> = (payload: ServerSocketEvents[K]) => void;

let _socket: Socket | null = null;

type SocketBoundary = {
  on(event: string, listener: (...args: unknown[]) => void): void;
  off(event: string, listener: (...args: unknown[]) => void): void;
};

function socketBoundary(): SocketBoundary | null {
  return _socket as unknown as SocketBoundary | null;
}

export const socketClient = {
  connect(): void {
    if (_socket?.connected) return;

    _socket = io(WS_BASE, {
      withCredentials: true,
      auth: { token: tokenStore.get() },
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });

    _socket.on('connect', () => console.debug('[Socket] connected:', _socket?.id));
    _socket.on('disconnect', (reason) => console.debug('[Socket] disconnected:', reason));
    _socket.on('connect_error', (err) => console.error('[Socket] error:', err.message));
  },

  disconnect(): void {
    _socket?.disconnect();
    _socket = null;
  },

  on<K extends keyof ServerSocketEvents>(
    event: K,
    handler: ServerSocketHandler<K>,
  ): () => void {
    const listener = handler as (...args: unknown[]) => void;
    socketBoundary()?.on(event, listener);
    return () => socketBoundary()?.off(event, listener);
  },

  off<K extends keyof ServerSocketEvents>(event: K, handler: ServerSocketHandler<K>): void {
    socketBoundary()?.off(event, handler as (...args: unknown[]) => void);
  },

  emit<K extends keyof ClientSocketEvents>(
    event: K,
    ...args: ClientSocketEvents[K] extends undefined ? [] : [ClientSocketEvents[K]]
  ): void {
    _socket?.emit(event, ...args);
  },

  refreshAuth(): void {
    if (!_socket) return;
    _socket.auth = { token: tokenStore.get() };
    if (!_socket.connected) _socket.connect();
  },

  get isConnected(): boolean {
    return _socket?.connected ?? false;
  },
};
