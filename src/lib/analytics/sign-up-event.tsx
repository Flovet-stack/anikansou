"use client";

import { useEffect } from "react";

import { trackOnce } from "./analytics";

/** Sends `sign_up` when a new account reaches the username step. */
export function SignUpEvent({ isNewAccount }: { isNewAccount: boolean }) {
  useEffect(() => {
    if (isNewAccount) trackOnce("sign_up");
  }, [isNewAccount]);

  return null;
}
