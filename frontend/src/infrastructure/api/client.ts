import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { tokenStore } from '../storage/token.store';
import type { ApiResponse } from '@/core/types/api.types';
import { API_BASE } from '@/config/env.config';

export const apiClient = axios.create({
  baseURL: API_BASE,
  withCredentials: true, // send refresh-token cookie
  headers: { 'Content-Type': 'application/json' },
});

// ─── Request: attach access token ────────────────────────────────────────────
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = tokenStore.get();
  if (token && config.headers) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

// ─── Track if a refresh is already in-flight ─────────────────────────────────
let _refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  if (_refreshPromise) return _refreshPromise;

  _refreshPromise = apiClient
    .post<ApiResponse<{ accessToken: string }>>('/auth/refresh')
    .then((res) => {
      const newToken = res.data.data.accessToken;
      tokenStore.set(newToken);
      return newToken;
    })
    .finally(() => {
      _refreshPromise = null;
    });

  return _refreshPromise;
}

// ─── Response: on 401, refresh once and retry ────────────────────────────────
apiClient.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/refresh') &&
      !originalRequest.url?.includes('/auth/login') &&
      !originalRequest.url?.includes('/auth/verify-otp')
    ) {
      originalRequest._retry = true;
      try {
        const newToken = await refreshAccessToken();
        originalRequest.headers!['Authorization'] = `Bearer ${newToken}`;
        return apiClient(originalRequest);
      } catch {
        // Refresh failed → force logout
        tokenStore.clear();
        window.dispatchEvent(new CustomEvent('auth:logout'));
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  },
);

export default apiClient;
