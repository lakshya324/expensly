function requireVite(key: string) {
  const v = import.meta.env[key as keyof ImportMetaEnv] as string | undefined;
  if (!v) throw new Error(`Missing required env: ${key}`);
  return v;
}

// Base URL for API calls
export const API_BASE = requireVite("VITE_API_URL");

// Base URL for WebSocket connection
export const WS_BASE = requireVite("VITE_WS_URL");

// Local storage key for theme preference
export const THEME_STORAGE_KEY =
  (import.meta.env.VITE_THEME_STORAGE_KEY as string) ?? "expensly-theme";
