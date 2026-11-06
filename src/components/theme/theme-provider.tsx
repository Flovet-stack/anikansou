"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

/**
 * The product ships dark only for now (decision 0012). The switching logic
 * stays wired up, but the theme is forced, so a stored "light" or "system"
 * preference has no effect. To bring light mode back: add light tokens to
 * globals.css, drop `forcedTheme`, and render `ThemeToggle` somewhere.
 */
export const FORCED_THEME = "dark";

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme={FORCED_THEME}
      forcedTheme={FORCED_THEME}
      enableSystem={false}
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
