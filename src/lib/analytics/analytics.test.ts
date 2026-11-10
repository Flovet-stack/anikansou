import { beforeEach, describe, expect, it, vi } from "vitest";

const posthog = vi.hoisted(() => ({ init: vi.fn(), capture: vi.fn() }));
const env = vi.hoisted(() => ({
  NEXT_PUBLIC_POSTHOG_TOKEN: undefined as string | undefined,
  NEXT_PUBLIC_POSTHOG_HOST: undefined as string | undefined,
}));

vi.mock("posthog-js", () => ({ default: posthog }));
vi.mock("@/env", () => ({ env }));

/** A fresh copy each time, since the module keeps what it has sent. */
async function load() {
  vi.resetModules();
  return import("./analytics");
}

async function settle() {
  await vi.waitFor(() => expect(posthog.init).toHaveBeenCalled());
  await new Promise((resolve) => setTimeout(resolve));
}

beforeEach(() => {
  vi.clearAllMocks();
  env.NEXT_PUBLIC_POSTHOG_TOKEN = undefined;
  env.NEXT_PUBLIC_POSTHOG_HOST = undefined;
});

describe("without a token", () => {
  it("never loads PostHog, and events do nothing", async () => {
    const analytics = await load();

    analytics.startAnalytics();
    analytics.trackOnce("sign_up");
    await new Promise((resolve) => setTimeout(resolve));

    expect(analytics.analyticsEnabled()).toBe(false);
    expect(posthog.init).not.toHaveBeenCalled();
    expect(posthog.capture).not.toHaveBeenCalled();
  });

  it("stays off with a token but no host", async () => {
    env.NEXT_PUBLIC_POSTHOG_TOKEN = "phc_test";
    const analytics = await load();

    analytics.startAnalytics();
    await new Promise((resolve) => setTimeout(resolve));

    expect(analytics.analyticsEnabled()).toBe(false);
    expect(posthog.init).not.toHaveBeenCalled();
  });
});

describe("with a token", () => {
  beforeEach(() => {
    env.NEXT_PUBLIC_POSTHOG_TOKEN = "phc_test";
    env.NEXT_PUBLIC_POSTHOG_HOST = "https://eu.i.posthog.com";
  });

  it("starts cookieless, with recording and page reading off", async () => {
    const analytics = await load();

    analytics.startAnalytics();
    await settle();

    expect(posthog.init).toHaveBeenCalledTimes(1);
    expect(posthog.init).toHaveBeenCalledWith(
      "phc_test",
      expect.objectContaining({
        api_host: "https://eu.i.posthog.com",
        cookieless_mode: "always",
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
    await settle();

    expect(posthog.init).toHaveBeenCalledTimes(1);
  });

  it("sends an event once, with no properties", async () => {
    const analytics = await load();
    analytics.startAnalytics();

    analytics.trackOnce("sign_up");
    analytics.trackOnce("sign_up");
    await settle();

    expect(posthog.capture).toHaveBeenCalledTimes(1);
    expect(posthog.capture).toHaveBeenCalledWith("sign_up");
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
    await settle();

    expect(posthog.capture.mock.calls.map(([event]) => event)).toEqual(events);
  });

  it("doesn't repeat a milestone after an undo and a redo", async () => {
    const analytics = await load();
    analytics.startAnalytics();

    analytics.reportRatedCount(0, 1);
    analytics.reportRatedCount(1, 0);
    analytics.reportRatedCount(0, 1);
    await settle();

    expect(posthog.capture).toHaveBeenCalledTimes(1);
  });

  it("survives PostHog failing to load", async () => {
    posthog.init.mockImplementationOnce(() => {
      throw new Error("blocked");
    });
    const analytics = await load();

    analytics.startAnalytics();
    analytics.trackOnce("sign_up");
    await settle();

    expect(posthog.capture).not.toHaveBeenCalled();
  });
});
