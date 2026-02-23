import { io, type Socket } from 'socket.io-client';
import { tokenStore } from '../storage/token.store';
import type { SocketEvents } from '@/core/types/socket.types';

type ServerToClientEvents = {
  [K in keyof SocketEvents]: (payload: SocketEvents[K]) => void;
};

type ClientToServerEvents = {
  ping: () => void;
  subscribe_dept: (payload: { deptId: string }) => void;
  unsubscribe_dept: (payload: { deptId: string }) => void;
};

let _socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;

export const socketClient = {
  connect(): void {
    if (_socket?.connected) return;

    _socket = io('/', {
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

  on<K extends keyof ServerToClientEvents>(
    event: K,
    handler: ServerToClientEvents[K],
  ): () => void {
    _socket?.on(event as string, handler as (...args: unknown[]) => void);
    return () => _socket?.off(event as string, handler as (...args: unknown[]) => void);
  },

  off<K extends keyof ServerToClientEvents>(event: K, handler: ServerToClientEvents[K]): void {
    _socket?.off(event as string, handler as (...args: unknown[]) => void);
  },

  emit<K extends keyof ClientToServerEvents>(event: K, payload?: ClientToServerEvents[K]): void {
    _socket?.emit(event as string, ...(payload !== undefined ? [payload] : []));
  },

  get isConnected(): boolean {
    return _socket?.connected ?? false;
  },
};
