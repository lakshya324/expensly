import { create } from 'zustand';
import { tokenStore } from '@/infrastructure/storage/token.store';
import { socketClient } from '@/infrastructure/socket/socket.client';
import apiClient from '@/infrastructure/api/client';
import type { IUserData, IOrganizationData } from '@/core/types/user.types';

type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'unauthenticated';

interface AuthState {
  user: IUserData | null;
  status: AuthStatus;
  otpUserId: string | null;
  // Actions
  setOtpUserId: (userId: string) => void;
  setAuth: (user: IUserData, accessToken: string) => void;
  clearAuth: () => void;
  tryRestoreSession: () => Promise<void>;
  patchOrg: (patch: Partial<IOrganizationData>) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: 'idle',
  otpUserId: null,

  setOtpUserId: (userId) => set({ otpUserId: userId }),

  setAuth: (user, accessToken) => {
    tokenStore.set(accessToken);
    socketClient.connect();
    set({ user, status: 'authenticated', otpUserId: null });
  },

  clearAuth: () => {
    tokenStore.clear();
    socketClient.disconnect();
    set({ user: null, status: 'unauthenticated', otpUserId: null });
  },

  tryRestoreSession: async () => {
    set({ status: 'loading' });
    try {
      const res = await apiClient.post<{ data: { accessToken: string; user: IUserData } }>('/auth/refresh');
      const { accessToken, user } = res.data.data;
      tokenStore.set(accessToken);
      socketClient.connect();
      set({ user, status: 'authenticated' });
    } catch {
      set({ status: 'unauthenticated' });
    }
  },

  patchOrg: (patch) =>
    set((state) => {
      if (!state.user) return {};
      return { user: { ...state.user, org: state.user.org ? { ...state.user.org, ...patch } : state.user.org } };
    }),
}));
