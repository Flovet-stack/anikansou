/**
 * `catalog.record_anilist_covers` from spec 08's migration (decision 0017),
 * run against the real migrations in an in-memory Postgres (PGlite): who may
 * call it, which links it accepts, the "no cover" marks, and that it never
 * touches other sources' rows. Run with `pnpm test`.
 */
import type { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Test-only: the migrated database fixture lives with the importer's tests.
import { createTestDb } from "../../sync/fixtures/test-db";

vi.setConfig({ testTimeout: 60_000, hookTimeout: 120_000 });

const COVER =
  "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx154587-qQTzQnEJJ3oB.jpg";
const TMDB = "https://image.tmdb.org/t/p/w500/abc.jpg";

let pg: PGlite;
let frieren: number;
let bocchi: number;
let retired: number;

async function animeId(title: string, isRetired = false): Promise<number> {
  const run = await pg.query<{ id: number }>(
    `insert into catalog.import_runs (data_source_id, release_tag, sha256, trigger)
     values ((select min(id) from catalog.data_sources), 't', 's', 'manual')
     returning id`,
  );
  const runId = run.rows[0]!.id;
  const res = await pg.query<{ id: number }>(
    `insert into catalog.anime (title, content_hash, first_seen_run_id, last_changed_run_id, retired_at)
     values ($1, 'h', $2, $2, $3) returning id`,
    [title, runId, isRetired ? new Date() : null],
  );
  return res.rows[0]!.id;
}

/** Calls the function as `role` (signed-in users by default). */
async function record(
  covers: unknown,
  role = "authenticated",
): Promise<number> {
  await pg.exec(`set role ${role}`);
  try {
    const res = await pg.query<{ n: number }>(
      "select catalog.record_anilist_covers($1::jsonb) as n",
      [JSON.stringify(covers)],
    );
    return res.rows[0]!.n;
  } finally {
    await pg.exec("reset role");
  }
}

async function images() {
  return (
    await pg.query<{ anime_id: number; source: string; url: string | null }>(
      `select i.anime_id, s.slug as source, i.url
       from catalog.anime_images i
       join catalog.image_sources s on s.id = i.source_id
       order by i.anime_id, s.priority`,
    )
  ).rows;
}

async function misses() {
  return (
    await pg.query<{ anime_id: number }>(
      "select anime_id from catalog.anime_image_misses order by anime_id",
    )
  ).rows.map((row) => row.anime_id);
}

beforeEach(async () => {
  ({ pg } = await createTestDb());
  frieren = await animeId("Sousou no Frieren");
  bocchi = await animeId("Bocchi the Rock!");
  retired = await animeId("Gone", true);
});

afterEach(async () => {
  await pg.exec("reset role");
  await pg.close();
});

describe("AniList source", () => {
  it("is switched on at priority 30 with its prefix unchanged", async () => {
    const { rows } = await pg.query(
      "select priority, is_enabled, url_prefix, attribution from catalog.image_sources where slug = 'anilist'",
    );
    expect(rows).toEqual([
      {
        priority: 30,
        is_enabled: true,
        url_prefix: "https://s4.anilist.co/",
        attribution: "Cover images: AniList.",
      },
    ]);
  });
});

describe("record_anilist_covers", () => {
  it("stores covers and marks titles without one", async () => {
    expect(
      await record([
        { anime_id: frieren, url: COVER },
        { anime_id: bocchi, url: null },
      ]),
    ).toBe(2);
    expect(await images()).toEqual([
      { anime_id: frieren, source: "anilist", url: COVER },
    ]);
    expect(await misses()).toEqual([bocchi]);
  });

  it("shows stored covers to readers, after other sources", async () => {
    await pg.query(
      `insert into catalog.anime_images (anime_id, source_id, url)
       values ($1, (select id from catalog.image_sources where slug = 'tmdb'), $2)`,
      [frieren, TMDB],
    );
    await record([{ anime_id: frieren, url: COVER }]);
    await pg.exec("set role anon");
    const { rows } = await pg.query(
      "select source from catalog.poster_candidates where anime_id = $1 order by priority",
      [frieren],
    );
    expect(rows).toEqual([{ source: "tmdb" }, { source: "anilist" }]);
  });

  it("keeps one row when the same title is recorded twice, and clears its mark", async () => {
    await record([{ anime_id: frieren, url: null }]);
    expect(await misses()).toEqual([frieren]);
    await record([{ anime_id: frieren, url: COVER }]);
    await record([
      { anime_id: frieren, url: COVER.replace("large", "medium") },
      { anime_id: frieren, url: COVER },
    ]);
    expect(await images()).toHaveLength(1);
    expect(await misses()).toEqual([]);
  });

  it("renews a mark's date when a title is looked up again", async () => {
    await record([{ anime_id: bocchi, url: null }]);
    await pg.query(
      "update catalog.anime_image_misses set checked_at = now() - interval '40 days'",
    );
    await record([{ anime_id: bocchi, url: null }]);
    const { rows } = await pg.query<{ fresh: boolean }>(
      "select checked_at > now() - interval '1 minute' as fresh from catalog.anime_image_misses",
    );
    expect(rows).toEqual([{ fresh: true }]);
  });

  it("skips anime that are retired or don't exist", async () => {
    expect(
      await record([
        { anime_id: retired, url: COVER },
        { anime_id: 999_999, url: null },
      ]),
    ).toBe(0);
    expect(await images()).toEqual([]);
    expect(await misses()).toEqual([]);
  });

  it.each([
    ["another host", "https://image.tmdb.org/t/p/w500/abc.jpg"],
    ["plain http", COVER.replace("https", "http")],
    [
      "a banner",
      "https://s4.anilist.co/file/anilistcdn/media/anime/banner/1.jpg",
    ],
    [
      "a character image",
      "https://s4.anilist.co/file/anilistcdn/character/large/b1.png",
    ],
    [
      "a lookalike host",
      "https://s4.anilist.co.evil.test/file/anilistcdn/media/anime/cover/x.jpg",
    ],
    ["a query string", `${COVER}?x=1`],
    [
      "a path escape",
      "https://s4.anilist.co/file/anilistcdn/media/anime/cover/../../x.jpg",
    ],
  ])("refuses %s, writing nothing", async (_, url) => {
    await expect(
      record([
        { anime_id: bocchi, url: null },
        { anime_id: frieren, url },
      ]),
    ).rejects.toThrow(/must start with/);
    expect(await images()).toEqual([]);
    expect(await misses()).toEqual([]);
  });

  it.each([
    ["not a list", { anime_id: 1, url: null }],
    ["a text id", [{ anime_id: "1", url: null }]],
    ["a fractional id", [{ anime_id: 1.5, url: null }]],
    ["a number url", [{ anime_id: 1, url: 5 }]],
  ])("refuses %s", async (_, covers) => {
    await expect(record(covers)).rejects.toThrow(/Expected|Each item/);
  });

  it("takes at most 50 items", async () => {
    const items = Array.from({ length: 51 }, () => ({
      anime_id: frieren,
      url: null,
    }));
    await expect(record(items)).rejects.toThrow(/At most 50/);
  });

  it("never touches other sources' rows", async () => {
    await pg.query(
      `insert into catalog.anime_images (anime_id, source_id, url)
       values ($1, (select id from catalog.image_sources where slug = 'tmdb'), $2)`,
      [frieren, TMDB],
    );
    await record([{ anime_id: frieren, url: COVER }]);
    await record([{ anime_id: frieren, url: null }]);
    expect(await images()).toEqual([
      { anime_id: frieren, source: "tmdb", url: TMDB },
      { anime_id: frieren, source: "anilist", url: COVER },
    ]);
  });

  it("can't be called by anon", async () => {
    await expect(
      record([{ anime_id: frieren, url: COVER }], "anon"),
    ).rejects.toThrow(/permission denied/);
    expect(await images()).toEqual([]);
  });

  it("is the only way in: signed-in users still can't write the tables", async () => {
    await pg.exec("set role authenticated");
    await expect(
      pg.query(
        "insert into catalog.anime_image_misses (anime_id, source_id) values ($1, 3)",
        [frieren],
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("leaves AniList covers hidden while the source is switched off (0008)", async () => {
    await record([{ anime_id: frieren, url: COVER }]);
    await pg.exec(
      "update catalog.image_sources set is_enabled = false where slug = 'anilist'",
    );
    await pg.exec("set role authenticated");
    const { rows } = await pg.query(
      "select count(*)::int as n from catalog.anime_images",
    );
    expect(rows).toEqual([{ n: 0 }]);
  });
});
