"use client";

import { AppShell } from "@/components/layout/app-shell";
import { ErrorState } from "@/components/layout/error-state";

// Errors outside the (app) group (for example in a group layout): no layout
// wraps this boundary, so it brings the shell itself.
export default function ErrorPage({ retry }: { retry: () => void }) {
  return (
    <AppShell>
      <ErrorState retry={retry} />
    </AppShell>
  );
}
