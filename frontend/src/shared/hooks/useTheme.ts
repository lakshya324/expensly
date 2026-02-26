import { useContext } from "react";
import { ThemeContext } from "../context/theme.context";
import type { ThemeContextValue } from "../types/theme";

/**
 * Hook to access the theme context.
 *
 * Retrieves the current value from `ThemeContext`. Must be used
 * within a `ThemeProvider`; otherwise an error is thrown.
 *
 * @returns The `ThemeContextValue` provided by the nearest
 *          `ThemeProvider`.
 * @throws {Error} If called when there is no `ThemeContext` value
 *                 (i.e. outside of a `ThemeProvider`).
 */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
