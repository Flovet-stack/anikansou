import type { PostHog } from "posthog-js";

import { env } from "@/env";

/**
 * Product analytics through PostHog (decision 0031). Without a token, as in
 * local, preview and test runs, nothing loads and every call does nothing.
 *
 * Never send personal data: no identify calls, no emails, usernames, user IDs
 * or review text. Event names below take no properties for that reason.
 */
export type AnalyticsEvent = "sign_up" | "first_rating" | "tenth_rating";

let client: Promise<PostHog | null> | null = null;
// Kept in memory, not browser storage, so cookieless mode stays true to its
// word. A full reload can repeat an event; SQL stays the source of truth.
const sent = new Set<AnalyticsEvent>();

export function analyticsEnabled(): boolean {
  return Boolean(env.NEXT_PUBLIC_POSTHOG_TOKEN && env.NEXT_PUBLIC_POSTHOG_HOST);
}

/** Loads PostHog after the page starts, so it never holds up hydration. */
export function startAnalytics(): void {
  const token = env.NEXT_PUBLIC_POSTHOG_TOKEN;
  const host = env.NEXT_PUBLIC_POSTHOG_HOST;
  if (client || !token || !host) return;

  client = import("posthog-js")
    .then(({ default: posthog }) => {
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
      return posthog;
    })
    // A blocked or failed load must never affect the app.
    .catch(() => null);
}

/** Sends an event at most once per page load. */
export function trackOnce(event: AnalyticsEvent): void {
  if (!client || sent.has(event)) return;
  sent.add(event);
  void client.then((posthog) => posthog?.capture(event));
}

/** Reports the rating milestones crossed when the rated count changes. */
export function reportRatedCount(before: number, after: number): void {
  if (before < 1 && after >= 1) trackOnce("first_rating");
  if (before < 10 && after >= 10) trackOnce("tenth_rating");
}
