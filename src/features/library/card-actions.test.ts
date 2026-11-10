// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { EMPTY_STATE } from "@/features/tracking/schemas";

import { useCardActions } from "./card-actions";
import type { LibraryCard } from "./types";
import type { SaveIntent } from "./use-library";

const actions = vi.hoisted(() => ({
  setRating: vi.fn(),
  getMyRatedCount: vi.fn(),
}));
const analytics = vi.hoisted(() => ({
  analyticsEnabled: vi.fn(),
  reportRatedCount: vi.fn(),
}));

vi.mock("@/features/tracking/actions", () => actions);
vi.mock("@/lib/analytics/analytics", () => analytics);

const saved = {
  ok: true,
  eventId: 1,
  state: { ...EMPTY_STATE, status: "watched", rating: 8 },
};

function card(rating: number | null): LibraryCard {
  return {
    animeId: 1,
    isUpcoming: false,
    state: { ...EMPTY_STATE, status: "watched", rating },
  } as LibraryCard;
}

/** Rates a card and runs the save, as useLibrary does. */
async function rate(from: LibraryCard, rating: number | null) {
  let intent: SaveIntent | undefined;
  const { result: hook } = renderHook(() =>
    useCardActions(async (_card, next) => {
      intent = next;
    }),
  );
  hook.current.rate(from, rating);
  const result = await intent?.call();
  await new Promise((resolve) => setTimeout(resolve));
  return result;
}

beforeEach(() => {
  vi.clearAllMocks();
  actions.setRating.mockResolvedValue(saved);
  actions.getMyRatedCount.mockResolvedValue(10);
  analytics.analyticsEnabled.mockReturnValue(true);
});

describe("rating milestones from Library and Discover", () => {
  it("reports the new count after a first rating of a title saves", async () => {
    await rate(card(null), 8);

    expect(analytics.reportRatedCount).toHaveBeenCalledWith(9, 10);
  });

  it("doesn't ask for the count when analytics is off", async () => {
    analytics.analyticsEnabled.mockReturnValue(false);

    await rate(card(null), 8);

    expect(actions.getMyRatedCount).not.toHaveBeenCalled();
  });

  it("ignores a changed rating, a cleared one and a failed save", async () => {
    await rate(card(6), 8);
    await rate(card(6), null);
    actions.setRating.mockResolvedValue({ ok: false, error: "No" });
    await rate(card(null), 8);

    expect(actions.getMyRatedCount).not.toHaveBeenCalled();
  });

  it("still returns the save's result if the count fails", async () => {
    actions.getMyRatedCount.mockRejectedValue(new Error("offline"));

    await expect(rate(card(null), 8)).resolves.toBe(saved);
    expect(analytics.reportRatedCount).not.toHaveBeenCalled();
  });
});
