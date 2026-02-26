import { createContext } from "react";
import type { ThemeContextValue } from "../types/theme";

/**
 * React context that stores the current theme configuration for the application.
 *
 * The context value is either a ThemeContextValue (containing theme mode, palettes,
 * and any theme-related helpers) or null when no provider is mounted.
 *
 * Consumers should access this context via React.useContext and ensure a ThemeProvider
 * higher in the tree supplies a non-null value.
 */
export const ThemeContext = createContext<ThemeContextValue | null>(null);
