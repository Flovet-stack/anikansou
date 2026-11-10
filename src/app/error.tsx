"use client";

import { useEffect } from "react";
import posthog from "posthog-js";

import { AppShell } from "@/components/layout/app-shell";
import { ErrorState } from "@/components/layout/error-state";
import { env } from "@/env";

// Errors outside the (app) group (for example in a group layout): no layout
// wraps this boundary, so it brings the shell itself.
export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    if (
      env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN &&
      env.NEXT_PUBLIC_POSTHOG_HOST
    ) {
      posthog.captureException(error);
    }
  }, [error]);

  return (
    <AppShell>
      <ErrorState retry={retry} />
    </AppShell>
  );
}
