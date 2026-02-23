import { useEffect } from 'react';
import { socketClient } from '@/infrastructure/socket/socket.client';
import type { SocketEvents } from '@/core/types/socket.types';

type ServerHandler<K extends keyof SocketEvents> = (payload: SocketEvents[K]) => void;

/**
 * Subscribe to a typed socket event for the lifetime of the component.
 * Pass a stable handler (via useCallback) to avoid re-subscribing on every render.
 */
export function useSocket<K extends keyof SocketEvents>(event: K, handler: ServerHandler<K>) {
  useEffect(() => {
    socketClient.on(event, handler as any);
    return () => {
      socketClient.off(event, handler as any);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event]);
}
