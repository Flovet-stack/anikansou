"use client";

import NextError from "next/error";
import { useEffect } from "react";
import posthog from "posthog-js";

import { env } from "@/env";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
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
    <html lang="en">
      <body>
        <NextError statusCode={0} />
      </body>
    </html>
  );
}
