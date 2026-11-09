"use client";

import { usePathname } from "next/navigation";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import posthog from "posthog-js";
import { type ReactNode, useEffect, useRef } from "react";

import { env } from "@/env";
import { createClient } from "@/lib/supabase/browser";

/**
 * The product ships dark only for now (decision 0012). The switching logic
 * stays wired up, but the theme is forced, so a stored "light" or "system"
 * preference has no effect. To bring light mode back: add light tokens to
 * globals.css, drop `forcedTheme`, and render `ThemeToggle` somewhere.
 */
export const FORCED_THEME = "dark";

/** Keeps browser analytics attached to the current Supabase user. */
function PostHogIdentity() {
  const pathname = usePathname();
  const identifiedUserId = useRef<string | null>(null);

  useEffect(() => {
    if (
      !env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN ||
      !env.NEXT_PUBLIC_POSTHOG_HOST
    ) {
      return;
    }

    const supabase = createClient();
    let active = true;

    const clearIdentity = () => {
      if (identifiedUserId.current) posthog.reset();
      identifiedUserId.current = null;
    };
    const identify = (userId: string, email: string | undefined) => {
      if (identifiedUserId.current === userId) return;
      if (identifiedUserId.current) posthog.reset();
      posthog.identify(userId, email ? { email } : undefined);
      identifiedUserId.current = userId;
    };
    const syncIdentity = async () => {
      const { data, error } = await supabase.auth.getClaims();
      if (!active) return;

      const userId = data?.claims.sub;
      if (error || typeof userId !== "string") {
        clearIdentity();
        return;
      }

      const email = data.claims.email;
      identify(userId, typeof email === "string" ? email : undefined);
    };

    void syncIdentity();
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        clearIdentity();
        return;
      }
      if (event === "INITIAL_SESSION" || event === "SIGNED_IN") {
        if (session?.user.id) identify(session.user.id, session.user.email);
      }
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [pathname]);

  return null;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme={FORCED_THEME}
      forcedTheme={FORCED_THEME}
      enableSystem={false}
      disableTransitionOnChange
    >
      <PostHogIdentity />
      {children}
    </NextThemesProvider>
  );
}
