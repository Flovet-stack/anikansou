"use client";

import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import { HugeiconsMoon02Icon } from "@/components/ui/hugeicons-moon-02";
import { HugeiconsSun03Icon } from "@/components/ui/hugeicons-sun-03";

/**
 * Switches between light and dark. Kept, restyled and tested, but not rendered
 * anywhere while the product is dark only (decision 0012).
 *
 * The server doesn't know the theme, so the markup is the same either way:
 * the icon is switched with CSS and the label doesn't depend on the theme.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Switch theme"
      onClick={() => setTheme(resolvedTheme === "light" ? "dark" : "light")}
    >
      <HugeiconsSun03Icon
        size={20}
        aria-hidden
        className="hidden dark:inline-flex"
      />
      <HugeiconsMoon02Icon size={20} aria-hidden className="dark:hidden" />
    </Button>
  );
}
