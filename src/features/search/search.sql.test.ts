/**
 * `search_anime` from spec 09's migration (decision 0018), run against the
 * real migrations in an in-memory Postgres (PGlite): matching on any title,
 * ranking, the caller's own state only, signed-out use, input limits and the
 * 200-result cap. Ranking on the live catalog is checked in the PR's probe.
 */
import type { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Test-only: the migrated database fixture lives with the importer's tests.
import { createTestDb } from "../../sync/fixtures/test-db";
import { searchText } from "../../sync/normalize";

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
    status?: string;
    tags?: string[];
  } = {},
) {
  const [inserted] = await rows<{ id: number }>(
    `insert into catalog.anime
       (title, type, status, year, content_hash, first_seen_run_id, last_changed_run_id, retired_at)
     values ($1, 'tv', $3::catalog.anime_status, 2020, 'h',
             (select max(id) from catalog.import_runs), (select max(id) from catalog.import_runs),
             case when $2 then now() end)
     returning id`,
    [title, opts.retired ?? false, opts.status ?? "finished"],
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

    const [anon] = await search("bebop", { user: null });
    expect(anon).toMatchObject({
      anime_id: id,
      status: null,
      rating: null,
      liked: false,
      watchlisted: false,
    });
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
