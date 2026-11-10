"use client";

import { useEffect } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { captureError } from "@/lib/analytics/analytics";
import { ErrorState } from "@/components/layout/error-state";

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
    captureError(error);
  }, [error]);

  return (
    <AppShell>
      <ErrorState retry={retry} />
    </AppShell>
  );
}
