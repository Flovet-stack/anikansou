"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

import { getAuthUser, onAuthChange } from "@/features/auth/queries.client";

import { identify, reset, trackOnce } from "./analytics";

/** Identifies the signed-in Supabase user once after login and page refresh. */
export function AuthAnalytics() {
  const pathname = usePathname();
  const identifiedUserId = useRef<string | null>(null);

  useEffect(() => {
    let active = true;

    const syncIdentity = (
      user: { id: string; email?: string | null } | null,
    ) => {
      if (!active) return;

      if (!user) {
        if (identifiedUserId.current) {
          reset();
          identifiedUserId.current = null;
        }
        return;
      }

      if (identifiedUserId.current === user.id) return;
      if (identifiedUserId.current) reset();

      identify(user.id, user.email ? { email: user.email } : undefined);
      identifiedUserId.current = user.id;
    };

    void getAuthUser().then(syncIdentity);
    const unsubscribe = onAuthChange(syncIdentity);

    return () => {
      active = false;
      unsubscribe();
    };
  }, [pathname]);

  return null;
}

/** Sends `sign_up` when a new account reaches the username step. */
export function SignUpEvent({ isNewAccount }: { isNewAccount: boolean }) {
  useEffect(() => {
    if (isNewAccount) trackOnce("sign_up");
  }, [isNewAccount]);

  return null;
}
