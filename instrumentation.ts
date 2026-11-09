import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BatchLogRecordProcessor, LoggerProvider } from "@opentelemetry/sdk-logs";

const posthogProjectToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST;

export const posthogLogsEnabled = Boolean(posthogProjectToken && posthogHost);

export const loggerProvider = new LoggerProvider({
  resource: resourceFromAttributes({ "service.name": "anikansou" }),
  processors: posthogLogsEnabled
    ? [
        new BatchLogRecordProcessor({
          exporter: new OTLPLogExporter({
            url: `${posthogHost!.replace(/\/+$/, "")}/i/v1/logs`,
            headers: {
              Authorization: `Bearer ${posthogProjectToken}`,
              "Content-Type": "application/json",
            },
          }),
        }),
      ]
    : [],
});

// Use this provider directly so only log lines added for PostHog are exported.
export const posthogLogger = loggerProvider.getLogger("anikansou.posthog");

export function register() {
  if (
    !posthogProjectToken &&
    process.env.NODE_ENV !== "production" &&
    process.env.NEXT_RUNTIME === "nodejs"
  ) {
    console.warn(
      "NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN is configured",
    );
  }

  if (
    !posthogHost &&
    process.env.NODE_ENV !== "production" &&
    process.env.NEXT_RUNTIME === "nodejs"
  ) {
    console.warn(
      "NEXT_PUBLIC_POSTHOG_HOST variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once NEXT_PUBLIC_POSTHOG_HOST is configured",
    );
  }
}
