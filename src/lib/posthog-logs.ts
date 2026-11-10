import "server-only";

import { SeverityNumber } from "@opentelemetry/api-logs";
import { after } from "next/server";

import {
  loggerProvider,
  posthogLogger,
  posthogLogsEnabled,
} from "@/instrumentation";

function flushAfterResponse() {
  try {
    after(async () => {
      await loggerProvider.forceFlush().catch(() => {});
    });
  } catch {
    // Logging must not affect calls made outside a Next.js request context.
  }
}

export function logPosterSourcesResolved(attributes: {
  requested_title_count: number;
  resolved_title_count: number;
  lookup_requested: boolean;
}) {
  if (!posthogLogsEnabled) return;

  posthogLogger.emit({
    body: "Poster sources resolved",
    severityNumber: SeverityNumber.INFO,
    attributes,
  });
  flushAfterResponse();
}

export function logPosterLookupCompleted(attributes: {
  requested_title_count: number;
  cover_found_count: number;
}) {
  if (!posthogLogsEnabled) return;

  posthogLogger.emit({
    body: "Poster lookup completed",
    severityNumber: SeverityNumber.INFO,
    attributes,
  });
  flushAfterResponse();
}
