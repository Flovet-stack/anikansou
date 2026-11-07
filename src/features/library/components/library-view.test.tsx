// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { configure } from "@testing-library/react";

import * as tracking from "@/features/tracking/actions";
import { EMPTY_STATE, type TrackingState } from "@/features/tracking/schemas";

import type { LibraryCard, ShelfCounts } from "../types";
import { LibraryView } from "./library-view";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh }),
}));
vi.mock("../actions", () => ({ loadLibraryPage: vi.fn() }));
vi.mock("@/features/tracking/actions", () => ({
  setLike: vi.fn(),
  setRating: vi.fn(),
  setStatus: vi.fn(),
  setWatchlist: vi.fn(),
  removeFromLibrary: vi.fn(),
  deckUndo: vi.fn(),
}));

// Slow under the full parallel run.
vi.setConfig({ testTimeout: 30_000 });
configure({ asyncUtilTimeout: 5000 });

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

afterEach(() => {
  cleanup();
  refresh.mockClear();
  vi.useRealTimers();
  vi.clearAllMocks();
});

const WATCHED: TrackingState = { ...EMPTY_STATE, status: "watched", rating: 8 };

function card(animeId: number, title: string, state: TrackingState) {
  return {
    animeId,
    title,
    nativeTitle: null,
    format: "TV",
    year: 2020,
    episodes: 12,
    durationMinutes: null,
    isUpcoming: false,
    posterUrls: [],
    state,
  } satisfies LibraryCard;
}

const COUNTS: ShelfCounts = {
  watched: 2,
  watching: 0,
  on_hold: 0,
  dropped: 0,
  watchlist: 0,
  liked: 0,
};

function setup() {
  render(
    <LibraryView
      shelf="watched"
      sort="updated"
      sortInUrl
      revision="r1"
      initialCards={[
        card(1, "Frieren", WATCHED),
        card(2, "Mushishi", { ...WATCHED, rating: 6 }),
      ]}
      initialNext={null}
      initialCounts={COUNTS}
    />,
  );
}

function tab(name: RegExp) {
  return within(screen.getByRole("navigation", { name: "Shelves" })).getByRole(
    "link",
    { name },
  );
}

describe("LibraryView (spec 07)", () => {
  it("dims a title that leaves the shelf, then removes it when the toast closes", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(tracking.setStatus).mockResolvedValue({
      ok: true,
      eventId: 11,
      state: { ...EMPTY_STATE, status: "dropped" },
    });
    setup();

    fireEvent.click(
      screen.getByRole("button", { name: "Frieren, Watched, rated 4 stars" }),
    );
    const sheet = await screen.findByRole("dialog");
    fireEvent.click(within(sheet).getByRole("button", { name: "Dropped" }));

    expect(tracking.setStatus).toHaveBeenCalledWith(1, "dropped");
    await screen.findAllByText("Moved to Dropped, rating removed");
    fireEvent.keyDown(sheet, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    // Counts move straight away; the title stays, dimmed, for its Undo.
    expect(tab(/^Watched, 1 title$/)).toBeTruthy();
    expect(tab(/^Dropped, 1 title$/)).toBeTruthy();
    const frieren = screen.getByRole("button", { name: "Frieren, Dropped" });
    expect(frieren.parentElement?.className).toContain("opacity-40");

    await act(async () => {
      vi.advanceTimersByTime(5100);
    });
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Frieren, Dropped" }),
      ).toBeNull(),
    );
    expect(
      screen.getByRole("button", { name: "Mushishi, Watched, rated 3 stars" }),
    ).toBeTruthy();
  });

  it("Undo brings a removed title back in place", async () => {
    vi.mocked(tracking.removeFromLibrary).mockResolvedValue({
      ok: true,
      eventId: 12,
      state: EMPTY_STATE,
    });
    vi.mocked(tracking.deckUndo).mockResolvedValue({
      ok: true,
      eventId: 13,
      state: WATCHED,
    });
    setup();

    fireEvent.click(
      screen.getByRole("button", { name: "Frieren, Watched, rated 4 stars" }),
    );
    fireEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", {
        name: "Remove from library",
      }),
    );
    await screen.findAllByText("Removed from library");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(tab(/^Watched, 1 title$/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(tracking.deckUndo).toHaveBeenCalledWith(12);
    await screen.findAllByText(/Undone: removed from library/);
    expect(tab(/^Watched, 2 titles$/)).toBeTruthy();
    const order = screen
      .getAllByRole("button", { name: /^(Frieren|Mushishi),/ })
      .map((button) => button.textContent);
    expect(order).toEqual(["Frieren", "Mushishi"]);
  });

  it("rolls back a failed save and offers Try again", async () => {
    vi.mocked(tracking.setLike)
      .mockResolvedValueOnce({ ok: false, error: "That didn't save." })
      .mockResolvedValueOnce({
        ok: true,
        eventId: 14,
        state: { ...WATCHED, liked: true },
      });
    setup();

    const bar = screen.getByRole("group", {
      name: "Quick actions for Frieren",
    });
    fireEvent.click(within(bar).getByRole("button", { name: "Like" }));
    await screen.findAllByText("That didn't save.");
    expect(tab(/^Liked, 0 titles$/)).toBeTruthy();
    expect(within(bar).getByRole("button", { name: "Like" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findAllByText(/^Liked/);
    expect(tab(/^Liked, 1 title$/)).toBeTruthy();
    expect(tracking.setLike).toHaveBeenCalledTimes(2);
  });

  it("keeps the stars off until the title is Watched", async () => {
    render(
      <LibraryView
        shelf="watching"
        sort="updated"
        sortInUrl
        revision="r1"
        initialCards={[
          card(3, "Bocchi", { ...EMPTY_STATE, status: "watching" }),
        ]}
        initialNext={null}
        initialCounts={{ ...COUNTS, watching: 1 }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Bocchi, Watching" }));
    const sheet = await screen.findByRole("dialog");
    expect(
      (
        within(sheet).getByRole("button", {
          name: "4 stars",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(within(sheet).getByText("Mark it watched to rate it.")).toBeTruthy();
  });
  it("Ctrl+Z undoes the last change", async () => {
    vi.mocked(tracking.setWatchlist).mockResolvedValue({
      ok: true,
      eventId: 21,
      state: { ...WATCHED, watchlisted: true },
    });
    vi.mocked(tracking.deckUndo).mockResolvedValue({
      ok: true,
      eventId: 22,
      state: WATCHED,
    });
    setup();
    const bar = screen.getByRole("group", {
      name: "Quick actions for Frieren",
    });
    fireEvent.click(within(bar).getByRole("button", { name: "Watchlist" }));
    await screen.findAllByText("Added to watchlist");
    fireEvent.keyDown(document.body, { key: "z", ctrlKey: true });
    await waitFor(() => expect(tracking.deckUndo).toHaveBeenCalledWith(21));
    await screen.findAllByText(/Undone: added to watchlist/);
    expect(tab(/^Watchlist, 0 titles$/)).toBeTruthy();
  });

  it("keeps a title whose Undo is still saving when the toast times out", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(tracking.removeFromLibrary).mockResolvedValue({
      ok: true,
      eventId: 31,
      state: EMPTY_STATE,
    });
    let finish: (value: tracking.TrackingResult) => void = () => {};
    vi.mocked(tracking.deckUndo).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    setup();
    fireEvent.click(
      screen.getByRole("button", { name: "Frieren, Watched, rated 4 stars" }),
    );
    fireEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", {
        name: "Remove from library",
      }),
    );
    await screen.findAllByText("Removed from library");
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    await act(async () => {
      vi.advanceTimersByTime(5100);
    });
    await act(async () => {
      finish({ ok: true, eventId: 32, state: WATCHED });
    });
    await screen.findAllByText(/Undone: removed from library/);
    expect(
      screen.getByRole("button", { name: "Frieren, Watched, rated 4 stars" }),
    ).toBeTruthy();
    expect(tab(/^Watched, 2 titles$/)).toBeTruthy();
  });

  it("a title moved off the shelf leaves when the sheet closes after its toast", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(tracking.setStatus).mockResolvedValue({
      ok: true,
      eventId: 41,
      state: { ...EMPTY_STATE, status: "on_hold" },
    });
    setup();
    fireEvent.click(
      screen.getByRole("button", { name: "Frieren, Watched, rated 4 stars" }),
    );
    const sheet = await screen.findByRole("dialog");
    fireEvent.click(within(sheet).getByRole("button", { name: "On hold" }));
    await screen.findAllByText("Moved to On hold, rating removed");
    await act(async () => {
      vi.advanceTimersByTime(5100);
    });
    await act(async () => {
      vi.advanceTimersByTime(5100);
    });
    await waitFor(() =>
      expect(
        screen.queryAllByText("Moved to On hold, rating removed"),
      ).toHaveLength(0),
    );
    // Held while the sheet is open.
    expect(
      screen.getByRole("button", { name: /^Frieren/, hidden: true }),
    ).toBeTruthy();
    fireEvent.keyDown(sheet, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /^Frieren/ })).toBeNull(),
    );
  });

  it("takes in a refresh's fresh data only once nothing is going on", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(tracking.setLike).mockResolvedValue({
      ok: true,
      eventId: 51,
      state: { ...WATCHED, liked: true },
    });
    const view = (revision: string, cards: LibraryCard[], watched: number) => (
      <LibraryView
        shelf="watched"
        sort="updated"
        sortInUrl
        revision={revision}
        initialCards={cards}
        initialNext={null}
        initialCounts={{ ...COUNTS, watched }}
      />
    );
    const first = [card(1, "Frieren", WATCHED), card(2, "Mushishi", WATCHED)];
    const { rerender } = render(view("r1", first, 2));

    // A save here, so a toast is up when the refresh arrives.
    const bar = screen.getByRole("group", {
      name: "Quick actions for Frieren",
    });
    fireEvent.click(within(bar).getByRole("button", { name: "Like" }));
    await screen.findAllByText("Liked");

    const fresh = [card(3, "Bocchi", WATCHED), ...first];
    rerender(view("r2", fresh, 3));
    expect(tab(/^Watched, 2 titles$/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Bocchi/ })).toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(5100);
    });
    // That snapshot may predate the Like made here, so it asks again...
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(tab(/^Watched, 2 titles$/)).toBeTruthy();
    // ...and takes in the next one, with nothing edited since.
    rerender(view("r3", fresh, 3));
    await waitFor(() => expect(tab(/^Watched, 3 titles$/)).toBeTruthy());
    expect(screen.getByRole("button", { name: /^Bocchi/ })).toBeTruthy();
  });

  it("holds a refresh while the edit sheet is open or a save is in flight", async () => {
    let finish: (value: tracking.TrackingResult) => void = () => {};
    vi.mocked(tracking.setWatchlist).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const view = (revision: string, cards: LibraryCard[], watched: number) => (
      <LibraryView
        shelf="watched"
        sort="updated"
        sortInUrl
        revision={revision}
        initialCards={cards}
        initialNext={null}
        initialCounts={{ ...COUNTS, watched }}
      />
    );
    const first = [card(1, "Frieren", WATCHED), card(2, "Mushishi", WATCHED)];
    const fresh = [card(3, "Bocchi", WATCHED), ...first];
    const { rerender } = render(view("r1", first, 2));

    // Sheet open: a refresh waits.
    fireEvent.click(
      screen.getByRole("button", { name: "Frieren, Watched, rated 4 stars" }),
    );
    const sheet = await screen.findByRole("dialog");
    rerender(view("r2", fresh, 3));
    expect(
      within(sheet).getByRole("heading", { name: "Frieren" }),
    ).toBeTruthy();
    fireEvent.keyDown(sheet, { key: "Escape" });
    // Closed, nothing else going on: taken in.
    await waitFor(() => expect(tab(/^Watched, 3 titles$/)).toBeTruthy());

    // A save in flight: the next refresh waits for it.
    const bar = screen.getByRole("group", { name: "Quick actions for Bocchi" });
    fireEvent.click(within(bar).getByRole("button", { name: "Watchlist" }));
    rerender(view("r3", [card(4, "Mononoke", WATCHED), ...fresh], 4));
    expect(screen.queryByRole("button", { name: /^Mononoke/ })).toBeNull();
    expect(refresh).not.toHaveBeenCalled();
    await act(async () => {
      finish({
        ok: true,
        eventId: 61,
        state: { ...WATCHED, watchlisted: true },
      });
    });
    expect(screen.queryByRole("button", { name: /^Mononoke/ })).toBeNull();
  });
});
