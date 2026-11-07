// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { EMPTY_STATE, type TrackingState } from "@/features/tracking/schemas";

import type { DeckCard } from "../types";
import type { DeckApi } from "../use-deck";
import { WebDeck } from "./web-deck";

vi.mock("@/features/tracking/actions", () => ({
  setLike: vi.fn(),
  setRating: vi.fn(),
  setStatus: vi.fn(),
  setWatchlist: vi.fn(),
}));

beforeAll(() => {
  // Motion and the icons read these; jsdom has neither.
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
});

afterEach(cleanup);

function makeCard(state: Partial<TrackingState> = {}): DeckCard {
  return {
    animeId: 7,
    title: "Mushishi",
    nativeTitle: null,
    format: "TV",
    year: 2005,
    season: null,
    episodes: 26,
    durationMinutes: null,
    studios: [],
    tags: [],
    isUpcoming: false,
    isAdult: false,
    posterUrls: [],
    state: { ...EMPTY_STATE, ...state },
  };
}

function setup(card: DeckCard) {
  const save = vi.fn().mockResolvedValue(true);
  const announce = vi.fn();
  const deck = {
    current: card,
    index: 0,
    cardError: null,
    save,
    announce,
    next: vi.fn(),
    previous: vi.fn(),
    undo: vi.fn(),
  } as unknown as DeckApi;
  render(<WebDeck deck={deck} revealed={new Set()} onReveal={() => {}} />);
  return { save, announce };
}

describe("WebDeck (0015)", () => {
  it("offers Watched, Like and Watchlist, and no other status", () => {
    setup(makeCard());
    expect(screen.getByRole("button", { name: /Mark watched/ })).toBeTruthy();
    for (const name of ["Watching", "On hold", "Dropped"]) {
      expect(screen.queryByRole("button", { name })).toBeNull();
    }
  });

  it("disables the stars until it's Watched", () => {
    setup(makeCard());
    const star = screen.getByRole("button", { name: "4.5 stars" });
    expect((star as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Mark it watched to rate it.")).toBeTruthy();
  });

  it("enables the stars once Watched", () => {
    const { save } = setup(makeCard({ status: "watched" }));
    fireEvent.click(screen.getByRole("button", { name: "4.5 stars" }));
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ animeId: 7 }),
      expect.objectContaining({ status: "watched", rating: 9 }),
      expect.any(Function),
      expect.objectContaining({ label: "Rated 4.5 stars" }),
    );
  });

  it("ignores rating keys without Watched and says why", () => {
    const { save, announce } = setup(makeCard());
    fireEvent.keyDown(document.body, { key: "9" });
    expect(save).not.toHaveBeenCalled();
    expect(announce).toHaveBeenCalledWith("Mark it watched first (W).");
  });

  it("W marks it watched", () => {
    const { save } = setup(makeCard());
    fireEvent.keyDown(document.body, { key: "w" });
    expect(save).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ status: "watched" }),
      expect.any(Function),
      expect.objectContaining({ label: "Marked watched" }),
    );
  });

  it("turning Watched off removes the rating in one save", () => {
    const { save } = setup(makeCard({ status: "watched", rating: 8 }));
    fireEvent.click(screen.getByRole("button", { name: /Watched/ }));
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ status: null, rating: null }),
      expect.any(Function),
      expect.objectContaining({ label: "Watched and rating removed" }),
    );
  });

  it("Backspace clears an older rating on a title that isn't Watched", () => {
    const { save } = setup(makeCard({ status: "on_hold", rating: 6 }));
    fireEvent.keyDown(document.body, { key: "Backspace" });
    expect(save).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ status: "on_hold", rating: null }),
      expect.any(Function),
      expect.objectContaining({ label: "Rating cleared" }),
    );
  });

  it("shows a library status read-only beside the Watched toggle", () => {
    setup(makeCard({ status: "on_hold" }));
    expect(screen.getByText("On hold")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "On hold" })).toBeNull();
    expect(
      (screen.getByRole("button", { name: "4.5 stars" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });
});
