import { useEffect } from 'react';
import { socketClient, type ServerSocketHandler } from '@/infrastructure/socket/socket.client';
import type { ServerSocketEvents } from '@/core/types/socket.types';

/**
 * Subscribe to a typed socket event for the lifetime of the component.
 * Pass a stable handler (via useCallback) to avoid re-subscribing on every render.
 */
export function useSocket<K extends keyof ServerSocketEvents>(event: K, handler: ServerSocketHandler<K>) {
  useEffect(() => {
    socketClient.on(event, handler);
    return () => {
      socketClient.off(event, handler);
    };
  }, [event, handler]);
}
