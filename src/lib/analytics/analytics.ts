import posthog, { type Properties } from "posthog-js";

import { env } from "@/env";

/**
 * Product analytics through PostHog (decision 0031). Every call goes through
 * this module. Without a token and host, as in local, preview and test runs,
 * nothing starts and every call does nothing.
 *
 * Never send personal data in event properties: no emails, usernames, user IDs
 * or review text. Email belongs only on the identified person's properties.
 */
export type AnalyticsEvent = "sign_up" | "first_rating" | "tenth_rating";

let started = false;
// Kept in memory, so a full reload can repeat an event; SQL stays the source
// of truth.
const sent = new Set<AnalyticsEvent>();

export function analyticsEnabled(): boolean {
  return Boolean(
    env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN && env.NEXT_PUBLIC_POSTHOG_HOST,
  );
}

/** Starts PostHog once, from instrumentation-client.ts. */
export function startAnalytics(): void {
  const token = env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  const host = env.NEXT_PUBLIC_POSTHOG_HOST;
  if (started) return;

  if (!token) {
    if (process.env.NODE_ENV !== "production") {
      throw new Error(
        "NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN is configured",
      );
    }
    return;
  }

  if (!host) {
    if (process.env.NODE_ENV !== "production") {
      throw new Error(
        "NEXT_PUBLIC_POSTHOG_HOST variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once NEXT_PUBLIC_POSTHOG_HOST is configured",
      );
    }
    return;
  }

  try {
    posthog.init(token, {
      api_host: host,
      defaults: "2026-08-30",
      capture_exceptions: true,
      debug: process.env.NODE_ENV === "development",
    });
    started = true;
  } catch {
    // A failed analytics initialization must not affect the app.
  }
}

/** Sends a named event. Properties must hold no personal data. */
export function capture(event: string, properties?: Properties): void {
  if (started) posthog.capture(event, properties);
}

/** Reports an error caught by an error boundary. */
export function captureError(error: unknown): void {
  if (started) posthog.captureException(error);
}

/** Associates subsequent browser events and errors with a stable user id. */
export function identify(userId: string, properties?: Properties): void {
  if (started) posthog.identify(userId, properties);
}

/** Clears the persisted identity when a user signs out or switches accounts. */
export function reset(): void {
  if (started) posthog.reset();
}

/** Sends an event at most once per page load. */
export function trackOnce(event: AnalyticsEvent): void {
  if (!started || sent.has(event)) return;
  sent.add(event);
  posthog.capture(event);
}

/** Reports the rating milestones crossed when the rated count changes. */
export function reportRatedCount(before: number, after: number): void {
  if (before < 1 && after >= 1) trackOnce("first_rating");
  if (before < 10 && after >= 10) trackOnce("tenth_rating");
}
