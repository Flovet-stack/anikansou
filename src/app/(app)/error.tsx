"use client";

import { useEffect } from "react";
import posthog from "posthog-js";

import { ErrorState } from "@/components/layout/error-state";
import { env } from "@/env";

// Errors in pages with navigation: shown inside the (app) shell.
export default function AppError({
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

  return <ErrorState retry={retry} />;
}
