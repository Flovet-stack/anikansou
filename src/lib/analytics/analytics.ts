import posthog, { type Properties } from "posthog-js";

import { env } from "@/env";

/**
 * Product analytics through PostHog (decision 0031). Every call goes through
 * this module. Without a token and host, as in local, preview and test runs,
 * nothing starts and every call does nothing.
 *
 * Never send personal data: no identify calls, no emails, usernames, user IDs
 * or review text.
 */
export type AnalyticsEvent = "sign_up" | "first_rating" | "tenth_rating";

let started = false;
// Kept in memory, not browser storage, so cookieless mode stays true to its
// word. A full reload can repeat an event; SQL stays the source of truth.
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
  if (started || !token || !host) return;

  try {
    posthog.init(token, {
      api_host: host,
      defaults: "2026-08-30",
      cookieless_mode: "always",
      person_profiles: "never",
      capture_pageview: "history_change",
      capture_pageleave: false,
      capture_exceptions: true,
      // These read page content or record the screen (0031).
      autocapture: false,
      rageclick: false,
      capture_dead_clicks: false,
      capture_heatmaps: false,
      disable_session_recording: true,
      disable_surveys: true,
    });
    started = true;
  } catch {
    // A failed start must never affect the app.
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
