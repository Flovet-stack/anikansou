import type { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestDb } from "./fixtures/test-db.ts";

// Spec 03: the poster tables, their checks and who can read them.

// The first test builds the migrated database, which takes a while.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

let pg: PGlite;
let frieren: number;
let bocchi: number;

async function animeId(title: string): Promise<number> {
  const run = await pg.query<{ id: number }>(
    `insert into catalog.import_runs (data_source_id, release_tag, sha256, trigger)
     values ((select min(id) from catalog.data_sources), 't', 's', 'manual')
     returning id`,
  );
  const runId = run.rows[0]!.id;
  const res = await pg.query<{ id: number }>(
    `insert into catalog.anime (title, content_hash, first_seen_run_id, last_changed_run_id)
     values ($1, 'h', $2, $2) returning id`,
    [title, runId],
  );
  return res.rows[0]!.id;
}

async function addImage(
  anime: number,
  source: string,
  location: { url?: string; storage_path?: string },
  status = "active",
): Promise<void> {
  await pg.query(
    `insert into catalog.anime_images (anime_id, source_id, url, storage_path, status)
     values ($1, (select id from catalog.image_sources where slug = $2), $3, $4, $5)`,
    [
      anime,
      source,
      location.url ?? null,
      location.storage_path ?? null,
      status,
    ],
  );
}

const TMDB = "https://image.tmdb.org/t/p/w500/abc.jpg";
const ANILIST =
  "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx1.jpg";

beforeEach(async () => {
  ({ pg } = await createTestDb());
  frieren = await animeId("Sousou no Frieren");
  bocchi = await animeId("Bocchi the Rock!");
});

afterEach(async () => {
  await pg.exec("reset role");
  await pg.close();
});

describe("image sources", () => {
  it("are seeded in order, with AniList switched off", async () => {
    const { rows } = await pg.query(
      "select slug, priority, is_enabled, url_prefix from catalog.image_sources order by priority",
    );
    expect(rows).toEqual([
      { slug: "inhouse", priority: 10, is_enabled: true, url_prefix: null },
      {
        slug: "tmdb",
        priority: 20,
        is_enabled: true,
        url_prefix: "https://image.tmdb.org/t/p/",
      },
      {
        slug: "anilist",
        priority: 30,
        is_enabled: false,
        url_prefix: "https://s4.anilist.co/",
      },
    ]);
  });
});

describe("image checks", () => {
  it("accepts a TMDB link and an in-house Storage path", async () => {
    await addImage(frieren, "tmdb", { url: TMDB });
    await addImage(frieren, "inhouse", { storage_path: "frieren/poster.jpg" });
    const { rows } = await pg.query(
      "select count(*)::int as n from catalog.anime_images",
    );
    expect(rows[0]).toEqual({ n: 2 });
  });

  it.each([
    ["another host", "https://example.com/t/p/w500/abc.jpg"],
    ["a look-alike host", "https://image.tmdb.org.evil.test/t/p/abc.jpg"],
    ["plain http", "http://image.tmdb.org/t/p/w500/abc.jpg"],
    ["a different path", "https://image.tmdb.org/other/abc.jpg"],
  ])("refuses a TMDB link on %s", async (_, url) => {
    await expect(addImage(frieren, "tmdb", { url })).rejects.toThrow(
      /must start with https:\/\/image\.tmdb\.org\/t\/p\//,
    );
  });

  it("refuses a link for the Storage source and a path for a link source", async () => {
    await expect(addImage(frieren, "inhouse", { url: TMDB })).rejects.toThrow(
      /set storage_path/,
    );
    await expect(
      addImage(frieren, "tmdb", { storage_path: "frieren.jpg" }),
    ).rejects.toThrow(/must start with/);
  });

  it.each(["/frieren.jpg", "../secret.jpg", "a/../../b.jpg", "a b.jpg", ""])(
    "refuses the Storage path %j",
    async (storage_path) => {
      await expect(
        addImage(frieren, "inhouse", { storage_path }),
      ).rejects.toThrow(/anime_images_storage_path_check|violates check/);
    },
  );

  it("needs exactly one of url and storage_path", async () => {
    // The source check runs first and names what's missing.
    await expect(addImage(frieren, "inhouse", {})).rejects.toThrow(
      /set storage_path/,
    );
    await expect(
      addImage(frieren, "inhouse", { url: TMDB, storage_path: "a.jpg" }),
    ).rejects.toThrow(/anime_images_one_location/);
  });

  it("keeps one poster per anime and source", async () => {
    await addImage(frieren, "tmdb", { url: TMDB });
    await expect(
      addImage(frieren, "tmdb", { url: TMDB.replace("abc", "def") }),
    ).rejects.toThrow(/anime_images_one_per_source/);
  });

  it("re-checks the link and bumps updated_at on update", async () => {
    await addImage(frieren, "tmdb", { url: TMDB });
    await pg.exec(
      "update catalog.anime_images set updated_at = '2000-01-01', created_at = '2000-01-01'",
    );
    await pg.exec("update catalog.anime_images set width = 500");
    const { rows } = await pg.query<{ fresh: boolean }>(
      "select updated_at > created_at as fresh from catalog.anime_images",
    );
    expect(rows[0]!.fresh).toBe(true);
    await expect(
      pg.query(
        "update catalog.anime_images set url = 'https://example.com/x.jpg'",
      ),
    ).rejects.toThrow(/must start with/);
  });
});

describe("source prefixes", () => {
  it("can't change while the source has images, so old links stay checked", async () => {
    await addImage(frieren, "tmdb", { url: TMDB });
    await expect(
      pg.query(
        "update catalog.image_sources set url_prefix = 'https://example.com/' where slug = 'tmdb'",
      ),
    ).rejects.toThrow(/still has images/);
    await expect(
      pg.query(
        "update catalog.image_sources set url_prefix = null where slug = 'tmdb'",
      ),
    ).rejects.toThrow(/still has images/);
  });

  it("can change for a source with no images, and other edits still work", async () => {
    await pg.exec(
      "update catalog.image_sources set url_prefix = 'https://s4.anilist.co/file/' where slug = 'anilist'",
    );
    await addImage(frieren, "tmdb", { url: TMDB });
    await pg.exec(
      "update catalog.image_sources set is_enabled = false where slug = 'tmdb'",
    );
    const { rows } = await pg.query(
      "select slug, url_prefix, is_enabled from catalog.image_sources where slug in ('tmdb', 'anilist') order by priority",
    );
    expect(rows).toEqual([
      {
        slug: "tmdb",
        url_prefix: "https://image.tmdb.org/t/p/",
        is_enabled: false,
      },
      {
        slug: "anilist",
        url_prefix: "https://s4.anilist.co/file/",
        is_enabled: false,
      },
    ]);
  });
});

describe("poster access", () => {
  beforeEach(async () => {
    await addImage(frieren, "tmdb", { url: TMDB });
    await addImage(frieren, "inhouse", { storage_path: "frieren/poster.jpg" });
    await addImage(frieren, "anilist", { url: ANILIST });
    await addImage(
      bocchi,
      "tmdb",
      { url: TMDB.replace("abc", "bocchi") },
      "broken",
    );
  });

  const candidates = async () =>
    (
      await pg.query(
        "select anime_id, source from catalog.poster_candidates order by anime_id, priority",
      )
    ).rows;

  it.each(["anon", "authenticated"])(
    "shows %s active posters from enabled sources, best first",
    async (role) => {
      await pg.exec(`set role ${role}`);
      expect(await candidates()).toEqual([
        { anime_id: frieren, source: "inhouse" },
        { anime_id: frieren, source: "tmdb" },
      ]);
      // The table itself hides the same rows, not just the view.
      const { rows } = await pg.query(
        "select count(*)::int as n from catalog.anime_images",
      );
      expect(rows[0]).toEqual({ n: 2 });
    },
  );

  it("hides a source's posters as soon as it is switched off", async () => {
    await pg.exec(
      "update catalog.image_sources set is_enabled = false where slug = 'inhouse'",
    );
    await pg.exec("set role anon");
    expect(await candidates()).toEqual([{ anime_id: frieren, source: "tmdb" }]);
  });

  it("shows AniList once it is switched on", async () => {
    await pg.exec(
      "update catalog.image_sources set is_enabled = true where slug = 'anilist'",
    );
    await pg.exec("set role anon");
    expect(await candidates()).toEqual([
      { anime_id: frieren, source: "inhouse" },
      { anime_id: frieren, source: "tmdb" },
      { anime_id: frieren, source: "anilist" },
    ]);
  });

  it.each(["anon", "authenticated"])("blocks writes for %s", async (role) => {
    await pg.exec(`set role ${role}`);
    await expect(addImage(bocchi, "tmdb", { url: TMDB })).rejects.toThrow(
      /permission denied/,
    );
    await expect(
      pg.query("update catalog.anime_images set status = 'broken'"),
    ).rejects.toThrow(/permission denied/);
    await expect(pg.query("delete from catalog.anime_images")).rejects.toThrow(
      /permission denied/,
    );
    await expect(
      pg.query("update catalog.image_sources set is_enabled = true"),
    ).rejects.toThrow(/permission denied/);
  });
});
