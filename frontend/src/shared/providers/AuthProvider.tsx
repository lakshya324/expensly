import { useEffect, type ReactNode } from 'react';
import { useAuthStore } from '@/features/auth/store/authStore';

/**
 * On mount, try to restore session using the HttpOnly refresh token cookie.
 * Also listens for the forced-logout event from the Axios interceptor.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const { tryRestoreSession, clearAuth } = useAuthStore();

  useEffect(() => {
    tryRestoreSession();
  }, [tryRestoreSession]);

  useEffect(() => {
    const handle = () => clearAuth();
    window.addEventListener('auth:logout', handle);
    return () => window.removeEventListener('auth:logout', handle);
  }, [clearAuth]);

  return <>{children}</>;
}
