import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import {
  BatchLogRecordProcessor,
  LoggerProvider,
} from "@opentelemetry/sdk-logs";

import { env } from "@/env";

// Server logs to PostHog (decision 0032). Off without a token and host.
const posthogProjectToken = env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
const posthogHost = env.NEXT_PUBLIC_POSTHOG_HOST;

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
