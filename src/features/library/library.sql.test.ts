/**
 * The Library functions from spec 07's migration (decision 0016), run against
 * the real migrations in an in-memory Postgres (PGlite) as the `authenticated`
 * role: shelves, counts, keyset cursors with ties, retired titles and
 * "Remove from library" with undo.
 */
import type { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Test-only: the migrated database fixture lives with the importer's tests.
import { createTestDb } from "../../sync/fixtures/test-db";

const ALICE = "00000000-0000-4000-8000-00000000000a";
const BOB = "00000000-0000-4000-8000-00000000000b";

type Row = Record<string, unknown>;
type PageRow = {
  anime_id: number;
  title: string;
  status: string | null;
  rating: number | null;
  liked: boolean;
  watchlisted: boolean;
  cursor: Row;
};

// Each test migrates a fresh database, which is slow under a parallel run.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 120_000 });

let pg: PGlite;

async function rows<T = Row>(sql: string, params: unknown[] = []) {
  return (await pg.query<T>(sql, params)).rows;
}

/** Runs `fn` as a signed-in user, the way the API would. */
async function as<T>(user: string, fn: () => Promise<T>): Promise<T> {
  await pg.exec(`set role authenticated`);
  await pg.query(`select set_config('request.jwt.claim.sub', $1, false)`, [
    user,
  ]);
  try {
    return await fn();
  } finally {
    await pg.exec(`reset role`);
    await pg.query(`select set_config('request.jwt.claim.sub', '', false)`);
  }
}

async function page(
  user: string,
  shelf: string,
  sort = "updated",
  cursor: Row | null = null,
  size = 48,
) {
  return as(user, () =>
    rows<PageRow>(`select * from public.library_page($1, $2, $3, $4)`, [
      shelf,
      sort,
      cursor === null ? null : JSON.stringify(cursor),
      size,
    ]),
  );
}

/** Every title on a shelf, walking pages of `size`. */
async function walk(user: string, shelf: string, sort: string, size: number) {
  const all: number[] = [];
  let cursor: Row | null = null;
  for (let i = 0; i < 100; i++) {
    const got = await page(user, shelf, sort, cursor, size);
    all.push(...got.map((row) => row.anime_id));
    const last = got.at(-1);
    if (got.length < size || !last) break;
    cursor = last.cursor;
  }
  return all;
}

async function counts(user: string) {
  const got = await as(user, () =>
    rows<{ shelf: string; count: number | string }>(
      `select * from public.library_counts()`,
    ),
  );
  return Object.fromEntries(got.map((row) => [row.shelf, Number(row.count)]));
}

async function anime(
  title: string,
  opts: { year?: number | null; retired?: boolean; status?: string } = {},
) {
  const [inserted] = await rows<{ id: number }>(
    `insert into catalog.anime
       (title, type, status, year, content_hash, first_seen_run_id, last_changed_run_id, retired_at)
     values ($1, 'tv', $4::catalog.anime_status, $2, 'h',
             (select max(id) from catalog.import_runs), (select max(id) from catalog.import_runs),
             case when $3 then now() end)
     returning id`,
    [
      title,
      opts.year === undefined ? 2020 : opts.year,
      opts.retired ?? false,
      opts.status ?? "finished",
    ],
  );
  if (!inserted) throw new Error(`Could not insert ${title}`);
  return inserted.id;
}

/** Saves state directly (as the table owner), with a chosen updated_at. */
async function track(
  user: string,
  animeId: number,
  state: {
    status?: string | null;
    rating?: number | null;
    liked?: boolean;
    watchlisted?: boolean;
    updated?: string;
  },
) {
  await pg.query(
    `insert into public.user_anime (user_id, anime_id, status, rating, liked, watchlisted, updated_at)
     values ($1, $2, $3::public.watch_status, $4, $5, $6, coalesce($7::timestamptz, now()))`,
    [
      user,
      animeId,
      state.status ?? null,
      state.rating ?? null,
      state.liked ?? false,
      state.watchlisted ?? false,
      state.updated ?? null,
    ],
  );
}

beforeEach(async () => {
  ({ pg } = await createTestDb());
  await pg.exec(`
    grant usage on schema auth to authenticated;
    grant execute on function auth.uid() to authenticated;
    insert into auth.users (id) values ('${ALICE}'), ('${BOB}');
    insert into catalog.import_runs (data_source_id, release_tag, sha256, trigger)
      select id, 'test', 'x', 'manual' from catalog.data_sources limit 1;
  `);
});

describe("library_page shelves", () => {
  it("returns each shelf's titles, only the caller's, never retired ones", async () => {
    const frieren = await anime("Frieren");
    const bocchi = await anime("Bocchi");
    const dropped = await anime("Dropped one");
    const retired = await anime("Retired", { retired: true });
    const bobs = await anime("Bob's");
    await track(ALICE, frieren, { status: "watched", rating: 10, liked: true });
    await track(ALICE, bocchi, { status: "watching", watchlisted: true });
    await track(ALICE, dropped, { status: "dropped" });
    await track(ALICE, retired, { status: "watched", rating: 8 });
    await track(BOB, bobs, { status: "watched", liked: true });

    const ids = async (shelf: string) =>
      (await page(ALICE, shelf)).map((row) => row.anime_id);
    expect(await ids("watched")).toEqual([frieren]);
    expect(await ids("watching")).toEqual([bocchi]);
    expect(await ids("on_hold")).toEqual([]);
    expect(await ids("dropped")).toEqual([dropped]);
    expect(await ids("watchlist")).toEqual([bocchi]);
    // Liked and Watched both hold Frieren.
    expect(await ids("liked")).toEqual([frieren]);

    expect(await counts(ALICE)).toEqual({
      watched: 1,
      watching: 1,
      on_hold: 0,
      dropped: 1,
      watchlist: 1,
      liked: 1,
    });
    expect(await counts(BOB)).toMatchObject({ watched: 1, liked: 1 });

    // The retired title's tracking row stays in the database.
    const [kept] = await rows<{ n: number }>(
      `select count(*)::int as n from public.user_anime where anime_id = $1`,
      [retired],
    );
    expect(kept?.n).toBe(1);
  });

  it("returns the card fields and the user's state, never a score", async () => {
    const id = await anime("Frieren", { year: 2023 });
    await track(ALICE, id, { status: "watched", rating: 9, watchlisted: true });
    const [row] = await page(ALICE, "watched");
    expect(row).toMatchObject({
      anime_id: id,
      title: "Frieren",
      year: 2023,
      status: "watched",
      rating: 9,
      liked: false,
      watchlisted: true,
      is_upcoming: false,
    });
    expect(Object.keys(row ?? {}).some((key) => key.includes("score"))).toBe(
      false,
    );
  });

  it("refuses unknown shelves, sorts, sizes and stale cursors, and signed-out callers", async () => {
    await expect(page(ALICE, "favourites")).rejects.toThrow(/Unknown shelf/);
    await expect(page(ALICE, "watched", "score")).rejects.toThrow(
      /Unknown sort/,
    );
    await expect(page(ALICE, "watched", "updated", null, 49)).rejects.toThrow(
      /1 to 48/,
    );
    await expect(
      page(ALICE, "watched", "rating", { sort: "title", key: "a", id: 1 }),
    ).rejects.toThrow(/out of date/);
    await pg.exec(`set role authenticated`);
    try {
      await expect(
        rows(`select * from public.library_page('watched')`),
      ).rejects.toThrow(/Sign in/);
    } finally {
      await pg.exec(`reset role`);
    }
  });
});

describe("library_page sorts and cursors", () => {
  // 13 titles with heavy ties in every sort key.
  async function seed() {
    const made: number[] = [];
    for (let i = 0; i < 13; i++) {
      const id = await anime(i % 3 === 0 ? "Same title" : `Title ${i % 4}`, {
        year: i % 5 === 0 ? null : 2000 + (i % 3),
      });
      await track(ALICE, id, {
        status: "watched",
        rating: i % 4 === 0 ? null : (i % 3) + 6,
        updated: `2026-11-0${(i % 2) + 1}T10:00:00.123456Z`,
      });
      made.push(id);
    }
    return made;
  }

  for (const sort of ["updated", "rating", "title", "year"]) {
    it(`pages through "${sort}" without repeats or gaps, ties broken by id`, async () => {
      const made = await seed();
      const whole = (await page(ALICE, "watched", sort)).map((r) => r.anime_id);
      expect(whole).toHaveLength(made.length);
      for (const size of [1, 2, 5]) {
        expect(await walk(ALICE, "watched", sort, size)).toEqual(whole);
      }
    });
  }

  it("orders by rating high to low with unrated last, and year newest first", async () => {
    const low = await anime("Low", { year: 1999 });
    const high = await anime("High", { year: null });
    const none = await anime("None", { year: 2024 });
    await track(ALICE, low, { status: "watched", rating: 3 });
    await track(ALICE, high, { status: "watched", rating: 10 });
    await track(ALICE, none, { status: "watched" });
    const ids = async (sort: string) =>
      (await page(ALICE, "watched", sort)).map((row) => row.anime_id);
    expect(await ids("rating")).toEqual([high, low, none]);
    expect(await ids("year")).toEqual([none, low, high]);
    expect(await ids("title")).toEqual([high, low, none]);
  });
});

describe("library_remove", () => {
  it("clears everything as one event that one undo restores", async () => {
    const id = await anime("Frieren");
    await track(ALICE, id, {
      status: "watched",
      rating: 9,
      liked: true,
      watchlisted: true,
    });
    const removed = (await as(ALICE, async () => {
      const [row] = await rows<{ r: { event_id: number; state: Row } }>(
        `select public.library_remove($1) as r`,
        [id],
      );
      return row?.r;
    }))!;
    expect(removed.state).toEqual({
      status: null,
      rating: null,
      liked: false,
      watchlisted: false,
    });
    expect(await counts(ALICE)).toMatchObject({ watched: 0, liked: 0 });
    const events = await rows<{ kind: string; value: Row }>(
      `select kind, value from public.user_anime_events where anime_id = $1`,
      [id],
    );
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      kind: "status_cleared",
      value: { removed: true },
    });

    const undone = await as(ALICE, async () => {
      const [row] = await rows<{ r: { state: Row } }>(
        `select public.deck_undo($1) as r`,
        [removed.event_id],
      );
      return row?.r;
    });
    expect(undone?.state).toEqual({
      status: "watched",
      rating: 9,
      liked: true,
      watchlisted: true,
    });
  });

  it("can't touch another user's title", async () => {
    const id = await anime("Frieren");
    await track(BOB, id, { status: "watched", rating: 9 });
    await as(ALICE, () => rows(`select public.library_remove($1) as r`, [id]));
    const [bob] = await rows<{ rating: number }>(
      `select rating from public.user_anime where user_id = $1`,
      [BOB],
    );
    expect(bob?.rating).toBe(9);
  });
});
