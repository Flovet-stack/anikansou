"use client";

import { ErrorState } from "@/components/layout/error-state";

// Errors in pages with navigation: shown inside the (app) shell.
export default function AppError({ retry }: { retry: () => void }) {
  return <ErrorState retry={retry} />;
}
