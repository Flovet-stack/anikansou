"use client";

import { Button } from "@/components/ui/button";
import { HugeiconsRefreshIcon } from "@/components/ui/hugeicons-refresh";

import { StatusScreen } from "./status-screen";

/** Shared body of the error boundaries. */
export function ErrorState({ retry }: { retry: () => void }) {
  return (
    <StatusScreen
      posterId={500}
      posterGlyph="停電"
      posterChip="Ep 500"
      title="Something went wrong"
      description="We couldn't load this page. Try again, and if it keeps happening, come back in a few minutes."
      action={
        <Button onClick={() => retry()}>
          <HugeiconsRefreshIcon size={20} aria-hidden />
          Try again
        </Button>
      }
    />
  );
}
