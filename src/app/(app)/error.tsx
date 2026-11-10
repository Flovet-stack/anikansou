"use client";

import { useEffect } from "react";

import { ErrorState } from "@/components/layout/error-state";
import { captureError } from "@/lib/analytics/analytics";

// Errors in pages with navigation: shown inside the (app) shell.
export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    captureError(error);
  }, [error]);

  return <ErrorState retry={retry} />;
}
