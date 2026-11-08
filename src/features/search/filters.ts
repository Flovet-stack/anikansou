/** Search filters (decision 0020): what can be chosen, and how it's written in the URL. */

export const TYPES = ["tv", "movie", "ova", "ona", "special"] as const;
export type AnimeType = (typeof TYPES)[number];

export const TYPE_LABELS: Record<AnimeType, string> = {
  tv: "TV",
  movie: "Movie",
  ova: "OVA",
  ona: "ONA",
  special: "Special",
};

/**
 * The curated genres, in menu order. Keys match `catalog.genre_tag_names` in
 * the database, which maps each one to its raw tags (a test checks they agree).
 */
export const GENRES = [
  { key: "action", label: "Action", group: "genre" },
  { key: "adventure", label: "Adventure", group: "genre" },
  { key: "comedy", label: "Comedy", group: "genre" },
  { key: "drama", label: "Drama", group: "genre" },
  { key: "fantasy", label: "Fantasy", group: "genre" },
  { key: "historical", label: "Historical", group: "genre" },
  { key: "horror", label: "Horror", group: "genre" },
  { key: "isekai", label: "Isekai", group: "genre" },
  { key: "mecha", label: "Mecha", group: "genre" },
  { key: "military", label: "Military", group: "genre" },
  { key: "music", label: "Music", group: "genre" },
  { key: "mystery", label: "Mystery", group: "genre" },
  { key: "psychological", label: "Psychological", group: "genre" },
  { key: "romance", label: "Romance", group: "genre" },
  { key: "school", label: "School", group: "genre" },
  { key: "sci-fi", label: "Sci-Fi", group: "genre" },
  { key: "slice-of-life", label: "Slice of life", group: "genre" },
  { key: "sports", label: "Sports", group: "genre" },
  { key: "supernatural", label: "Supernatural", group: "genre" },
  { key: "thriller", label: "Thriller", group: "genre" },
  { key: "shounen", label: "Shounen", group: "audience" },
  { key: "shoujo", label: "Shoujo", group: "audience" },
  { key: "seinen", label: "Seinen", group: "audience" },
  { key: "josei", label: "Josei", group: "audience" },
] as const;
export type GenreKey = (typeof GENRES)[number]["key"];
export const GENRE_KEYS = GENRES.map((genre) => genre.key) as GenreKey[];

export const SEASONS = ["winter", "spring", "summer", "fall"] as const;
export type Season = (typeof SEASONS)[number];
export const SEASON_LABELS: Record<Season, string> = {
  winter: "Winter",
  spring: "Spring",
  summer: "Summer",
  fall: "Fall",
};

/** In the URL and the UI; `airing` is the catalog's `ongoing`. */
export const STATUSES = ["airing", "finished", "upcoming"] as const;
export type Status = (typeof STATUSES)[number];
export const STATUS_LABELS: Record<Status, string> = {
  airing: "Airing",
  finished: "Finished",
  upcoming: "Upcoming",
};
export const STATUS_TO_DB: Record<Status, string> = {
  airing: "ongoing",
  finished: "finished",
  upcoming: "upcoming",
};

export const SORTS = ["best", "newest", "oldest", "title"] as const;
export type Sort = (typeof SORTS)[number];
export const DEFAULT_SORT: Sort = "best";
export const SORT_LABELS: Record<Sort, string> = {
  best: "Best match",
  newest: "Newest",
  oldest: "Oldest",
  title: "Title (A–Z)",
};

/** Each year down to this one gets its own entry; older ones go by decade. */
const FIRST_SINGLE_YEAR = 2000;
const DECADES = ["1990s", "1980s", "1970s"] as const;
const BEFORE_1970 = "pre1970";

export type Filters = {
  types: AnimeType[];
  genres: GenreKey[];
  /** A single year (`2023`), a decade (`1990s`) or `pre1970`. */
  year: string | null;
  /** Only with a single year. */
  season: Season | null;
  status: Status | null;
  sort: Sort;
};

export const EMPTY_FILTERS: Filters = {
  types: [],
  genres: [],
  year: null,
  season: null,
  status: null,
  sort: DEFAULT_SORT,
};

export function isSingleYear(year: string | null): boolean {
  return year !== null && /^\d{4}$/.test(year);
}

function isYearValue(value: string): boolean {
  if (value === BEFORE_1970) return true;
  if ((DECADES as readonly string[]).includes(value)) return true;
  if (!isSingleYear(value)) return false;
  return Number(value) >= FIRST_SINGLE_YEAR && Number(value) <= 9999;
}

/** The year range a Year choice stands for, for the database. */
export function yearRange(year: string | null): {
  from: number | null;
  to: number | null;
} {
  if (year === null) return { from: null, to: null };
  if (year === BEFORE_1970) return { from: null, to: 1969 };
  const decade = /^(\d{4})s$/.exec(year);
  if (decade) {
    const from = Number(decade[1]);
    return { from, to: from + 9 };
  }
  return { from: Number(year), to: Number(year) };
}

/** Year menu entries, newest first (0020), from the catalog's latest year. */
export function yearOptions(
  latest: number,
): { value: string; label: string }[] {
  const years: { value: string; label: string }[] = [];
  for (let year = latest; year >= FIRST_SINGLE_YEAR; year--) {
    years.push({ value: String(year), label: String(year) });
  }
  return [
    ...years,
    ...DECADES.map((value) => ({ value, label: value })),
    { value: BEFORE_1970, label: "Before 1970" },
  ];
}

function yearLabel(year: string): string {
  return year === BEFORE_1970 ? "Before 1970" : year;
}

/** Whether any filter is on. Sort alone isn't a filter: it only orders. */
export function hasFilters(filters: Filters): boolean {
  return activeFilterCount(filters) > 0;
}

export function activeFilterCount(filters: Filters): number {
  return (
    filters.types.length +
    filters.genres.length +
    (filters.year === null ? 0 : 1) +
    (filters.season === null ? 0 : 1) +
    (filters.status === null ? 0 : 1)
  );
}

/** Changes the year; a season only survives on a single year (0020). */
export function withYear(filters: Filters, year: string | null): Filters {
  return {
    ...filters,
    year,
    season: isSingleYear(year) ? filters.season : null,
  };
}

/** Turns a value on or off, keeping the list in its fixed order. */
export function toggled<T extends string>(
  list: readonly T[],
  value: T,
  order: readonly T[],
): T[] {
  const on = list.includes(value)
    ? list.filter((item) => item !== value)
    : [...list, value];
  return order.filter((item) => on.includes(item));
}

/** Every active filter as a removable chip, with the filters left without it. */
export function filterChips(
  filters: Filters,
): { key: string; label: string; without: Filters }[] {
  return [
    ...filters.types.map((type) => ({
      key: `type:${type}`,
      label: TYPE_LABELS[type],
      without: { ...filters, types: filters.types.filter((t) => t !== type) },
    })),
    ...filters.genres.map((key) => ({
      key: `genre:${key}`,
      label: GENRES.find((genre) => genre.key === key)?.label ?? key,
      without: { ...filters, genres: filters.genres.filter((g) => g !== key) },
    })),
    ...(filters.year === null
      ? []
      : [
          {
            key: "year",
            label: yearLabel(filters.year),
            without: withYear(filters, null),
          },
        ]),
    ...(filters.season === null
      ? []
      : [
          {
            key: "season",
            label: SEASON_LABELS[filters.season],
            without: { ...filters, season: null },
          },
        ]),
    ...(filters.status === null
      ? []
      : [
          {
            key: "status",
            label: STATUS_LABELS[filters.status],
            without: { ...filters, status: null },
          },
        ]),
  ];
}

/** Every filter off; the sort stays, since it isn't a filter. */
export function clearedFilters(filters: Filters): Filters {
  return { ...EMPTY_FILTERS, sort: filters.sort };
}

type RawParam = string | string[] | undefined;

function values(param: RawParam): string[] {
  const list = Array.isArray(param)
    ? param
    : param === undefined
      ? []
      : [param];
  return list.flatMap((value) => value.split(","));
}

function firstOf<T extends string>(
  param: RawParam,
  allowed: readonly T[],
): T | null {
  return (
    values(param).find((value): value is T =>
      (allowed as readonly string[]).includes(value),
    ) ?? null
  );
}

function allOf<T extends string>(param: RawParam, allowed: readonly T[]): T[] {
  const chosen = new Set(values(param));
  return allowed.filter((value) => chosen.has(value));
}

/** Reads filters from the URL. Unknown values are dropped, never errors. */
export function parseFilters(params: {
  type?: RawParam;
  genre?: RawParam;
  year?: RawParam;
  season?: RawParam;
  status?: RawParam;
  sort?: RawParam;
}): Filters {
  const year = values(params.year).find(isYearValue) ?? null;
  return {
    types: allOf(params.type, TYPES),
    genres: allOf(params.genre, GENRE_KEYS),
    year,
    season: isSingleYear(year) ? firstOf(params.season, SEASONS) : null,
    status: firstOf(params.status, STATUSES),
    sort: firstOf(params.sort, SORTS) ?? DEFAULT_SORT,
  };
}

/** The URL's filter parts, in a fixed order. Empty values and the default sort are left out. */
export function filterParams(filters: Filters): string[] {
  const parts: string[] = [];
  if (filters.types.length > 0) parts.push(`type=${filters.types.join(",")}`);
  if (filters.genres.length > 0) {
    parts.push(`genre=${filters.genres.join(",")}`);
  }
  if (filters.year !== null) parts.push(`year=${filters.year}`);
  if (filters.season !== null) parts.push(`season=${filters.season}`);
  if (filters.status !== null) parts.push(`status=${filters.status}`);
  if (filters.sort !== DEFAULT_SORT) parts.push(`sort=${filters.sort}`);
  return parts;
}
