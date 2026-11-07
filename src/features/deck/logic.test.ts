import { describe, expect, it } from "vitest";

import {
  classifySwipe,
  controlsFor,
  dragProgress,
  inputModelFor,
  milestoneProgress,
  milestoneReached,
  nextMilestone,
  popUndo,
  pushUndo,
  ratingForKey,
  shouldPrefetch,
} from "./logic";

const card = { width: 300, height: 450, vx: 0, vy: 0 };

describe("classifySwipe", () => {
  it("commits left and right at 30% of the width", () => {
    expect(classifySwipe({ ...card, dx: 90, dy: 0 })).toBe("right");
    expect(classifySwipe({ ...card, dx: -90, dy: 10 })).toBe("left");
    expect(classifySwipe({ ...card, dx: 89, dy: 0 })).toBeNull();
  });

  it("commits a short drag on a fast flick in the same direction", () => {
    expect(classifySwipe({ ...card, dx: 30, dy: 0, vx: 600 })).toBe("right");
    expect(classifySwipe({ ...card, dx: -30, dy: 0, vx: -600 })).toBe("left");
    expect(classifySwipe({ ...card, dx: 30, dy: 0, vx: -600 })).toBeNull();
    expect(classifySwipe({ ...card, dx: 30, dy: 0, vx: 400 })).toBeNull();
  });

  it("commits up only within 30° of vertical and past 25% of the height", () => {
    expect(classifySwipe({ ...card, dx: 0, dy: -113 })).toBe("up");
    expect(classifySwipe({ ...card, dx: 60, dy: -120 })).toBe("up"); // ~27°
    expect(classifySwipe({ ...card, dx: 80, dy: -120 })).toBeNull(); // ~34°
    expect(classifySwipe({ ...card, dx: 0, dy: -100 })).toBeNull();
  });

  it("never treats a downward drag as a swipe", () => {
    expect(classifySwipe({ ...card, dx: 0, dy: 300 })).toBeNull();
  });
});

describe("dragProgress", () => {
  it("clamps between 0 and 1", () => {
    expect(dragProgress(45, 90)).toBe(0.5);
    expect(dragProgress(200, 90)).toBe(1);
    expect(dragProgress(-10, 90)).toBe(0);
  });
});

describe("milestones", () => {
  it("finds the next milestone", () => {
    expect(nextMilestone(0)).toBe(10);
    expect(nextMilestone(10)).toBe(25);
    expect(nextMilestone(100)).toBeNull();
  });

  it("reports a milestone only when it is crossed", () => {
    expect(milestoneReached(9, 10)).toBe(10);
    expect(milestoneReached(10, 11)).toBeNull();
    expect(milestoneReached(24, 26)).toBe(25);
  });

  it("measures progress between milestones", () => {
    expect(milestoneProgress(5)).toBe(0.5);
    expect(milestoneProgress(10)).toBe(0);
    expect(milestoneProgress(150)).toBe(1);
  });
});

describe("shouldPrefetch", () => {
  it("fetches when 3 or fewer cards are left", () => {
    expect(shouldPrefetch(3, false, false)).toBe(true);
    expect(shouldPrefetch(4, false, false)).toBe(false);
    expect(shouldPrefetch(1, true, false)).toBe(false);
    expect(shouldPrefetch(1, false, true)).toBe(false);
  });
});

describe("inputModelFor", () => {
  it("picks by input type, not width", () => {
    expect(inputModelFor({ coarse: true, fineHover: false })).toBe("touch");
    expect(inputModelFor({ coarse: false, fineHover: true })).toBe("web");
    expect(inputModelFor({ coarse: true, fineHover: true })).toBe("touch");
  });
});

describe("ratingForKey", () => {
  it("maps 1–9 to half stars and 0 to five stars", () => {
    expect(ratingForKey("1")).toBe(1);
    expect(ratingForKey("9")).toBe(9);
    expect(ratingForKey("0")).toBe(10);
    expect(ratingForKey("a")).toBeNull();
  });
});

describe("undo stack", () => {
  it("is last in, first out", () => {
    let stack = pushUndo([], { animeId: 1, eventId: 10, label: "a" });
    stack = pushUndo(stack, { animeId: 2, eventId: 11, label: "b" });
    const first = popUndo(stack);
    expect(first.entry?.eventId).toBe(11);
    const second = popUndo(first.rest);
    expect(second.entry?.eventId).toBe(10);
    expect(popUndo(second.rest).entry).toBeNull();
  });
});

describe("controlsFor", () => {
  const none = { status: null };
  it("offers Watched, the stars and Seen it only for aired anime", () => {
    expect(controlsFor({ isUpcoming: false, state: none })).toMatchObject({
      watched: true,
      rating: true,
      seenIt: true,
    });
    expect(controlsFor({ isUpcoming: true, state: none })).toMatchObject({
      watched: false,
      rating: false,
      canRate: false,
      seenIt: false,
      like: true,
      watchlist: true,
    });
  });

  it("lets the stars be used only once it's Watched (0015)", () => {
    expect(controlsFor({ isUpcoming: false, state: none }).canRate).toBe(false);
    for (const status of ["watching", "on_hold", "dropped"] as const) {
      expect(
        controlsFor({ isUpcoming: false, state: { status } }).canRate,
      ).toBe(false);
    }
    expect(
      controlsFor({ isUpcoming: false, state: { status: "watched" } }).canRate,
    ).toBe(true);
  });
});
