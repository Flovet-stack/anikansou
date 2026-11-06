import type { Entry } from "./schema.ts";

export type NormalizedUrl = {
  /** Host without `www.`, lowercase. Derived from the URL, never hardcoded. */
  site: string;
  /** Path plus query string: some sites carry the ID in the query. */
  externalId: string;
  url: string;
  /** `site` + `externalId`, the identity key used for matching. */
  key: string;
};

export type AnimeType = "tv" | "movie" | "ova" | "ona" | "special";
export type AnimeStatus = "finished" | "ongoing" | "upcoming";
export type Season = "winter" | "spring" | "summer" | "fall";
export type TitleKind = "main" | "synonym";
export type StudioRole = "studio" | "producer";

export type NormalizedAnime = {
  urls: NormalizedUrl[];
  title: string;
  type: AnimeType | null;
  episodes: number | null;
  status: AnimeStatus | null;
  season: Season | null;
  year: number | null;
  durationSeconds: number | null;
  score: { agm: number; mean: number; median: number } | null;
  titles: { title: string; kind: TitleKind; searchText: string }[];
  studios: { raw: string; role: StudioRole }[];
  tags: string[];
  related: NormalizedUrl[];
};

export function normalizeUrl(input: string): NormalizedUrl {
  const parsed = new URL(input);
  const site = parsed.hostname.toLowerCase().replace(/^www\./, "");
  const path = parsed.pathname.replace(/\/+$/, "") || "/";
  const externalId = `${path}${parsed.search}`;
  return { site, externalId, url: input, key: `${site}${externalId}` };
}

/** The normalized form titles are searched by: NFKC, lowercase, single spaces. */
export function searchText(title: string): string {
  return title.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
}

// Corporate suffixes stripped from the end of studio names, longest first.
const STUDIO_SUFFIXES = [
  "kabushiki kaisha",
  "corporation",
  "company",
  "limited",
  "co., ltd.",
  "co.,ltd.",
  "co. ltd.",
  "co ltd",
  "co.",
  "corp.",
  "corp",
  "inc.",
  "inc",
  "ltd.",
  "ltd",
  "llc",
  "k.k.",
  "gmbh",
];

/**
 * One key per studio: different writings of the same company (`wit studio`
 * and `wit studio, inc.`) share it. Overrides fix the rare false merge.
 */
export function studioKey(raw: string): string {
  let key = raw.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
  let changed = true;
  while (changed) {
    changed = false;
    key = key.replace(/[\s,]+$/, "");
    for (const suffix of STUDIO_SUFFIXES) {
      if (key.endsWith(` ${suffix}`) || key.endsWith(`,${suffix}`)) {
        key = key.slice(0, -suffix.length);
        changed = true;
        break;
      }
    }
  }
  return key.replace(/[\s,]+$/, "") || raw.toLowerCase().trim();
}

const TYPES: Record<Entry["type"], AnimeType | null> = {
  TV: "tv",
  MOVIE: "movie",
  OVA: "ova",
  ONA: "ona",
  SPECIAL: "special",
  UNKNOWN: null,
};

const STATUSES: Record<Entry["status"], AnimeStatus | null> = {
  FINISHED: "finished",
  ONGOING: "ongoing",
  UPCOMING: "upcoming",
  UNKNOWN: null,
};

const SEASONS: Record<Entry["animeSeason"]["season"], Season | null> = {
  WINTER: "winter",
  SPRING: "spring",
  SUMMER: "summer",
  FALL: "fall",
  UNDEFINED: null,
};

function uniqueBy<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const k = key(item);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function normalizeEntry(entry: Entry): NormalizedAnime {
  const urls = uniqueBy(entry.sources.map(normalizeUrl), (u) => u.key);
  const ownKeys = new Set(urls.map((u) => u.key));

  const titles = uniqueBy(
    [
      { title: entry.title, kind: "main" as const },
      ...entry.synonyms.map((title) => ({ title, kind: "synonym" as const })),
    ]
      .map((t) => ({ ...t, searchText: searchText(t.title) }))
      .filter((t) => t.searchText !== ""),
    (t) => t.searchText,
  );

  const studios = uniqueBy(
    [
      ...entry.studios.map((raw) => ({ raw, role: "studio" as const })),
      ...entry.producers.map((raw) => ({ raw, role: "producer" as const })),
    ],
    (s) => `${s.role}\u0000${s.raw}`,
  );

  return {
    urls,
    title: entry.title,
    type: TYPES[entry.type],
    episodes: entry.episodes > 0 ? entry.episodes : null,
    status: STATUSES[entry.status],
    season: SEASONS[entry.animeSeason.season],
    year: entry.animeSeason.year ?? null,
    durationSeconds: entry.duration ? Math.round(entry.duration.value) : null,
    score: entry.score
      ? {
          agm: entry.score.arithmeticGeometricMean,
          mean: entry.score.arithmeticMean,
          median: entry.score.median,
        }
      : null,
    titles,
    studios,
    tags: uniqueBy(
      entry.tags.map((t) => t.normalize("NFKC").toLowerCase().trim()),
      (t) => t,
    ).filter((t) => t !== ""),
    related: uniqueBy(
      entry.relatedAnime.map(normalizeUrl),
      (u) => u.key,
    ).filter((u) => !ownKeys.has(u.key)),
  };
}
