/**
 * `search_anime` from spec 09's migration (decision 0018), run against the
 * real migrations in an in-memory Postgres (PGlite): matching on any title,
 * ranking, the caller's own state only, signed-out use, input limits and the
 * 200-result cap. Ranking on the live catalog is checked in the PR's probe.
 */
import type { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Test-only: the migrated database fixture lives with the importer's tests.
import { createTestDb } from "../../sync/fixtures/test-db";
import { searchText } from "../../sync/normalize";

import { GENRE_KEYS } from "./filters";

const ALICE = "00000000-0000-4000-8000-00000000000a";
const BOB = "00000000-0000-4000-8000-00000000000b";

type Row = Record<string, unknown>;
type Hit = {
  anime_id: number;
  title: string;
  matched_title: string | null;
  is_adult: boolean;
  is_upcoming: boolean;
  status: string | null;
  rating: number | null;
  liked: boolean;
  watchlisted: boolean;
  total: number;
};

vi.setConfig({ testTimeout: 60_000, hookTimeout: 120_000 });

let pg: PGlite;

async function rows<T = Row>(sql: string, params: unknown[] = []) {
  return (await pg.query<T>(sql, params)).rows;
}

/** Runs `fn` as `role`, signed in as `user` when given, like the API. */
async function as<T>(
  role: "anon" | "authenticated",
  user: string | null,
  fn: () => Promise<T>,
): Promise<T> {
  await pg.exec(`set role ${role}`);
  await pg.query(`select set_config('request.jwt.claim.sub', $1, false)`, [
    user ?? "",
  ]);
  try {
    return await fn();
  } finally {
    await pg.exec(`reset role`);
    await pg.query(`select set_config('request.jwt.claim.sub', '', false)`);
  }
}

function search(
  query: string,
  opts: { user?: string | null; offset?: number; limit?: number } = {},
) {
  const user = opts.user === undefined ? ALICE : opts.user;
  return as(user ? "authenticated" : "anon", user, () =>
    rows<Hit>(`select * from public.search_anime($1, $2, $3)`, [
      query,
      opts.offset ?? 0,
      opts.limit ?? 24,
    ]),
  );
}

type FilterArgs = {
  query?: string | null;
  offset?: number;
  limit?: number;
  types?: string[];
  genres?: string[];
  yearFrom?: number;
  yearTo?: number;
  season?: string;
  status?: string;
  sort?: string;
  user?: string | null;
};

/** The filtered search, with named arguments like the app's call. */
function filtered(args: FilterArgs) {
  const user = args.user === undefined ? ALICE : args.user;
  return as(user ? "authenticated" : "anon", user, () =>
    rows<Hit>(
      `select * from public.search_anime(
         p_query => $1, p_offset => $2, p_limit => $3, p_types => $4,
         p_genres => $5, p_year_from => $6, p_year_to => $7, p_season => $8,
         p_status => $9, p_sort => $10)`,
      [
        args.query ?? null,
        args.offset ?? 0,
        args.limit ?? 24,
        args.types ?? null,
        args.genres ?? null,
        args.yearFrom ?? null,
        args.yearTo ?? null,
        args.season ?? null,
        args.status ?? null,
        args.sort ?? "best",
      ],
    ),
  );
}

const ids = (hits: Hit[]) => hits.map((hit) => hit.anime_id);
const sorted = (list: number[]) => [...list].sort((a, b) => a - b);

async function errorOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  return "";
}

/** An anime with its main title and synonyms, as the importer stores them. */
async function anime(
  title: string,
  opts: {
    synonyms?: string[];
    score?: number;
    retired?: boolean;
    status?: string | null;
    tags?: string[];
    type?: string | null;
    year?: number | null;
    season?: string | null;
  } = {},
) {
  const [inserted] = await rows<{ id: number }>(
    `insert into catalog.anime
       (title, type, status, year, content_hash, first_seen_run_id, last_changed_run_id, retired_at)
     values ($1, $4::catalog.anime_type, $3::catalog.anime_status, $5, 'h',
             (select max(id) from catalog.import_runs), (select max(id) from catalog.import_runs),
             case when $2 then now() end)
     returning id`,
    [
      title,
      opts.retired ?? false,
      opts.status === undefined ? "finished" : opts.status,
      opts.type === undefined ? "tv" : opts.type,
      opts.year === undefined ? 2020 : opts.year,
    ],
  );
  if (!inserted) throw new Error(`Could not insert ${title}`);
  const id = inserted.id;
  const titles = [
    { title, kind: "main" },
    ...(opts.synonyms ?? []).map((s) => ({ title: s, kind: "synonym" })),
  ];
  for (const t of titles) {
    await pg.query(
      `insert into catalog.anime_titles (anime_id, title, kind, search_text)
       values ($1, $2, $3::catalog.title_kind, $4)`,
      [id, t.title, t.kind, searchText(t.title)],
    );
  }
  if (opts.season) {
    await pg.query(
      `update catalog.anime set season = $2::catalog.season where id = $1`,
      [id, opts.season],
    );
  }
  if (opts.score !== undefined) {
    await pg.query(
      `insert into catalog.anime_scores (anime_id, arithmetic_geometric_mean, arithmetic_mean, median)
       values ($1, $2, $2, $2)`,
      [id, opts.score],
    );
  }
  for (const tag of opts.tags ?? []) {
    await pg.query(
      `with t as (
         insert into catalog.tags (name) values ($1)
         on conflict (name) do update set name = excluded.name
         returning id
       )
       insert into catalog.anime_tags (anime_id, tag_id) select $2, id from t`,
      [tag, id],
    );
  }
  return id;
}

beforeEach(async () => {
  ({ pg } = await createTestDb());
  await pg.exec(`
    grant usage on schema auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
    insert into auth.users (id) values ('${ALICE}'), ('${BOB}');
    insert into catalog.import_runs (data_source_id, release_tag, sha256, trigger)
      select id, 'test', 'x', 'manual' from catalog.data_sources limit 1;
  `);
});

// Each test has its own database: free it, or a long file runs out of memory.
afterEach(async () => {
  await pg.close();
});

describe("search_anime matching", () => {
  it("matches the main title or any synonym, one row per anime", async () => {
    const frieren = await anime("Sousou no Frieren", {
      synonyms: ["Frieren: Beyond Journey's End", "葬送のフリーレン"],
    });
    await anime("Cowboy Bebop");

    const byMain = await search("frieren");
    expect(byMain.map((r) => r.anime_id)).toEqual([frieren]);
    expect(byMain[0]?.matched_title).toBeNull();

    const byEnglish = await search("Frieren Beyond Journeys End");
    expect(byEnglish.map((r) => r.anime_id)).toEqual([frieren]);
    expect(byEnglish[0]?.matched_title).toBe("Frieren: Beyond Journey's End");

    const byJapanese = await search("葬送");
    expect(byJapanese.map((r) => r.anime_id)).toEqual([frieren]);
    expect(byJapanese[0]?.matched_title).toBe("葬送のフリーレン");
  });

  it("normalizes the query like the importer (NFKC, case, spaces)", async () => {
    const kon = await anime("K-On!");
    // Full-width letters and hyphen become "k-on" under NFKC.
    expect((await search("  Ｋ－ＯＮ  ")).map((r) => r.anime_id)).toEqual([
      kon,
    ]);
    expect((await search("k-ON")).map((r) => r.anime_id)).toEqual([kon]);
  });

  it("skips retired anime and flags adult and upcoming ones", async () => {
    await anime("Robo Retired", { retired: true });
    const adult = await anime("Robo Adult", { tags: ["hentai"] });
    const upcoming = await anime("Robo Upcoming", { status: "upcoming" });
    const got = await search("robo");
    expect(got.map((r) => r.anime_id).sort()).toEqual([adult, upcoming].sort());
    const byId = new Map(got.map((r) => [r.anime_id, r]));
    expect(byId.get(adult)?.is_adult).toBe(true);
    expect(byId.get(adult)?.is_upcoming).toBe(false);
    expect(byId.get(upcoming)?.is_upcoming).toBe(true);
    expect(byId.get(upcoming)?.is_adult).toBe(false);
  });

  it("never returns a score or similarity value", async () => {
    await anime("One Piece", { score: 9 });
    const [row] = await search("one piece");
    expect(Object.keys(row ?? {}).sort()).toEqual(
      [
        "anime_id",
        "duration_seconds",
        "episodes",
        "is_adult",
        "is_upcoming",
        "liked",
        "matched_title",
        "native_title",
        "rating",
        "status",
        "title",
        "total",
        "type",
        "watchlisted",
        "year",
      ].sort(),
    );
  });
});

describe("search_anime short queries (0019)", () => {
  it("under 4 letters, matches only titles that start with the query", async () => {
    const ngnl = await anime("No Game No Life");
    const noragami = await anime("Noragami");
    await anime("Sousou no Frieren");
    const aot = await anime("Shingeki no Kyojin", { synonyms: ["AoT"] });
    const got = await search("no");
    expect(got.map((r) => r.anime_id).sort()).toEqual([ngnl, noragami].sort());

    const bySynonym = await search("aot");
    expect(bySynonym.map((r) => r.anime_id)).toEqual([aot]);
    expect(bySynonym[0]?.matched_title).toBe("AoT");
  });

  it("counts letters and digits only: k-on is short, bebo is not", async () => {
    const kon = await anime("K-On!");
    const bebop = await anime("Cowboy Bebop");
    expect((await search("k-on")).map((r) => r.anime_id)).toEqual([kon]);
    // 3 letters in the middle of a title: no prefix match.
    expect(await search("bop")).toEqual([]);
    // 4 letters: word similarity again.
    expect((await search("bebo")).map((r) => r.anime_id)).toEqual([bebop]);
  });

  it("matches Japanese prefixes", async () => {
    const frieren = await anime("Sousou no Frieren", {
      synonyms: ["葬送のフリーレン"],
    });
    expect((await search("葬送")).map((r) => r.anime_id)).toEqual([frieren]);
  });
});

describe("search_anime ranking", () => {
  it("puts an exact main title first, then an exact synonym, then partial matches", async () => {
    const partial = await anime("One Piece Film: Red", { score: 9.5 });
    const synonym = await anime("Wan Pisu Special", {
      synonyms: ["One Piece"],
      score: 9,
    });
    const main = await anime("One Piece", { score: 1 });
    const got = await search("one piece");
    expect(got.map((r) => r.anime_id)).toEqual([main, synonym, partial]);
  });

  it("breaks ties with the private score, then the id", async () => {
    const low = await anime("Bebop Low", { score: 5 });
    const high = await anime("Bebop High", { score: 8 });
    const none = await anime("Bebop None");
    const alsoLow = await anime("Bebop Also", { score: 5 });
    const got = await search("bebop");
    expect(got.map((r) => r.anime_id)).toEqual([high, low, alsoLow, none]);
  });
});

describe("search_anime state", () => {
  it("returns the caller's own state only, and none when signed out", async () => {
    const id = await anime("Cowboy Bebop");
    await pg.query(
      `insert into public.user_anime (user_id, anime_id, status, rating, liked, watchlisted)
       values ($1, $2, 'watched', 9, true, false), ($3, $2, 'dropped', null, false, true)`,
      [ALICE, id, BOB],
    );

    const [alice] = await search("bebop", { user: ALICE });
    expect(alice).toMatchObject({
      status: "watched",
      rating: 9,
      liked: true,
      watchlisted: false,
    });

    const [bob] = await search("bebop", { user: BOB });
    expect(bob).toMatchObject({
      status: "dropped",
      rating: null,
      liked: false,
      watchlisted: true,
    });

    // Signed out: no state at all (spec 09 #2, migration for 0019).
    const [anon] = await search("bebop", { user: null });
    expect(anon).toMatchObject({
      anime_id: id,
      status: null,
      rating: null,
      liked: null,
      watchlisted: null,
    });

    // Signed in without a row: not liked, not on the watchlist.
    const [none] = await search("bebop", { user: ALICE });
    await pg.query(`delete from public.user_anime where user_id = $1`, [ALICE]);
    const [cleared] = await search("bebop", { user: ALICE });
    expect(none?.liked).toBe(true);
    expect(cleared).toMatchObject({ liked: false, watchlisted: false });
  });
});

describe("search_anime limits", () => {
  it("rejects queries under 2 real characters or over 100", async () => {
    await anime("Ao");
    expect(await errorOf(search("a"))).toMatch(/at least 2 characters/);
    expect(await errorOf(search(" ! ! "))).toMatch(/at least 2 characters/);
    expect(await errorOf(search("x".repeat(101)))).toMatch(/at most 100/);
    expect(await search("ao")).toHaveLength(1);
  });

  it("rejects pages over 24 and offsets past 200", async () => {
    await anime("Bebop");
    expect(await errorOf(search("bebop", { limit: 25 }))).toMatch(/1 to 24/);
    expect(await errorOf(search("bebop", { offset: 200 }))).toMatch(
      /first 200/,
    );
    expect(await errorOf(search("bebop", { offset: -1 }))).toMatch(/first 200/);
  });

  it("caps the total at 201 and stops at the 200th result", async () => {
    await pg.exec(`
      with a as (
        insert into catalog.anime (title, type, status, year, content_hash, first_seen_run_id, last_changed_run_id)
        select 'Mecha ' || n, 'tv', 'finished', 2020, 'h',
               (select max(id) from catalog.import_runs), (select max(id) from catalog.import_runs)
        from generate_series(1, 210) n
        returning id, title
      )
      insert into catalog.anime_titles (anime_id, title, kind, search_text)
      select id, title, 'main', lower(title) from a;
    `);
    const first = await search("mecha");
    expect(first).toHaveLength(24);
    expect(first[0]?.total).toBe(201);

    const last = await search("mecha", { offset: 192 });
    expect(last).toHaveLength(8);

    const seen = new Set<number>();
    for (let offset = 0; offset < 200; offset += 24) {
      for (const row of await search("mecha", { offset })) {
        seen.add(row.anime_id);
      }
    }
    expect(seen.size).toBe(200);
  });
});

describe("search_anime filters (0020)", () => {
  it("matches any of several types", async () => {
    const tv = await anime("Alpha", { type: "tv" });
    const movie = await anime("Beta", { type: "movie" });
    await anime("Gamma", { type: "ova" });
    await anime("Untyped", { type: null });
    expect(sorted(ids(await filtered({ types: ["tv", "movie"] })))).toEqual(
      sorted([tv, movie]),
    );
  });

  it("matches all of several genres", async () => {
    const both = await anime("Both", { tags: ["action", "comedy"] });
    await anime("Action only", { tags: ["action"] });
    await anime("Comedy only", { tags: ["comedy"] });
    expect(ids(await filtered({ genres: ["action", "comedy"] }))).toEqual([
      both,
    ]);
  });

  it.each(["sci-fi", "science fiction", "sci fi", "science-fiction"])(
    "finds Sci-Fi through the %s tag",
    async (tag) => {
      const id = await anime("Space show", { tags: [tag] });
      await anime("Not space", { tags: ["comedy"] });
      expect(ids(await filtered({ genres: ["sci-fi"] }))).toEqual([id]);
    },
  );

  it("shows an anime with several of a genre's tags once", async () => {
    const id = await anime("Doubly space", {
      tags: ["sci-fi", "science fiction"],
    });
    expect(ids(await filtered({ genres: ["sci-fi"] }))).toEqual([id]);
  });

  it("filters by year range, season and status", async () => {
    const fall = await anime("Fall one", { year: 2023, season: "fall" });
    const spring = await anime("Spring one", { year: 2023, season: "spring" });
    const nineties = await anime("Old one", { year: 1995 });
    const airing = await anime("Airing one", { year: 2024, status: "ongoing" });

    expect(
      ids(await filtered({ yearFrom: 2023, yearTo: 2023, season: "fall" })),
    ).toEqual([fall]);
    expect(
      sorted(ids(await filtered({ yearFrom: 2023, yearTo: 2023 }))),
    ).toEqual(sorted([fall, spring]));
    expect(ids(await filtered({ yearFrom: 1990, yearTo: 1999 }))).toEqual([
      nineties,
    ]);
    expect(ids(await filtered({ status: "ongoing" }))).toEqual([airing]);
  });

  it("shows anime missing a value only when that filter is off", async () => {
    const dated = await anime("Dated", { year: 2020, type: "tv" });
    const undated = await anime("Undated", { year: null, type: "tv" });
    expect(sorted(ids(await filtered({ types: ["tv"] })))).toEqual(
      sorted([dated, undated]),
    );
    expect(ids(await filtered({ yearFrom: 2000, yearTo: 2030 }))).toEqual([
      dated,
    ]);
  });

  it("skips retired anime", async () => {
    await anime("Gone", { retired: true, type: "movie" });
    expect(await filtered({ types: ["movie"] })).toEqual([]);
  });

  it("combines a query with filters", async () => {
    const hit = await anime("Mobile Suit Gundam", {
      tags: ["mecha"],
      type: "tv",
    });
    await anime("Gundam Movie", { tags: ["mecha"], type: "movie" });
    await anime("Gundam Quiz", { tags: ["comedy"], type: "tv" });
    expect(
      ids(
        await filtered({ query: "gundam", types: ["tv"], genres: ["mecha"] }),
      ),
    ).toEqual([hit]);
  });

  it("keeps 0019's prefix rule for a short query with a filter", async () => {
    const starts = await anime("No Game No Life", { tags: ["comedy"] });
    await anime("Sousou no Frieren", { tags: ["comedy"] });
    expect(ids(await filtered({ query: "no", genres: ["comedy"] }))).toEqual([
      starts,
    ]);
  });

  it("works signed out, with no state", async () => {
    const id = await anime("Open to all", { type: "movie" });
    const [row] = await filtered({ types: ["movie"], user: null });
    expect(row).toMatchObject({ anime_id: id, liked: null, status: null });
  });

  it("never returns a score", async () => {
    await anime("Scored", { type: "movie", score: 9 });
    const [row] = await filtered({ types: ["movie"] });
    expect(
      Object.keys(row ?? {}).filter((key) =>
        /score|similar|mean|median/.test(key),
      ),
    ).toEqual([]);
  });
});

describe("search_anime sorts (0020)", () => {
  it("best match without a query: aired first, then by private score", async () => {
    const low = await anime("Low", { type: "tv", score: 2 });
    const high = await anime("High", { type: "tv", score: 9 });
    const unaired = await anime("Unaired", {
      type: "tv",
      status: "upcoming",
      score: 10,
    });
    const none = await anime("None", { type: "tv" });
    expect(ids(await filtered({ types: ["tv"] }))).toEqual([
      high,
      low,
      none,
      unaired,
    ]);
  });

  it("browsing uses the deck's damped rank, so a tiny sample's perfect score doesn't lead", async () => {
    const perfect = await anime("Tiny sample", { type: "tv", score: 10 });
    const known = await anime("Well known", { type: "tv", score: 9 });
    const special = await anime("A special", { type: "special", score: 9.5 });
    for (let site = 0; site < 8; site++) {
      await pg.query(
        `insert into catalog.external_ids (site, external_id, anime_id, url)
         values ($1, '1', $2, 'https://x.test')`,
        [`site${site}`, known],
      );
    }
    await pg.exec(`refresh materialized view public.deck_order`);
    expect(ids(await filtered({ types: ["tv", "special"] }))).toEqual([
      known,
      perfect,
      special,
    ]);
  });

  it("counts up to 201 and stops at the 200th when browsing too", async () => {
    await pg.exec(`
      insert into catalog.anime (title, type, status, year, content_hash, first_seen_run_id, last_changed_run_id)
      select 'Mecha ' || n, 'tv', 'finished', 2020, 'h',
             (select max(id) from catalog.import_runs), (select max(id) from catalog.import_runs)
      from generate_series(1, 210) n;
    `);
    const [first] = await filtered({ types: ["tv"], limit: 1 });
    expect(first?.total).toBe(201);
    const last = await filtered({ types: ["tv"], offset: 192 });
    expect(last).toHaveLength(8);
    expect(last[0]?.total).toBe(201);
  });

  it("newest and oldest, undated last, seasons in order", async () => {
    const fall = await anime("Fall", { year: 2023, season: "fall" });
    const spring = await anime("Spring", { year: 2023, season: "spring" });
    const old = await anime("Old", { year: 2001 });
    const undated = await anime("Undated", { year: null });
    expect(ids(await filtered({ types: ["tv"], sort: "newest" }))).toEqual([
      fall,
      spring,
      old,
      undated,
    ]);
    expect(ids(await filtered({ types: ["tv"], sort: "oldest" }))).toEqual([
      old,
      spring,
      fall,
      undated,
    ]);
  });

  it("title A-Z ignores case", async () => {
    const b = await anime("beta");
    const a = await anime("Alpha");
    const c = await anime("Charlie");
    expect(ids(await filtered({ types: ["tv"], sort: "title" }))).toEqual([
      a,
      b,
      c,
    ]);
  });

  it("sorts among matches with a query", async () => {
    const older = await anime("Gundam Old", { year: 1979 });
    const newer = await anime("Gundam New", { year: 2022 });
    await anime("Bebop", { year: 2030 });
    expect(ids(await filtered({ query: "gundam", sort: "newest" }))).toEqual([
      newer,
      older,
    ]);
  });

  it.each(["best", "newest", "oldest", "title"])(
    "%s keeps a stable order across pages, even with ties",
    async (sort) => {
      await pg.exec(`
        with a as (
          insert into catalog.anime (title, type, status, year, content_hash, first_seen_run_id, last_changed_run_id)
          select 'Same title', 'tv', 'finished', 2020, 'h',
                 (select max(id) from catalog.import_runs), (select max(id) from catalog.import_runs)
          from generate_series(1, 30)
          returning id, title
        )
        insert into catalog.anime_titles (anime_id, title, kind, search_text)
        select id, title, 'main', lower(title) from a;
      `);
      const first = ids(await filtered({ types: ["tv"], sort, limit: 12 }));
      const second = ids(
        await filtered({ types: ["tv"], sort, limit: 12, offset: 12 }),
      );
      const third = ids(
        await filtered({ types: ["tv"], sort, limit: 12, offset: 24 }),
      );
      expect(new Set([...first, ...second, ...third]).size).toBe(30);
    },
  );
});

describe("search_anime filter arguments (0020)", () => {
  it("needs a query or a filter; sort alone isn't enough", async () => {
    await anime("Anything");
    expect(await errorOf(filtered({}))).toMatch(/at least 2 characters/);
    expect(await errorOf(filtered({ sort: "newest" }))).toMatch(
      /at least 2 characters/,
    );
  });

  it("rejects a one-letter query even with a filter", async () => {
    expect(await errorOf(filtered({ query: "a", types: ["tv"] }))).toMatch(
      /at least 2 characters/,
    );
  });

  it("rejects more genres than exist", async () => {
    expect(
      await errorOf(filtered({ genres: Array(25).fill("action") as string[] })),
    ).toMatch(/Too many genres/);
  });

  it("rejects unknown values and a season without a single year", async () => {
    expect(await errorOf(filtered({ types: ["nope"] }))).toMatch(
      /Unknown type/,
    );
    expect(await errorOf(filtered({ genres: ["hentai"] }))).toMatch(
      /Unknown genre/,
    );
    expect(await errorOf(filtered({ types: ["tv"], sort: "score" }))).toMatch(
      /Unknown sort/,
    );
    expect(await errorOf(filtered({ status: "lost" }))).toMatch(
      /Unknown status/,
    );
    expect(
      await errorOf(
        filtered({ yearFrom: 2023, yearTo: 2023, season: "monsoon" }),
      ),
    ).toMatch(/Unknown season/);
    expect(
      await errorOf(filtered({ yearFrom: 1990, yearTo: 1999, season: "fall" })),
    ).toMatch(/single year/);
    expect(await errorOf(filtered({ season: "fall" }))).toMatch(/single year/);
  });
});

describe("catalog.genre_tag_names", () => {
  it("knows every genre the app offers, and nothing else", async () => {
    for (const key of GENRE_KEYS) {
      const [row] = await rows<{ names: string[] | null }>(
        `select catalog.genre_tag_names($1) as names`,
        [key],
      );
      expect(row?.names?.length, key).toBeGreaterThan(0);
    }
    const [unknown] = await rows<{ names: string[] | null }>(
      `select catalog.genre_tag_names('hentai') as names`,
    );
    expect(unknown?.names).toBeNull();
  });

  it("has no API access", async () => {
    const message = await errorOf(
      as("anon", null, () => rows(`select catalog.genre_tag_names('action')`)),
    );
    expect(message).toMatch(/permission denied/);
  });
});
