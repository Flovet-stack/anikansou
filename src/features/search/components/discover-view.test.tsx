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
    expect(load).toHaveBeenCalledWith("frie", 0);

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
    expect(screen.getByText("No anime match “zzzzqqq”.")).toBeTruthy();

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
    expect(load).toHaveBeenCalledWith("mecha", 24);
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
