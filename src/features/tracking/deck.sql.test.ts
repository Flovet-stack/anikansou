/**
 * The deck and tracking functions from the spec 05 migration, run against the
 * real migrations in an in-memory Postgres (PGlite) as the `authenticated`
 * role. Covers what the API can't set up: catalog fixtures, 30-day-old skips
 * and private scores. RLS against Supabase is in `tracking.db.test.ts`.
 */
import type { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";

// Test-only: the migrated database fixture lives with the importer's tests.
import { createTestDb } from "../../sync/fixtures/test-db";

const ALICE = "00000000-0000-4000-8000-00000000000a";
const BOB = "00000000-0000-4000-8000-00000000000b";

type Row = Record<string, unknown>;

let pg: PGlite;
type Key =
  | "top"
  | "second"
  | "adult"
  | "perfect"
  | "special"
  | "retired"
  | "upcomingHigh"
  | "upcoming"
  | "unscored"
  | "newcomer";
const ids = {} as Record<Key, number>;

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

async function rpc(user: string, sql: string, params: unknown[] = []) {
  return as(user, async () => (await rows<{ r: unknown }>(sql, params))[0]?.r);
}

async function deck(user: string, after: number | null = null, size = 20) {
  return as(user, () =>
    rows<{
      anime_id: number;
      is_upcoming: boolean;
      is_adult: boolean;
      native_title: string | null;
    }>(`select * from public.deck_next($1, $2)`, [after, size]),
  );
}

async function anime(
  key: Key,
  opts: {
    type?: string;
    status?: string;
    score?: number | null;
    retired?: boolean;
    tags?: string[];
    /** How many sites list it (decision 0014's confidence). */
    sites?: number;
  } = {},
) {
  const [inserted] = await rows<{ id: number }>(
    `insert into catalog.anime
       (title, type, status, year, content_hash, first_seen_run_id, last_changed_run_id, retired_at)
     values ($1, $2::catalog.anime_type, $3::catalog.anime_status, 2020, 'h',
             (select max(id) from catalog.import_runs), (select max(id) from catalog.import_runs),
             case when $4 then now() end)
     returning id`,
    [key, opts.type ?? "tv", opts.status ?? "finished", opts.retired ?? false],
  );
  if (!inserted) throw new Error(`Could not insert ${key}`);
  const id = inserted.id;
  if (opts.score !== null) {
    await pg.query(`insert into catalog.anime_scores values ($1, $2, $2, $2)`, [
      id,
      opts.score ?? 5,
    ]);
  }
  for (let i = 0; i < (opts.sites ?? 10); i++) {
    await pg.query(
      `insert into catalog.external_ids (site, external_id, anime_id, url)
       values ($1, $2, $3, 'https://example.test')`,
      [`site${i}`, `${key}-${i}`, id],
    );
  }
  for (const tag of opts.tags ?? []) {
    await pg.query(
      `insert into catalog.tags (name) values ($1) on conflict (name) do nothing`,
      [tag],
    );
    await pg.query(
      `insert into catalog.anime_tags select $1, id from catalog.tags where name = $2`,
      [id, tag],
    );
  }
  ids[key] = id;
  return id;
}

beforeEach(async () => {
  ({ pg } = await createTestDb());
  await pg.exec(`
    -- As on Supabase, signed-in users can call auth.uid().
    grant usage on schema auth to authenticated;
    grant execute on function auth.uid() to authenticated;
    insert into auth.users (id) values ('${ALICE}'), ('${BOB}');
    insert into catalog.import_runs (data_source_id, release_tag, sha256, trigger)
      select id, 'test', 'x', 'manual' from catalog.data_sources limit 1;
  `);
  // Expected order (0014): aired first; within them the damped score, where a
  // perfect 10 counts as a tiny sample; unscored last; then unaired.
  await anime("top", { score: 9 });
  await anime("second", { score: 8 });
  await anime("adult", { score: 7, tags: ["hentai"] });
  await anime("perfect", { score: 10, sites: 8 });
  await anime("special", { type: "special", score: 9.5 });
  await anime("retired", { score: 9.9, retired: true });
  await anime("upcomingHigh", { status: "upcoming", score: 9.8 });
  await anime("upcoming", { status: "upcoming", score: null });
  await anime("unscored", { score: null });
  // Low-scored specials: never in the deck, but they bring the catalog
  // average down to a realistic level (the real one is about 6.3).
  for (let i = 0; i < 6; i++) {
    await pg.query(
      `with a as (
         insert into catalog.anime (title, type, status, content_hash, first_seen_run_id, last_changed_run_id)
         values ('filler', 'special', 'finished', 'h',
                 (select max(id) from catalog.import_runs), (select max(id) from catalog.import_runs))
         returning id)
       insert into catalog.anime_scores select id, 2, 2, 2 from a`,
    );
  }
  // The import succeeded: deck_next refreshes its order on first use.
  await pg.exec(`update catalog.import_runs set status = 'succeeded'`);
  await pg.query(
    `insert into catalog.anime_titles (anime_id, title, kind, search_text)
     values ($1, 'Top Show', 'main', 'top show'), ($1, 'トップ', 'synonym', 'トップ')`,
    [ids.top],
  );
  // Building the migrated database takes a while the first time.
}, 120_000);

describe("deck_next", () => {
  it("orders aired first by damped score, and never returns the score", async () => {
    const cards = await deck(ALICE);
    expect(cards.map((c) => c.anime_id)).toEqual([
      ids.top,
      ids.second,
      ids.adult,
      ids.perfect,
      ids.unscored,
      ids.upcomingHigh,
      ids.upcoming,
    ]);
    for (const card of cards) {
      expect(Object.keys(card).join(",")).not.toMatch(/score|mean|median/);
    }
  });

  it("leaves out specials and retired anime, flags upcoming and adult ones", async () => {
    const cards = await deck(ALICE);
    const byId = new Map(cards.map((c) => [c.anime_id, c]));
    expect(byId.has(ids.special)).toBe(false);
    expect(byId.has(ids.retired)).toBe(false);
    expect(byId.get(ids.upcoming)?.is_upcoming).toBe(true);
    expect(byId.get(ids.adult)?.is_adult).toBe(true);
    expect(byId.get(ids.top)?.is_adult).toBe(false);
    expect(byId.get(ids.top)?.native_title).toBe("トップ");
  });

  it("pages with the last anime id as the cursor", async () => {
    const first = await deck(ALICE, null, 2);
    const next = await deck(ALICE, first.at(-1)?.anime_id ?? null, 2);
    expect(first.map((c) => c.anime_id)).toEqual([ids.top, ids.second]);
    expect(next.map((c) => c.anime_id)).toEqual([ids.adult, ids.perfect]);
    // Across the aired/unaired boundary too.
    const last = await deck(ALICE, ids.unscored, 5);
    expect(last.map((c) => c.anime_id)).toEqual([
      ids.upcomingHigh,
      ids.upcoming,
    ]);
  });

  it("leaves out acted-on anime but keeps liked-only ones, per user", async () => {
    await rpc(ALICE, `select public.deck_seen($1, 'watched', 8::smallint) r`, [
      ids.top,
    ]);
    await rpc(ALICE, `select public.set_like($1, true) r`, [ids.second]);
    const cards = (await deck(ALICE)).map((c) => c.anime_id);
    expect(cards).not.toContain(ids.top);
    expect(cards).toContain(ids.second);
    expect((await deck(BOB)).map((c) => c.anime_id)).toContain(ids.top);
  });

  it("hides skipped and passed anime for 30 days, and brings back undone skips", async () => {
    const skip = (await rpc(
      ALICE,
      `select public.deck_skip($1, 'not_seen') r`,
      [ids.top],
    )) as { event_id: number };
    await rpc(ALICE, `select public.deck_skip($1, 'passed') r`, [ids.second]);
    let cards = (await deck(ALICE)).map((c) => c.anime_id);
    expect(cards).not.toContain(ids.top);
    expect(cards).not.toContain(ids.second);

    await rpc(ALICE, `select public.deck_undo($1) r`, [skip.event_id]);
    expect((await deck(ALICE)).map((c) => c.anime_id)).toContain(ids.top);

    // A skip older than 30 days no longer counts.
    await pg.query(
      `update public.user_anime_events set created_at = now() - interval '31 days'
       where anime_id = $1 and kind = 'deck_skipped'`,
      [ids.second],
    );
    cards = (await deck(ALICE)).map((c) => c.anime_id);
    expect(cards).toContain(ids.second);
  });

  it("never lets a perfect 10 from a few ratings lead", async () => {
    const cards = (await deck(ALICE)).map((c) => c.anime_id);
    expect(cards.indexOf(ids.perfect)).toBeGreaterThan(
      cards.indexOf(ids.adult),
    );
  });

  it("refreshes its order after the next successful import", async () => {
    await anime("newcomer", { score: 9.7 }); // a new anime arrives…
    await pg.exec(`
      insert into catalog.import_runs (data_source_id, release_tag, sha256, trigger, status)
        select id, 'test2', 'y', 'manual', 'succeeded' from catalog.data_sources limit 1;
    `);
    const cards = (await deck(ALICE)).map((c) => c.anime_id);
    expect(cards[0]).toBe(ids.newcomer); // …and leads once the import lands.
  });

  it("refuses signed-out callers", async () => {
    await pg.exec(`set role authenticated`);
    await expect(pg.query(`select * from public.deck_next()`)).rejects.toThrow(
      /Sign in/,
    );
    await pg.exec(`reset role`);
  });
});

describe("tracking writes", () => {
  const state = async (user: string, animeId: number) =>
    as(user, () =>
      rows(`select * from public.user_anime where anime_id = $1`, [animeId]),
    );
  const events = async (animeId: number) =>
    rows<{ kind: string; value: Row }>(
      `select kind, value from public.user_anime_events where anime_id = $1 order by id`,
      [animeId],
    );

  it("records exactly one event per write", async () => {
    await rpc(ALICE, `select public.set_status($1, 'watching') r`, [ids.top]);
    await rpc(ALICE, `select public.set_like($1, true) r`, [ids.top]);
    await rpc(ALICE, `select public.set_watchlist($1, true) r`, [ids.top]);
    await rpc(ALICE, `select public.deck_seen($1, 'watched', 9::smallint) r`, [
      ids.top,
    ]);
    const r = (await rpc(ALICE, `select public.set_rating($1, 7::smallint) r`, [
      ids.top,
    ])) as { event_id: number };
    await rpc(ALICE, `select public.deck_undo($1) r`, [r.event_id]);
    await rpc(ALICE, `select public.deck_skip($1, 'not_seen') r`, [ids.second]);
    expect((await events(ids.top)).map((e) => e.kind)).toEqual([
      "status_set",
      "liked",
      "watchlist_added",
      "rated",
      "rated",
      "undone",
    ]);
    expect((await events(ids.second)).map((e) => e.kind)).toEqual([
      "deck_skipped",
    ]);
  });

  it("refuses a status for an unaired anime even through a direct table write", async () => {
    await expect(
      as(ALICE, () =>
        rows(
          `insert into public.user_anime (user_id, anime_id, status) values ($1, $2, 'watched')`,
          [ALICE, ids.upcoming],
        ),
      ),
    ).rejects.toThrow(/aired/);
  });

  it("refuses a rating unless the anime is Watched (0015)", async () => {
    await expect(
      rpc(ALICE, `select public.set_rating($1, 7::smallint) r`, [ids.top]),
    ).rejects.toThrow(/watched to rate/);
    await rpc(ALICE, `select public.set_status($1, 'dropped') r`, [ids.top]);
    await expect(
      rpc(ALICE, `select public.set_rating($1, 7::smallint) r`, [ids.top]),
    ).rejects.toThrow(/watched to rate/);
    await expect(
      rpc(ALICE, `select public.deck_seen($1, 'watching', 7::smallint) r`, [
        ids.top,
      ]),
    ).rejects.toThrow(/watched to rate/);
    await rpc(ALICE, `select public.set_status($1, 'watched') r`, [ids.top]);
    await rpc(ALICE, `select public.set_rating($1, 7::smallint) r`, [ids.top]);
    expect(await state(ALICE, ids.top)).toMatchObject([
      { status: "watched", rating: 7 },
    ]);
  });

  it("refuses a rating without Watched even through a direct table write", async () => {
    await expect(
      as(ALICE, () =>
        rows(
          `insert into public.user_anime (user_id, anime_id, status, rating) values ($1, $2, 'dropped', 6)`,
          [ALICE, ids.top],
        ),
      ),
    ).rejects.toThrow(/watched to rate/);
  });

  it("clears the rating with Watched, in one event that undo reverses", async () => {
    await rpc(ALICE, `select public.deck_seen($1, 'watched', 8::smallint) r`, [
      ids.top,
    ]);
    const off = (await rpc(ALICE, `select public.set_status($1, null) r`, [
      ids.top,
    ])) as { event_id: number };
    expect(await state(ALICE, ids.top)).toEqual([]);
    const kinds = (await events(ids.top)).map((e) => e.kind);
    expect(kinds).toEqual(["rated", "status_cleared"]);
    await rpc(ALICE, `select public.deck_undo($1) r`, [off.event_id]);
    expect(await state(ALICE, ids.top)).toMatchObject([
      { status: "watched", rating: 8 },
    ]);
    // Moving to another status clears it too.
    await rpc(ALICE, `select public.set_status($1, 'on_hold') r`, [ids.top]);
    expect(await state(ALICE, ids.top)).toMatchObject([
      { status: "on_hold", rating: null },
    ]);
  });

  it("keeps older rows (a rating with another status) editable and undoable", async () => {
    // Saved before 0015's rule, so seeded with the rule's trigger off.
    await rows(
      `alter table public.user_anime disable trigger user_anime_check_aired`,
    );
    await rows(
      `insert into public.user_anime (user_id, anime_id, status, rating) values ($1, $2, 'watching', 8)`,
      [ALICE, ids.top],
    );
    await rows(
      `alter table public.user_anime enable trigger user_anime_check_aired`,
    );

    // Edits that leave the rating and status alone go through.
    await rpc(ALICE, `select public.set_like($1, true) r`, [ids.top]);
    await rpc(ALICE, `select public.set_watchlist($1, true) r`, [ids.top]);
    // Clearing the rating works, and undo puts the old state back.
    const cleared = (await rpc(ALICE, `select public.set_rating($1, null) r`, [
      ids.top,
    ])) as { event_id: number };
    expect(await state(ALICE, ids.top)).toMatchObject([
      { status: "watching", rating: null },
    ]);
    await rpc(ALICE, `select public.deck_undo($1) r`, [cleared.event_id]);
    expect(await state(ALICE, ids.top)).toMatchObject([
      { status: "watching", rating: 8, liked: true, watchlisted: true },
    ]);
    // Marking it Watched keeps the rating; undo restores Watching with it.
    const watched = (await rpc(
      ALICE,
      `select public.set_status($1, 'watched') r`,
      [ids.top],
    )) as { event_id: number };
    expect(await state(ALICE, ids.top)).toMatchObject([
      { status: "watched", rating: 8 },
    ]);
    await rpc(ALICE, `select public.deck_undo($1) r`, [watched.event_id]);
    expect(await state(ALICE, ids.top)).toMatchObject([
      { status: "watching", rating: 8 },
    ]);
    // The undo's permission doesn't outlive it.
    await expect(
      as(ALICE, () =>
        rows(
          `update public.user_anime set rating = 5 where user_id = $1 and anime_id = $2`,
          [ALICE, ids.top],
        ),
      ),
    ).rejects.toThrow(/watched to rate/);
  });

  it("refuses ratings outside 1–10", async () => {
    for (const bad of [0, 11]) {
      await expect(
        rpc(ALICE, `select public.set_rating($1, $2::smallint) r`, [
          ids.top,
          bad,
        ]),
      ).rejects.toThrow();
    }
  });

  it("refuses a status or rating for an anime that hasn't aired", async () => {
    await expect(
      rpc(ALICE, `select public.set_status($1, 'watched') r`, [ids.upcoming]),
    ).rejects.toThrow(/aired/);
    await expect(
      rpc(ALICE, `select public.set_rating($1, 6::smallint) r`, [ids.upcoming]),
    ).rejects.toThrow(/aired|watched to rate/);
    await expect(
      rpc(ALICE, `select public.deck_seen($1, 'watched', 6::smallint) r`, [
        ids.upcoming,
      ]),
    ).rejects.toThrow(/aired/);
    // Like and watchlist are fine.
    await rpc(ALICE, `select public.set_watchlist($1, true) r`, [ids.upcoming]);
    await rpc(ALICE, `select public.set_like($1, true) r`, [ids.upcoming]);
    expect(await state(ALICE, ids.upcoming)).toMatchObject([
      { liked: true, watchlisted: true, status: null },
    ]);
  });

  it("deletes the row when nothing is left set", async () => {
    await rpc(ALICE, `select public.set_like($1, true) r`, [ids.top]);
    await rpc(ALICE, `select public.set_like($1, false) r`, [ids.top]);
    expect(await state(ALICE, ids.top)).toEqual([]);
  });

  it("undo restores the previous state exactly", async () => {
    await rpc(ALICE, `select public.deck_seen($1, 'watched', 6::smallint) r`, [
      ids.top,
    ]);
    const r = (await rpc(ALICE, `select public.set_rating($1, 9::smallint) r`, [
      ids.top,
    ])) as { event_id: number };
    await rpc(ALICE, `select public.deck_undo($1) r`, [r.event_id]);
    expect(await state(ALICE, ids.top)).toMatchObject([
      { rating: 6, status: "watched" },
    ]);
    // Undoing it twice is refused.
    await expect(
      rpc(ALICE, `select public.deck_undo($1) r`, [r.event_id]),
    ).rejects.toThrow(/already undone/);
  });

  it("only undoes the latest change to an anime", async () => {
    const first = (await rpc(ALICE, `select public.set_like($1, true) r`, [
      ids.top,
    ])) as { event_id: number };
    await rpc(ALICE, `select public.set_watchlist($1, true) r`, [ids.top]);
    await expect(
      rpc(ALICE, `select public.deck_undo($1) r`, [first.event_id]),
    ).rejects.toThrow(/newer changes/);
  });

  it("refuses to undo another user's event", async () => {
    const r = (await rpc(ALICE, `select public.set_like($1, true) r`, [
      ids.top,
    ])) as { event_id: number };
    await expect(
      rpc(BOB, `select public.deck_undo($1) r`, [r.event_id]),
    ).rejects.toThrow(/Nothing to undo/);
    expect(await state(ALICE, ids.top)).toMatchObject([{ liked: true }]);
  });
});
