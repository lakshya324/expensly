//! Theme Types

// Theme Type
export type Theme = 'light' | 'dark';

// Theme Context Value
export interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (t: Theme) => void;
}