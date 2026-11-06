import type { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Db } from "./db.ts";
import { entry, metadataLine, TAG } from "./fixtures/builders.ts";
import { createTestDb } from "./fixtures/test-db.ts";
import { runImport, type RunOptions } from "./run.ts";

const PIN = { tag: TAG, sha256: "0".repeat(64) };
// Tiny fixtures: only the count-change and share rules stay meaningful.
const GUARDS = {
  minEntries: 1,
  maxCountChange: 1,
  maxRetiredShare: 1,
  maxMergedShare: 1,
};

const mal = (n: number) => `https://myanimelist.net/anime/${n}`;
const anilist = (n: number) => `https://anilist.co/anime/${n}`;

const frieren = entry({
  sources: [mal(52991), anilist(154587)],
  title: "Sousou no Frieren",
  episodes: 28,
  animeSeason: { season: "FALL", year: 2023 },
  synonyms: ["Frieren: Beyond Journey's End", "葬送のフリーレン"],
  studios: ["madhouse inc."],
  producers: ["aniplex"],
  relatedAnime: [mal(59978), "https://elsewhere.test/anime/1"],
  tags: ["fantasy", "elf"],
});
const frieren2 = entry({
  sources: [mal(59978), anilist(182255)],
  title: "Sousou no Frieren 2nd Season",
  episodes: 10,
  animeSeason: { season: "WINTER", year: 2026 },
  synonyms: [],
  studios: ["madhouse"],
  producers: [],
  relatedAnime: [mal(52991)],
  tags: ["fantasy"],
});
const hxh1999 = entry({
  sources: [mal(136)],
  title: "Hunter x Hunter",
  episodes: 62,
  animeSeason: { season: "FALL", year: 1999 },
  synonyms: [],
  studios: ["nippon animation co., ltd."],
  producers: [],
  relatedAnime: [],
  tags: ["adventure"],
  score: undefined,
});

const release = (...entries: unknown[]) => [
  metadataLine(),
  ...entries.map((e) => JSON.stringify(e)),
];

// Each test gets a fresh database; the first also builds the migrated template.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

let db: Db;
let pg: PGlite;

const run = (lines: string[], options: Partial<RunOptions> = {}) =>
  runImport({
    db,
    pin: PIN,
    lines,
    trigger: "manual",
    guards: GUARDS,
    log: () => {},
    ...options,
  });

async function one<T>(sql: string, params: unknown[] = []): Promise<T> {
  const rows = await db.query<T>(sql, params as never[]);
  return rows[0] as T;
}
const count = async (table: string) =>
  Number((await one<{ n: number }>(`select count(*) as n from ${table}`)).n);
const idFor = async (url: string) => {
  const u = new URL(url);
  const row = await one<{ anime_id: number } | undefined>(
    "select anime_id from catalog.external_ids where site = $1 and external_id = $2",
    [u.hostname, u.pathname],
  );
  return row ? Number(row.anime_id) : null;
};
async function snapshot() {
  const tables = [
    "anime",
    "external_ids",
    "anime_titles",
    "studios",
    "studio_aliases",
    "anime_studios",
    "tags",
    "anime_tags",
    "anime_relations",
    "anime_redirects",
    "anime_scores",
    "anime_source_records",
  ];
  const counts: Record<string, number> = {};
  for (const t of tables) counts[t] = await count(`catalog.${t}`);
  const maxUpdated = await one<{ m: string }>(
    "select max(updated_at)::text as m from catalog.anime",
  );
  return { counts, maxUpdated: maxUpdated.m };
}

beforeEach(async () => {
  ({ db, pg } = await createTestDb());
});
afterEach(async () => {
  await pg.close();
});

describe("runImport: first load", () => {
  it("loads every entry with its titles, studios, tags, relations and scores", async () => {
    const result = await run(release(frieren, frieren2, hxh1999));
    expect(result.stats).toMatchObject({
      inserted: 3,
      updated: 0,
      unchanged: 0,
    });

    expect(await count("catalog.anime where retired_at is null")).toBe(3);
    const f = await idFor(mal(52991));
    const f2 = await idFor(mal(59978));
    expect(f).not.toBeNull();
    expect(f).not.toBe(f2);

    const row = await one<Record<string, unknown>>(
      "select title, type::text, episodes, season::text, year from catalog.anime where id = $1",
      [f],
    );
    expect(row).toEqual({
      title: "Sousou no Frieren",
      type: "tv",
      episodes: 28,
      season: "fall",
      year: 2023,
    });

    // One title row per distinct title, main first.
    expect(await count(`catalog.anime_titles where anime_id = ${f}`)).toBe(3);

    // "madhouse inc." and "madhouse" are one studio with two aliases.
    expect(await count("catalog.studios where key = 'madhouse'")).toBe(1);
    expect(
      await count("catalog.studio_aliases where raw_name like 'madhouse%'"),
    ).toBe(2);
    expect(
      await count(
        `catalog.anime_studios where anime_id = ${f} and role = 'producer'`,
      ),
    ).toBe(1);

    // Relations resolve through external_ids; unknown URLs are counted, not stored.
    expect(
      await count(
        `catalog.anime_relations where anime_id = ${f} and related_anime_id = ${f2}`,
      ),
    ).toBe(1);
    expect(result.stats.unresolvedRelations).toBe(1);

    // HxH has no score; the others do.
    expect(await count("catalog.anime_scores")).toBe(2);

    const runRow = await one<Record<string, unknown>>(
      "select status::text, entry_count, inserted, finished_at is not null as finished from catalog.import_runs order by id desc limit 1",
    );
    expect(runRow).toEqual({
      status: "succeeded",
      entry_count: 3,
      inserted: 3,
      finished: true,
    });
    expect(await count("catalog.staging_anime")).toBe(0);
  });

  it("changes nothing when the same release runs twice", async () => {
    await run(release(frieren, frieren2, hxh1999));
    const before = await snapshot();
    const second = await run(release(frieren, frieren2, hxh1999));
    expect(second.stats).toMatchObject({
      inserted: 0,
      updated: 0,
      unchanged: 3,
      retired: 0,
      revived: 0,
      merged: 0,
      split: 0,
    });
    expect(await snapshot()).toEqual(before);
  });

  it("treats a reordered entry as unchanged", async () => {
    await run(release(frieren, frieren2));
    const shuffled = {
      ...frieren,
      tags: ["elf", "fantasy"],
      sources: [anilist(154587), mal(52991)],
    };
    const second = await run(release(frieren2, shuffled));
    expect(second.stats).toMatchObject({ updated: 0, unchanged: 2 });
  });
});

describe("runImport: changes between releases", () => {
  it("updates a changed entry and keeps its id", async () => {
    await run(release(frieren2));
    const id = await idFor(mal(59978));
    const result = await run(release({ ...frieren2, episodes: 12 }));
    expect(result.stats).toMatchObject({ updated: 1, inserted: 0 });
    expect(await idFor(mal(59978))).toBe(id);
    expect(
      (
        await one<{ episodes: number }>(
          "select episodes from catalog.anime where id = $1",
          [id],
        )
      ).episodes,
    ).toBe(12);
  });

  it("retires a missing anime, then revives it with the same id", async () => {
    await run(release(frieren, hxh1999));
    const hxh = await idFor(mal(136));

    const r2 = await run(release(frieren));
    expect(r2.stats.retired).toBe(1);
    expect(
      await count(`catalog.anime where id = ${hxh} and retired_at is not null`),
    ).toBe(1);

    const r3 = await run(release(frieren, hxh1999));
    expect(r3.stats).toMatchObject({ revived: 1, inserted: 0 });
    expect(await idFor(mal(136))).toBe(hxh);
    expect(
      await count(`catalog.anime where id = ${hxh} and retired_at is null`),
    ).toBe(1);
  });

  it("merges two anime into the lower id and adds a redirect", async () => {
    const a = entry({
      sources: [mal(1)],
      title: "A",
      relatedAnime: [],
      synonyms: [],
    });
    const b = entry({
      sources: [anilist(1)],
      title: "A (alt)",
      relatedAnime: [],
      synonyms: [],
    });
    await run(release(a, b));
    const idA = (await idFor(mal(1))) as number;
    const idB = (await idFor(anilist(1))) as number;

    const merged = entry({
      sources: [mal(1), anilist(1)],
      title: "A",
      relatedAnime: [],
      synonyms: [],
    });
    const result = await run(release(merged));
    expect(result.stats.merged).toBe(1);

    const [keep, gone] = idA < idB ? [idA, idB] : [idB, idA];
    expect(await idFor(mal(1))).toBe(keep);
    expect(await idFor(anilist(1))).toBe(keep);
    expect(
      await count(
        `catalog.anime_redirects where from_anime_id = ${gone} and to_anime_id = ${keep}`,
      ),
    ).toBe(1);
    expect(
      await count(
        `catalog.anime where id = ${gone} and retired_at is not null`,
      ),
    ).toBe(1);
  });

  it("splits: the entry sharing most URLs keeps the id, the other is new", async () => {
    const both = entry({
      sources: [mal(5), anilist(5), "https://kitsu.app/anime/5"],
      title: "S",
      relatedAnime: [],
      synonyms: [],
    });
    await run(release(both));
    const id = await idFor(mal(5));

    const big = entry({
      sources: [anilist(5), "https://kitsu.app/anime/5"],
      title: "S",
      relatedAnime: [],
      synonyms: [],
    });
    const small = entry({
      sources: [mal(5)],
      title: "S recap",
      relatedAnime: [],
      synonyms: [],
    });
    const result = await run(release(small, big));
    expect(result.stats).toMatchObject({ split: 1, inserted: 1 });
    expect(await idFor(anilist(5))).toBe(id);
    expect(await idFor(mal(5))).not.toBe(id);
  });

  it("handles a URL that two entries of one release share", async () => {
    // Same URL in both entries, plus two spellings that normalize to one key.
    const a = entry({
      sources: [mal(7), "https://kitsu.app/anime/7"],
      title: "Seven",
      relatedAnime: [],
      synonyms: [],
    });
    const b = entry({
      sources: [anilist(7), "https://WWW.kitsu.app/anime/7/"],
      title: "Seven (alt)",
      relatedAnime: [],
      synonyms: [],
    });
    const first = await run(release(a, b));
    expect(first.stats.inserted).toBe(2);
    expect(first.details.sharedUrls).toBe(1);
    const owner = await idFor("https://kitsu.app/anime/7");
    expect(owner).toBe(await idFor(mal(7)));

    // Stable on a re-run: the URL keeps its owner and nothing changes.
    const second = await run(release(a, b));
    expect(second.stats).toMatchObject({
      inserted: 0,
      updated: 0,
      unchanged: 2,
      merged: 0,
    });
    expect(await idFor("https://kitsu.app/anime/7")).toBe(owner);
  });

  it("never touches overrides or override aliases", async () => {
    await run(release(frieren, frieren2));
    const f = await idFor(mal(52991));
    await db.query(
      "insert into catalog.overrides (anime_id, field, value, reason, created_by) values ($1, 'episodes', '28', 'test', 'tester')",
      [f as never],
    );
    // Force "madhouse inc." onto a separate studio by override.
    await db.query(
      "insert into catalog.studios (key, name) values ('madhouse-override', 'Madhouse (override)')",
    );
    await db.query(
      "update catalog.studio_aliases set source = 'override', studio_id = (select id from catalog.studios where key = 'madhouse-override') where raw_name = 'madhouse inc.'",
    );
    const overridesBefore = await db.query(
      "select * from catalog.overrides order by id",
    );

    await run(release({ ...frieren, episodes: 29 }, frieren2));

    expect(
      await db.query("select * from catalog.overrides order by id"),
    ).toEqual(overridesBefore);
    const alias = await one<{ source: string; key: string }>(
      "select a.source::text, s.key from catalog.studio_aliases a join catalog.studios s on s.id = a.studio_id where raw_name = 'madhouse inc.'",
    );
    expect(alias).toEqual({ source: "override", key: "madhouse-override" });
    // The anime follows the override alias.
    expect(
      await count(
        `catalog.anime_studios x join catalog.studios s on s.id = x.studio_id where x.anime_id = ${f} and s.key = 'madhouse-override'`,
      ),
    ).toBe(1);
  });
});

describe("runImport: failures leave the catalog unchanged", () => {
  it("rejects an invalid line and records a failed run", async () => {
    await run(release(frieren));
    const before = await snapshot();
    const lines = [
      ...release(frieren, frieren2),
      JSON.stringify({ ...hxh1999, type: "MUSIC" }),
    ];

    await expect(run(lines)).rejects.toThrow(/line 4/);
    expect(await snapshot()).toEqual(before);
    const failed = await one<{ status: string; error: string }>(
      "select status::text, error from catalog.import_runs order by id desc limit 1",
    );
    expect(failed.status).toBe("failed");
    expect(failed.error).toMatch(/line 4/);
  });

  it("stops on a guard rail breach unless large changes are allowed", async () => {
    await run(release(frieren, frieren2, hxh1999));
    const before = await snapshot();
    const strict = { ...GUARDS, maxRetiredShare: 0.1 };

    await expect(run(release(frieren), { guards: strict })).rejects.toThrow(
      /retire/,
    );
    expect(await snapshot()).toEqual(before);

    const allowed = await run(release(frieren), {
      guards: strict,
      allowLargeChange: true,
    });
    expect(allowed.stats.retired).toBe(2);
  });

  it("rolls back everything written in the transaction when a step fails", async () => {
    await run(release(frieren));
    const before = await snapshot();
    // Breaks the last write of a run: the run row update.
    await pg.exec(
      "alter table catalog.import_runs add constraint no_success check (status <> 'succeeded') not valid",
    );

    await expect(run(release(frieren, frieren2, hxh1999))).rejects.toThrow();
    expect(await snapshot()).toEqual(before);
  });

  it("dry run reports the plan and writes nothing", async () => {
    const result = await run(release(frieren, frieren2), { dryRun: true });
    expect(result.stats).toMatchObject({ inserted: 2 });
    expect(await count("catalog.anime")).toBe(0);
    expect(await count("catalog.import_runs")).toBe(0);
  });
});

describe("catalog access", () => {
  beforeEach(async () => {
    await run(release(frieren, frieren2));
  });
  afterEach(async () => {
    await pg.exec("reset role");
  });

  it("lets anon read public tables and nothing else", async () => {
    await pg.exec("set role anon");
    expect((await pg.query("select id from catalog.anime")).rows).toHaveLength(
      2,
    );
    await expect(
      pg.query("select * from catalog.anime_scores"),
    ).rejects.toThrow(/permission denied/);
    await expect(
      pg.query("select * from catalog.anime_source_records"),
    ).rejects.toThrow(/permission denied/);
    await expect(pg.query("select * from catalog.import_runs")).rejects.toThrow(
      /permission denied/,
    );
    await expect(pg.query("select * from catalog.overrides")).rejects.toThrow(
      /permission denied/,
    );
  });

  it.each(["anon", "authenticated"])("blocks writes for %s", async (role) => {
    await pg.exec(`set role ${role}`);
    await expect(
      pg.query(
        "insert into catalog.anime (title, content_hash, first_seen_run_id, last_changed_run_id) values ('x', 'x', 1, 1)",
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      pg.query("update catalog.anime set title = 'x'"),
    ).rejects.toThrow(/permission denied/);
    await expect(pg.query("delete from catalog.anime")).rejects.toThrow(
      /permission denied/,
    );
    await expect(
      pg.query("insert into catalog.tags (name) values ('x')"),
    ).rejects.toThrow(/permission denied/);
  });

  // `search_text %> q` is the indexable form of word similarity; `q <% search_text`
  // means the same but is not turned into an index condition.
  it("serves word-similarity title search from the trigram index", async () => {
    // Enough rows that the planner prefers the index, as it does on the real catalog.
    await pg.exec(`
      insert into catalog.anime_titles (anime_id, title, kind, search_text)
      select (select min(id) from catalog.anime), 'Filler ' || g, 'synonym', 'filler title number ' || g
      from generate_series(1, 5000) g;
      analyze catalog.anime_titles;
    `);
    const plan = await pg.query<{ "QUERY PLAN": string }>(
      "explain select anime_id from catalog.anime_titles where search_text %> 'frieren'",
    );
    expect(plan.rows.map((r) => r["QUERY PLAN"]).join("\n")).toMatch(
      /anime_titles_search_trgm_idx/,
    );
    const hits = await pg.query<{ title: string }>(
      "select title from catalog.anime_titles where search_text %> 'frieren' order by title",
    );
    expect(hits.rows.map((r) => r.title)).toContain("Sousou no Frieren");
  });
});
