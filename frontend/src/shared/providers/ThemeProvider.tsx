import { useEffect, useState, type ReactNode } from "react";
import type { Theme } from "../types/theme";
import { THEME_STORAGE_KEY } from "@/config/env.config";
import { ThemeContext } from "../context/theme.context";

/**
 * Apply the given theme to the document root.
 *
 * Toggles CSS classes on document.documentElement to switch visual themes without causing
 * transitional animations, and persists the chosen theme to localStorage.
 *
 * Steps performed:
 * 1. Adds a "no-transitions" class to temporarily freeze CSS transitions so colors swap instantly.
 * 2. Adds or removes the "dark" class depending on the provided theme.
 * 3. Persists the theme value using THEME_STORAGE_KEY in localStorage.
 * 4. Uses two nested requestAnimationFrame calls to wait for the next painted frame, then
 *    removes the "no-transitions" class to re-enable transitions.
 *
 * @param theme - The theme identifier to apply (e.g., "dark" or "light").
 * @returns void
 *
 * @remarks
 * - Runs in a browser environment and expects document.documentElement and localStorage to be available.
 * - The temporary "no-transitions" class prevents flicker/animation when changing theme.
 */
function applyTheme(theme: Theme) {
  const root = document.documentElement;
  // Freeze transitions so nothing animates from old → new colours
  root.classList.add("no-transitions");

  if (theme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
  localStorage.setItem(THEME_STORAGE_KEY, theme);

  // Re-enable transitions after the browser has painted the new frame
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      root.classList.remove("no-transitions");
    });
  });
}

/**
 * ThemeProvider component that initializes and provides theme state to the app.
 *
 * Behavior:
 * - On initialization, reads THEME_STORAGE_KEY from localStorage; if a valid theme ("dark" | "light")
 *   is found, that value is used.
 * - If no stored theme is found, falls back to the user's system preference via
 *   window.matchMedia("(prefers-color-scheme: dark)").
 * - On initial mount, applies the corresponding "dark" class to document.documentElement
 *   (or removes it) so the correct theme is set before the page paints.
 *
 * Side effects:
 * - Uses applyTheme(...) to apply (and expectantly persist) theme changes.
 * - Calls setThemeState to update local React state.
 * - Exposes toggleTheme which flips between "dark" and "light".
 *
 * API:
 * - Props:
 *   @param children - ReactNode children to render within the provider.
 * - Context value provided:
 *   - theme: "dark" | "light"
 *   - toggleTheme(): toggles between dark and light themes and applies the change
 *   - setTheme(t: Theme): explicitly sets and applies the provided theme
 *
 * Notes:
 * - The initial effect intentionally runs only on mount to synchronously set the document
 *   class before paint (eslint rule for exhaustive deps is disabled for that reason).
 *
 * @param children - The child nodes to render inside the provider.
 * @returns A ThemeContext provider rendering the given children.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    // Check localStorage for a stored theme
    const stored = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
    if (stored === "dark" || stored === "light") return stored;

    // Default to system preference if no stored theme
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  });

  // Apply on initial mount
  useEffect(() => {
    // const root = document.documentElement;
    // if (theme === "dark") root.classList.add("dark");
    // else root.classList.remove("dark");
    applyTheme(theme);
  }, [theme]);

  const setTheme = (t: Theme) => {
    // applyTheme(t);
    setThemeState(t);
  };

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    // applyTheme(next);
    setThemeState(next);
  };

  return (
    <ThemeContext value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext>
  );
}
