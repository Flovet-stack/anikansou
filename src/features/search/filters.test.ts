import { describe, expect, it } from "vitest";

import {
  EMPTY_FILTERS,
  type Filters,
  GENRE_KEYS,
  activeFilterCount,
  clearedFilters,
  filterChips,
  filterParams,
  hasFilters,
  parseFilters,
  toggled,
  TYPES,
  withYear,
  yearOptions,
  yearRange,
} from "./filters";
import {
  discoverHref,
  effectiveQuery,
  noResultsText,
  resultsText,
  shouldSearch,
} from "./logic";

const SOME: Filters = {
  types: ["tv", "movie"],
  genres: ["action", "sci-fi"],
  year: "2023",
  season: "fall",
  status: "airing",
  sort: "newest",
};

describe("parseFilters", () => {
  it("reads the format 0020 sets out, comma separated or repeated", () => {
    expect(
      parseFilters({
        type: "tv,movie",
        genre: ["action", "sci-fi"],
        year: "2023",
        season: "fall",
        status: "airing",
        sort: "newest",
      }),
    ).toEqual(SOME);
  });

  it("drops unknown values rather than failing", () => {
    expect(
      parseFilters({
        type: "tv,nope",
        genre: "hentai,action",
        year: "abc",
        season: "monsoon",
        status: "lost",
        sort: "score",
      }),
    ).toEqual({ ...EMPTY_FILTERS, types: ["tv"], genres: ["action"] });
  });

  it("takes the first valid year, and needs a single year for a season", () => {
    const repeated = parseFilters({
      year: ["abc", "2023", "2024"],
      season: "fall",
    });
    expect(repeated).toMatchObject({ year: "2023", season: "fall" });
    expect(parseFilters({ season: "fall" }).season).toBeNull();
    expect(parseFilters({ year: "1990s", season: "fall" })).toMatchObject({
      year: "1990s",
      season: null,
    });
  });

  it("refuses old single years, which the menu groups by decade", () => {
    expect(parseFilters({ year: "1995" }).year).toBeNull();
    expect(parseFilters({ year: "1995s" }).year).toBeNull();
    expect(parseFilters({ year: "pre1970" }).year).toBe("pre1970");
  });

  it("keeps a fixed order, whatever the URL's order", () => {
    expect(parseFilters({ type: "movie,tv" }).types).toEqual(["tv", "movie"]);
  });
});

describe("filter URLs", () => {
  it("round-trips through discoverHref and parseFilters", () => {
    const href = discoverHref("gundam", SOME);
    expect(href).toBe(
      "/discover?q=gundam&type=tv,movie&genre=action,sci-fi&year=2023&season=fall&status=airing&sort=newest",
    );
    const params = Object.fromEntries(
      new URL(href, "https://x.test").searchParams,
    );
    expect(parseFilters(params)).toEqual(SOME);
  });

  it("leaves out empty values and the default sort", () => {
    expect(filterParams(EMPTY_FILTERS)).toEqual([]);
    expect(discoverHref("", EMPTY_FILTERS)).toBe("/discover");
    expect(discoverHref("", { ...EMPTY_FILTERS, types: ["tv"] })).toBe(
      "/discover?type=tv",
    );
  });
});

describe("yearRange and yearOptions", () => {
  it("turns a choice into a range", () => {
    expect(yearRange(null)).toEqual({ from: null, to: null });
    expect(yearRange("2023")).toEqual({ from: 2023, to: 2023 });
    expect(yearRange("1990s")).toEqual({ from: 1990, to: 1999 });
    expect(yearRange("pre1970")).toEqual({ from: null, to: 1969 });
  });

  it("lists single years down to 2000, then decades", () => {
    const options = yearOptions(2030).map((option) => option.value);
    expect(options[0]).toBe("2030");
    expect(options.slice(-5)).toEqual([
      "2000",
      "1990s",
      "1980s",
      "1970s",
      "pre1970",
    ]);
    expect(yearOptions(2030).at(-1)?.label).toBe("Before 1970");
  });
});

describe("season rule", () => {
  it("clears the season when the year stops being a single year", () => {
    expect(withYear(SOME, "2024").season).toBe("fall");
    expect(withYear(SOME, "1990s").season).toBeNull();
    expect(withYear(SOME, null).season).toBeNull();
  });
});

describe("hasFilters and clearing", () => {
  it("doesn't count sort as a filter", () => {
    expect(hasFilters({ ...EMPTY_FILTERS, sort: "newest" })).toBe(false);
    expect(activeFilterCount(SOME)).toBe(7);
  });

  it("clearing keeps the sort", () => {
    expect(clearedFilters(SOME)).toEqual({
      ...EMPTY_FILTERS,
      sort: "newest",
    });
  });

  it("toggles a value in a fixed order", () => {
    expect(toggled(["movie"], "tv", TYPES)).toEqual(["tv", "movie"]);
    expect(toggled(["tv", "movie"], "tv", TYPES)).toEqual(["movie"]);
  });
});

describe("filterChips", () => {
  it("labels each active filter and removes only that one", () => {
    const chips = filterChips(SOME);
    expect(chips.map((chip) => chip.label)).toEqual([
      "TV",
      "Movie",
      "Action",
      "Sci-Fi",
      "2023",
      "Fall",
      "Airing",
    ]);
    expect(chips[0]?.without.types).toEqual(["movie"]);
    expect(chips[0]?.without.genres).toEqual(SOME.genres);
  });

  it("removing the year takes the season with it", () => {
    const year = filterChips(SOME).find((chip) => chip.key === "year");
    expect(year?.without).toMatchObject({ year: null, season: null });
  });

  it("says Before 1970 in words", () => {
    expect(filterChips({ ...EMPTY_FILTERS, year: "pre1970" })[0]?.label).toBe(
      "Before 1970",
    );
  });
});

describe("search text with filters", () => {
  it("counts results without a query", () => {
    expect(resultsText(1, "")).toBe("1 result");
    expect(resultsText(36, "")).toBe("36 results");
    expect(resultsText(201, "")).toBe("200+ results");
    expect(resultsText(36, "gundam")).toBe('36 results for "gundam"');
  });

  it("uses 0020's no-results message when a filter is on", () => {
    expect(noResultsText("x", SOME)).toBe("No anime match these filters.");
    expect(noResultsText("naurto", EMPTY_FILTERS)).toBe(
      "No anime match “naurto”.",
    );
  });

  it("searches on a real query or a filter", () => {
    expect(shouldSearch("", EMPTY_FILTERS)).toBe(false);
    expect(shouldSearch("a", EMPTY_FILTERS)).toBe(false);
    expect(shouldSearch("", { ...EMPTY_FILTERS, sort: "newest" })).toBe(false);
    expect(shouldSearch("bebop", EMPTY_FILTERS)).toBe(true);
    expect(shouldSearch("", SOME)).toBe(true);
  });

  it("doesn't send a query too short to mean anything", () => {
    expect(effectiveQuery("a")).toBe("");
    expect(effectiveQuery("!!")).toBe("");
    expect(effectiveQuery("ao")).toBe("ao");
  });
});

describe("GENRE_KEYS", () => {
  it("has the 24 curated genres, no adult tags", () => {
    expect(GENRE_KEYS).toHaveLength(24);
    expect(GENRE_KEYS).not.toContain("hentai");
  });
});
