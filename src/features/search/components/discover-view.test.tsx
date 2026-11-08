// @vitest-environment jsdom
import {
  act,
  cleanup,
  configure,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import * as tracking from "@/features/tracking/actions";
import { EMPTY_STATE } from "@/features/tracking/schemas";

import * as searchActions from "../actions";
import { EMPTY_FILTERS } from "../filters";
import type { SearchCard, SearchPage } from "../types";
import { DiscoverView } from "./discover-view";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("../actions", () => ({ loadSearchPage: vi.fn() }));
// Imported through the shared save helper; never called here.
vi.mock("@/features/library/actions", () => ({ loadLibraryPage: vi.fn() }));
vi.mock("@/features/tracking/actions", () => ({
  setLike: vi.fn(),
  setRating: vi.fn(),
  setStatus: vi.fn(),
  setWatchlist: vi.fn(),
  removeFromLibrary: vi.fn(),
  deckUndo: vi.fn(),
}));

vi.setConfig({ testTimeout: 30_000 });
configure({ asyncUtilTimeout: 5000 });

beforeAll(() => {
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
  vi.useRealTimers();
  vi.clearAllMocks();
  window.history.replaceState(null, "", "/discover");
});

const load = vi.mocked(searchActions.loadSearchPage);

function card(
  animeId: number,
  title: string,
  extra: Partial<SearchCard> = {},
): SearchCard {
  return {
    animeId,
    title,
    nativeTitle: null,
    format: "TV",
    year: 2023,
    episodes: 28,
    durationMinutes: null,
    isUpcoming: false,
    isAdult: false,
    matchedTitle: null,
    posterUrls: [],
    state: EMPTY_STATE,
    ...extra,
  };
}

function page(cards: SearchCard[], total = cards.length): SearchPage {
  return { cards, total };
}

function setup(props: Partial<React.ComponentProps<typeof DiscoverView>> = {}) {
  render(
    <DiscoverView initialQuery="" initialPage={null} signedIn {...props} />,
  );
  return screen.getByRole("searchbox", { name: "Search anime" });
}

/** Types into the field and lets the 250 ms debounce and the reply finish. */
async function type(field: HTMLElement, value: string) {
  fireEvent.change(field, { target: { value } });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(300);
  });
}

describe("DiscoverView search", () => {
  it("searches 250 ms after typing, never below 2 characters, and keeps ?q=", async () => {
    vi.useFakeTimers();
    load.mockResolvedValue(
      page([
        card(1, "Sousou no Frieren", {
          matchedTitle: "Frieren: Beyond Journey's End",
        }),
      ]),
    );
    const field = setup();
    expect(
      screen.getByText(
        "Find any anime by its English, romaji or Japanese title.",
      ),
    ).toBeTruthy();

    await type(field, "f");
    expect(load).not.toHaveBeenCalled();

    fireEvent.change(field, { target: { value: "fr" } });
    fireEvent.change(field, { target: { value: "frie" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(load).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(load).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledWith("frie", EMPTY_FILTERS, 0);

    expect(
      screen.getByRole("heading", { name: '1 result for "frie"' }),
    ).toBeTruthy();
    expect(
      screen.getByText("Also known as Frieren: Beyond Journey's End"),
    ).toBeTruthy();
    expect(window.location.search).toBe("?q=frie");
  });

  it("never lets a late reply overwrite a newer query's results", async () => {
    vi.useFakeTimers();
    let resolveOld: (value: SearchPage) => void = () => {};
    load
      .mockImplementationOnce(
        () => new Promise<SearchPage>((resolve) => (resolveOld = resolve)),
      )
      .mockResolvedValueOnce(page([card(2, "Cowboy Bebop")]));
    const field = setup();

    await type(field, "frieren");
    await type(field, "bebop");
    expect(screen.getByText("Cowboy Bebop")).toBeTruthy();

    await act(async () => {
      resolveOld(page([card(1, "Sousou no Frieren")]));
    });
    expect(screen.queryByText("Sousou no Frieren")).toBeNull();
    expect(screen.getByText("Cowboy Bebop")).toBeTruthy();
  });

  it("shows the no-results state, and Clear search empties the field", async () => {
    vi.useFakeTimers();
    load.mockResolvedValue(page([]));
    const field = setup();
    await type(field, "zzzzqqq");
    // Shown, and announced once in the live region.
    expect(screen.getAllByText("No anime match “zzzzqqq”.")).toHaveLength(2);

    // The × in the field and the button under the message both clear.
    const clears = screen.getAllByRole("button", { name: "Clear search" });
    expect(clears).toHaveLength(2);
    fireEvent.click(clears[1] as HTMLElement);
    expect((field as HTMLInputElement).value).toBe("");
    expect(window.location.search).toBe("");
  });

  it("Esc clears the field; Enter searches at once", async () => {
    vi.useFakeTimers();
    load.mockResolvedValue(page([card(2, "Cowboy Bebop")]));
    const field = setup();
    fireEvent.change(field, { target: { value: "bebop" } });
    await act(async () => {
      fireEvent.submit(field.closest("form") as HTMLFormElement);
    });
    expect(load).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Cowboy Bebop")).toBeTruthy();

    fireEvent.keyDown(field, { key: "Escape" });
    expect((field as HTMLInputElement).value).toBe("");
    expect(screen.queryByText("Cowboy Bebop")).toBeNull();
  });

  it("shows the error state with Try again", async () => {
    vi.useFakeTimers();
    load
      .mockResolvedValueOnce({ error: "Search isn't working right now." })
      .mockResolvedValueOnce(page([card(2, "Cowboy Bebop")]));
    const field = setup();
    await type(field, "bebop");
    expect(screen.getByRole("alert").textContent).toContain(
      "Search isn't working right now.",
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    });
    expect(screen.getByText("Cowboy Bebop")).toBeTruthy();
  });

  it("says 200+ at the cap and loads more with Show more", async () => {
    const first = Array.from({ length: 24 }, (_, i) =>
      card(i + 1, `Mecha ${i + 1}`),
    );
    load.mockResolvedValueOnce(page([card(25, "Mecha 25")], 201));
    setup({ initialQuery: "mecha", initialPage: page(first, 201) });
    expect(
      screen.getByRole("heading", { name: '200+ results for "mecha"' }),
    ).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Show more" }));
    });
    expect(load).toHaveBeenCalledWith("mecha", EMPTY_FILTERS, 24);
    expect(screen.getByText("Mecha 25")).toBeTruthy();
  });
});

describe("DiscoverView cards", () => {
  it("signed out: no quick actions, and a card goes to log in and back", () => {
    setup({
      initialQuery: "frieren",
      initialPage: page([card(1, "Sousou no Frieren")]),
      signedIn: false,
    });
    expect(screen.queryByRole("group", { name: /Quick actions/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Sousou no Frieren" }));
    expect(push).toHaveBeenCalledWith(
      `/auth/login?next=${encodeURIComponent("/discover?q=frieren")}`,
    );
  });

  it("signed in: watchlists a result with Undo", async () => {
    const saved = { ...EMPTY_STATE, watchlisted: true };
    vi.mocked(tracking.setWatchlist).mockResolvedValue({
      ok: true,
      eventId: 7,
      state: saved,
    });
    vi.mocked(tracking.deckUndo).mockResolvedValue({
      ok: true,
      eventId: 8,
      state: EMPTY_STATE,
    });
    setup({
      initialQuery: "bebop",
      initialPage: page([card(2, "Cowboy Bebop")]),
    });
    const actions = screen.getByRole("group", {
      name: "Quick actions for Cowboy Bebop",
    });
    await act(async () => {
      fireEvent.click(
        within(actions).getByRole("button", { name: /watchlist/i }),
      );
    });
    expect(tracking.setWatchlist).toHaveBeenCalledWith(2, true);
    expect(
      screen.getByRole("button", {
        name: "Cowboy Bebop, on your watchlist",
      }),
    ).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Undo/ }));
    });
    expect(tracking.deckUndo).toHaveBeenCalledWith(7);
    expect(screen.getByRole("button", { name: "Cowboy Bebop" })).toBeTruthy();
  });

  it("blurs an adult poster with an 18+ badge until revealed", () => {
    setup({
      initialQuery: "robo",
      initialPage: page([card(3, "Robo", { isAdult: true })]),
    });
    expect(screen.getByText("18+")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Show poster (18+)" }));
    expect(
      screen.queryByRole("button", { name: "Show poster (18+)" }),
    ).toBeNull();
  });

  it("gives an unaired title no Watched control", () => {
    setup({
      initialQuery: "frieren",
      initialPage: page([card(4, "Frieren 3", { isUpcoming: true })]),
    });
    const actions = screen.getByRole("group", {
      name: "Quick actions for Frieren 3",
    });
    const watched = within(actions).getByRole("button", { name: /watched/i });
    expect((watched as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("DiscoverView filters", () => {
  const ACTION = { ...EMPTY_FILTERS, genres: ["action" as const] };

  it("renders a filtered link's results, count without a query, and chips", () => {
    setup({
      initialFilters: ACTION,
      initialPage: page([card(1, "Cowboy Bebop")], 36),
    });
    expect(screen.getByRole("heading", { name: "36 results" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Remove filter: Action" }),
    ).toBeTruthy();
  });

  it("removing a chip searches again after the debounce and updates the URL", async () => {
    vi.useFakeTimers();
    load.mockResolvedValue(page([card(2, "Bebop")]));
    setup({
      initialQuery: "bebop",
      initialFilters: ACTION,
      initialPage: page([card(1, "Bebop TV")]),
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Remove filter: Action" }),
    );
    expect(load).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(load).toHaveBeenCalledWith("bebop", EMPTY_FILTERS, 0);
    expect(window.location.search).toBe("?q=bebop");
  });

  it("Clear filters keeps the query; Clear search keeps the filters", async () => {
    vi.useFakeTimers();
    load.mockResolvedValue(page([card(2, "Bebop")]));
    const field = setup({
      initialQuery: "bebop",
      initialFilters: ACTION,
      initialPage: page([card(1, "Bebop TV")]),
    });

    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect((field as HTMLInputElement).value).toBe("");
    expect(load).toHaveBeenLastCalledWith("", ACTION, 0);
    expect(window.location.search).toBe("?genre=action");

    fireEvent.change(field, { target: { value: "bebop" } });
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect((field as HTMLInputElement).value).toBe("bebop");
    expect(load).toHaveBeenLastCalledWith("bebop", EMPTY_FILTERS, 0);
  });

  it("shows 0020's no-results state, and Clear filters recovers", async () => {
    vi.useFakeTimers();
    load.mockResolvedValue(page([card(2, "Bebop")]));
    setup({ initialFilters: ACTION, initialPage: page([]) });
    expect(screen.getByText("No anime match these filters.")).toBeTruthy();
    expect(screen.getByText("Try removing a filter.")).toBeTruthy();
    const clears = screen.getAllByRole("button", { name: "Clear filters" });
    fireEvent.click(clears.at(-1) as HTMLElement);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    // Nothing left to search for: back to the empty state, no request.
    expect(load).not.toHaveBeenCalled();
    expect(
      screen.getByText(
        "Find any anime by its English, romaji or Japanese title.",
      ),
    ).toBeTruthy();
  });

  it("a late reply never overwrites a newer filter change", async () => {
    vi.useFakeTimers();
    let resolveOld: (value: SearchPage) => void = () => {};
    load
      .mockImplementationOnce(
        () => new Promise<SearchPage>((resolve) => (resolveOld = resolve)),
      )
      .mockResolvedValueOnce(page([card(2, "Newer")]));
    const field = setup({
      initialFilters: ACTION,
      initialPage: page([card(1, "First")]),
    });
    await type(field, "older");
    fireEvent.click(
      screen.getByRole("button", { name: "Remove filter: Action" }),
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(screen.getByRole("button", { name: "Newer" })).toBeTruthy();
    await act(async () => {
      resolveOld(page([card(3, "Older")]));
    });
    expect(screen.queryByRole("button", { name: "Older" })).toBeNull();
    expect(screen.getByRole("button", { name: "Newer" })).toBeTruthy();
  });

  it("the sort menu searches with the new sort and keeps the filters", async () => {
    vi.useFakeTimers();
    load.mockResolvedValue(page([card(2, "Bebop")]));
    setup({
      initialFilters: ACTION,
      initialPage: page([card(1, "First")]),
    });
    fireEvent.change(screen.getByLabelText("Sort"), {
      target: { value: "newest" },
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(load).toHaveBeenCalledWith("", { ...ACTION, sort: "newest" }, 0);
    expect(window.location.search).toBe("?genre=action&sort=newest");
  });

  it("Show more keeps the filters and sort", async () => {
    const filters = { ...ACTION, sort: "newest" as const };
    const first = Array.from({ length: 24 }, (_, i) =>
      card(i + 1, `Mecha ${i + 1}`),
    );
    load.mockResolvedValueOnce(page([card(25, "Mecha 25")], 25));
    setup({ initialFilters: filters, initialPage: page(first, 25) });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Show more" }));
    });
    expect(load).toHaveBeenCalledWith("", filters, 24);
  });

  it("says when results stop at the cap", () => {
    const cards = Array.from({ length: 200 }, (_, i) =>
      card(i + 1, `Mecha ${i + 1}`),
    );
    setup({ initialFilters: ACTION, initialPage: page(cards, 201) });
    expect(
      screen.getByText(
        "Showing the first 200. Add a filter to narrow it down.",
      ),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Show more" })).toBeNull();
  });

  describe("the phone sheet", () => {
    /** Opens the sheet: its Filters button is the dialog's only trigger. */
    function openSheet() {
      fireEvent.click(screen.getByRole("button", { name: /^Filters/ }));
      return screen.getByRole("dialog");
    }

    it("applies only on Show results", async () => {
      load.mockResolvedValue(page([card(2, "Bebop")]));
      setup();
      const sheet = openSheet();
      fireEvent.click(within(sheet).getByRole("button", { name: "Comedy" }));
      expect(load).not.toHaveBeenCalled();
      expect(window.location.search).toBe("");

      await act(async () => {
        fireEvent.click(
          within(sheet).getByRole("button", { name: "Show results" }),
        );
      });
      expect(load).toHaveBeenCalledWith(
        "",
        { ...EMPTY_FILTERS, genres: ["comedy"] },
        0,
      );
      expect(window.location.search).toBe("?genre=comedy");
    });

    it("closing without Show results discards the changes", () => {
      setup();
      const sheet = openSheet();
      fireEvent.click(within(sheet).getByRole("button", { name: "Comedy" }));
      fireEvent.click(
        within(sheet).getByRole("button", { name: "Close filters" }),
      );
      expect(load).not.toHaveBeenCalled();
      expect(
        screen.queryByRole("button", { name: "Remove filter: Comedy" }),
      ).toBeNull();
    });

    it("keeps Season off until a single year is chosen", () => {
      setup();
      const sheet = openSheet();
      const fall = within(sheet).getByRole("button", {
        name: "Fall",
      }) as HTMLButtonElement;
      expect(fall.disabled).toBe(true);
      fireEvent.click(within(sheet).getByRole("button", { name: "2023" }));
      expect(fall.disabled).toBe(false);
      fireEvent.click(within(sheet).getByRole("button", { name: "1990s" }));
      expect(fall.disabled).toBe(true);
    });
  });
});
