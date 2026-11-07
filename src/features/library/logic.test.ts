import { describe, expect, it } from "vitest";

import { EMPTY_STATE } from "@/features/tracking/schemas";

import {
  cardLabel,
  libraryHref,
  pruneLeft,
  shelfContains,
  shelfTabLabel,
  shiftCounts,
  visibleShelves,
} from "./logic";
import { cursorSchema } from "./schemas";
import { type ShelfCounts, parseShelf, parseSort } from "./types";

const ZERO: ShelfCounts = {
  watched: 0,
  watching: 0,
  on_hold: 0,
  dropped: 0,
  watchlist: 0,
  liked: 0,
};

describe("visibleShelves", () => {
  it("shows Watched, Watchlist and Liked even when empty", () => {
    expect(visibleShelves(ZERO, "watched")).toEqual([
      "watched",
      "watchlist",
      "liked",
    ]);
  });

  it("shows the other statuses only when they have titles, in tab order", () => {
    expect(visibleShelves({ ...ZERO, dropped: 2 }, "watched")).toEqual([
      "watched",
      "dropped",
      "watchlist",
      "liked",
    ]);
  });

  it("keeps the open shelf even after it empties", () => {
    expect(visibleShelves(ZERO, "on_hold")).toContain("on_hold");
  });
});

describe("shelfContains and shiftCounts", () => {
  const watchedLiked = {
    ...EMPTY_STATE,
    status: "watched" as const,
    rating: 8,
    liked: true,
  };

  it("puts a title on its status shelf and on Liked and Watchlist", () => {
    expect(shelfContains("watched", watchedLiked)).toBe(true);
    expect(shelfContains("liked", watchedLiked)).toBe(true);
    expect(shelfContains("watchlist", watchedLiked)).toBe(false);
    expect(shelfContains("dropped", watchedLiked)).toBe(false);
  });

  it("moves counts when a title changes shelves", () => {
    const counts = { ...ZERO, watched: 3, liked: 1 };
    const dropped = {
      ...watchedLiked,
      status: "dropped" as const,
      rating: null,
    };
    expect(shiftCounts(counts, watchedLiked, dropped)).toEqual({
      ...counts,
      watched: 2,
      dropped: 1,
    });
    // Removing everything takes it off every shelf it was on.
    expect(shiftCounts(counts, watchedLiked, EMPTY_STATE)).toEqual({
      ...counts,
      watched: 2,
      liked: 0,
    });
  });
});

describe("pruneLeft (titles leave after their toast)", () => {
  const cards = [
    { animeId: 1, state: { ...EMPTY_STATE, status: "watched" as const } },
    { animeId: 2, state: { ...EMPTY_STATE, status: "dropped" as const } },
    { animeId: 3, state: EMPTY_STATE },
  ];

  it("drops titles no longer on the shelf", () => {
    expect(
      pruneLeft(cards, "watched", new Set()).map((c) => c.animeId),
    ).toEqual([1]);
  });

  it("keeps titles that are held (the open toast's title, saves in flight)", () => {
    expect(
      pruneLeft(cards, "watched", new Set([3])).map((c) => c.animeId),
    ).toEqual([1, 3]);
  });
});

describe("URLs and parsing", () => {
  it("leaves defaults out of the URL", () => {
    expect(libraryHref("watched", "updated")).toBe("/library");
    expect(libraryHref("dropped", "rating")).toBe(
      "/library?shelf=dropped&sort=rating",
    );
    expect(libraryHref("watched", "title")).toBe("/library?sort=title");
  });

  it("falls back to Watched for unknown shelves and null for unknown sorts", () => {
    expect(parseShelf("liked")).toBe("liked");
    expect(parseShelf("favourites")).toBe("watched");
    expect(parseShelf(["liked"])).toBe("watched");
    expect(parseSort("year")).toBe("year");
    expect(parseSort("score")).toBeNull();
    expect(parseSort(undefined)).toBeNull();
  });

  it("accepts only well-formed cursors", () => {
    expect(
      cursorSchema.safeParse({ sort: "rating", id: 4, key: 8 }).success,
    ).toBe(true);
    expect(
      cursorSchema.safeParse({
        sort: "updated",
        id: 4,
        key: "2026-11-07T10:00:00.123456+00:00",
      }).success,
    ).toBe(true);
    expect(
      cursorSchema.safeParse({ sort: "score", id: 4, key: 1 }).success,
    ).toBe(false);
    expect(
      cursorSchema.safeParse({ sort: "rating", id: -1, key: 1 }).success,
    ).toBe(false);
  });
});

describe("labels", () => {
  it("names a card by title, status, rating, like and watchlist", () => {
    expect(
      cardLabel({
        title: "Frieren",
        state: {
          status: "watched",
          rating: 9,
          liked: true,
          watchlisted: false,
        },
      }),
    ).toBe("Frieren, Watched, rated 4.5 stars, liked");
    expect(
      cardLabel({
        title: "Bocchi",
        state: { ...EMPTY_STATE, watchlisted: true },
      }),
    ).toBe("Bocchi, on your watchlist");
  });

  it("says each tab's count", () => {
    expect(shelfTabLabel("on_hold", 1)).toBe("On hold, 1 title");
    expect(shelfTabLabel("watched", 12)).toBe("Watched, 12 titles");
  });
});
