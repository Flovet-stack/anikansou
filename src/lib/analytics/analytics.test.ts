import { beforeEach, describe, expect, it, vi } from "vitest";

const posthog = vi.hoisted(() => ({
  init: vi.fn(),
  capture: vi.fn(),
  captureException: vi.fn(),
}));
const env = vi.hoisted(() => ({
  NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: undefined as string | undefined,
  NEXT_PUBLIC_POSTHOG_HOST: undefined as string | undefined,
}));

vi.mock("posthog-js", () => ({ default: posthog }));
vi.mock("@/env", () => ({ env }));

/** A fresh copy each time, since the module keeps what it has sent. */
async function load() {
  vi.resetModules();
  return import("./analytics");
}

beforeEach(() => {
  vi.clearAllMocks();
  env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN = undefined;
  env.NEXT_PUBLIC_POSTHOG_HOST = undefined;
});

describe("without a token", () => {
  it("never starts PostHog, and every call does nothing", async () => {
    const analytics = await load();

    analytics.startAnalytics();
    analytics.trackOnce("sign_up");
    analytics.capture("deck_title_tracked");
    analytics.captureError(new Error("boom"));

    expect(analytics.analyticsEnabled()).toBe(false);
    expect(posthog.init).not.toHaveBeenCalled();
    expect(posthog.capture).not.toHaveBeenCalled();
    expect(posthog.captureException).not.toHaveBeenCalled();
  });

  it("stays off with a token but no host", async () => {
    env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN = "phc_test";
    const analytics = await load();

    analytics.startAnalytics();

    expect(analytics.analyticsEnabled()).toBe(false);
    expect(posthog.init).not.toHaveBeenCalled();
  });
});

describe("with a token", () => {
  beforeEach(() => {
    env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN = "phc_test";
    env.NEXT_PUBLIC_POSTHOG_HOST = "https://eu.i.posthog.com";
  });

  it("starts cookieless, with recording and page reading off", async () => {
    const analytics = await load();

    analytics.startAnalytics();

    expect(posthog.init).toHaveBeenCalledTimes(1);
    expect(posthog.init).toHaveBeenCalledWith(
      "phc_test",
      expect.objectContaining({
        api_host: "https://eu.i.posthog.com",
        cookieless_mode: "always",
        person_profiles: "never",
        capture_pageview: "history_change",
        capture_exceptions: true,
        autocapture: false,
        disable_session_recording: true,
      }),
    );
  });

  it("starts only once", async () => {
    const analytics = await load();

    analytics.startAnalytics();
    analytics.startAnalytics();

    expect(posthog.init).toHaveBeenCalledTimes(1);
  });

  it("sends an event once, with no properties", async () => {
    const analytics = await load();
    analytics.startAnalytics();

    analytics.trackOnce("sign_up");
    analytics.trackOnce("sign_up");

    expect(posthog.capture).toHaveBeenCalledTimes(1);
    expect(posthog.capture).toHaveBeenCalledWith("sign_up");
  });

  it("passes named events and caught errors through", async () => {
    const analytics = await load();
    analytics.startAnalytics();
    const error = new Error("boom");

    analytics.capture("deck_title_skipped", { skip_method: "passed" });
    analytics.captureError(error);

    expect(posthog.capture).toHaveBeenCalledWith("deck_title_skipped", {
      skip_method: "passed",
    });
    expect(posthog.captureException).toHaveBeenCalledWith(error);
  });

  it.each([
    [0, 1, ["first_rating"]],
    [9, 10, ["tenth_rating"]],
    [0, 10, ["first_rating", "tenth_rating"]],
    [1, 2, []],
    [10, 11, []],
    [2, 1, []],
  ])("going from %i to %i ratings sends %j", async (before, after, events) => {
    const analytics = await load();
    analytics.startAnalytics();

    analytics.reportRatedCount(before, after);

    expect(posthog.capture.mock.calls.map(([event]) => event)).toEqual(events);
  });

  it("doesn't repeat a milestone after an undo and a redo", async () => {
    const analytics = await load();
    analytics.startAnalytics();

    analytics.reportRatedCount(0, 1);
    analytics.reportRatedCount(1, 0);
    analytics.reportRatedCount(0, 1);

    expect(posthog.capture).toHaveBeenCalledTimes(1);
  });

  it("stays off, without throwing, if PostHog fails to start", async () => {
    posthog.init.mockImplementationOnce(() => {
      throw new Error("blocked");
    });
    const analytics = await load();

    expect(() => analytics.startAnalytics()).not.toThrow();
    analytics.trackOnce("sign_up");

    expect(posthog.capture).not.toHaveBeenCalled();
  });
});
