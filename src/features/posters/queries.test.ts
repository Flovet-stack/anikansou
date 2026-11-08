import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

type Call = { method: string; args: unknown[] };
type Result = { data: unknown; error: unknown };

/** What each catalog table returns, given the filters the query used. */
let tables: Record<string, (calls: Call[]) => Result>;
const queries: { table: string; calls: Call[] }[] = [];

/** A chainable stand-in for supabase-js's query builder. */
function from(table: string) {
  const calls: Call[] = [];
  queries.push({ table, calls });
  const run = () => Promise.resolve(tables[table]!(calls));
  const builder = {
    then: (resolve: (r: Result) => unknown, reject: (e: unknown) => unknown) =>
      run().then(resolve, reject),
    maybeSingle: () => run(),
  };
  for (const method of ["select", "in", "eq", "gte", "order"]) {
    Object.assign(builder, {
      [method]: (...args: unknown[]) => {
        calls.push({ method, args });
        return builder;
      },
    });
  }
  return builder;
}

vi.mock("@/lib/supabase/public", () => ({
  createPublicClient: () => ({ schema: () => ({ from }) }),
}));

const rpc = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ schema: () => ({ rpc }) }),
}));

const afterCallbacks: (() => Promise<void>)[] = [];
vi.mock("next/server", () => ({
  after: (fn: () => Promise<void>) => afterCallbacks.push(fn),
}));

const { getPosterSources, MAX_POSTER_IDS } = await import("./queries");
const { resetAniListPause, TIMEOUT_MS } = await import("./anilist");

const TMDB = "https://image.tmdb.org/t/p/w500/abc.jpg";
const cover = (n: number) =>
  `https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx${n}.jpg`;
const STORED = cover(999);

const fetchMock = vi.fn<typeof fetch>();

function answer(media: { id: number; url: string | null }[]) {
  fetchMock.mockResolvedValue(
    Response.json({
      data: {
        Page: {
          media: media.map(({ id, url }) => ({
            id,
            coverImage: { extraLarge: url, large: null },
          })),
        },
      },
    }),
  );
}

/** The AniList ids the (only) request asked for. */
function requestedIds(): number[] {
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const init = fetchMock.mock.calls[0]![1]!;
  return (JSON.parse(String(init.body)) as { variables: { ids: number[] } })
    .variables.ids;
}

function filterValues(table: string, method: string): unknown[] {
  const query = queries.find((q) => q.table === table);
  return query?.calls.find((c) => c.method === method)?.args[1] as unknown[];
}

async function runAfter() {
  for (const fn of afterCallbacks.splice(0)) await fn();
}

let candidates: Record<string, unknown>[];
let misses: number[];
let mappings: { anime_id: number; external_id: string }[];
let enabled: boolean;

beforeEach(() => {
  candidates = [];
  misses = [];
  mappings = [];
  enabled = true;
  queries.length = 0;
  afterCallbacks.length = 0;
  rpc.mockReset().mockResolvedValue({ data: 0, error: null });
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  resetAniListPause();
  tables = {
    poster_candidates: () => ({ data: candidates, error: null }),
    image_sources: () => ({
      data: { id: 3, priority: 30, is_enabled: enabled },
      error: null,
    }),
    anime_image_misses: (calls) => {
      const ids = calls.find((c) => c.method === "in")!.args[1] as number[];
      return {
        data: misses
          .filter((id) => ids.includes(id))
          .map((anime_id) => ({ anime_id })),
        error: null,
      };
    },
    external_ids: (calls) => {
      const ids = calls.find((c) => c.method === "in")!.args[1] as number[];
      // The import stores links as host + path (src/sync/normalize.ts).
      const site = calls.find((c) => c.method === "eq" && c.args[0] === "site");
      return {
        data:
          site?.args[1] === "anilist.co"
            ? mappings.filter((m) => ids.includes(m.anime_id))
            : [],
        error: null,
      };
    },
  };
});

describe("getPosterSources: AniList ids", () => {
  it("reads them from the import's anilist.co paths and skips anything else", async () => {
    mappings = [
      { anime_id: 1, external_id: "/anime/154587" },
      { anime_id: 2, external_id: "/manga/30002" },
      { anime_id: 3, external_id: "/anime/abc" },
      { anime_id: 4, external_id: "154587" },
    ];
    answer([]);
    await getPosterSources([1, 2, 3, 4], { lookUp: true });
    expect(requestedIds()).toEqual([154587]);
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getPosterSources: stored posters", () => {
  it("makes no request for an empty list", async () => {
    expect(await getPosterSources([], { lookUp: true })).toEqual(new Map());
    expect(queries).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses more than the maximum number of ids", async () => {
    const ids = Array.from({ length: MAX_POSTER_IDS + 1 }, (_, i) => i + 1);
    await expect(getPosterSources(ids)).rejects.toThrow(RangeError);
    expect(queries).toEqual([]);
  });

  it("groups candidates by anime, best first, and leaves out anime without one", async () => {
    candidates = [
      {
        anime_id: 1,
        source: "inhouse",
        priority: 10,
        url: null,
        storage_path: "a.jpg",
      },
      {
        anime_id: 1,
        source: "tmdb",
        priority: 20,
        url: TMDB,
        storage_path: null,
      },
      {
        anime_id: 2,
        source: "tmdb",
        priority: 20,
        url: "http://bad.test/x.jpg",
        storage_path: null,
      },
    ];

    const result = await getPosterSources([1, 2, 2, 3]);

    expect(filterValues("poster_candidates", "in")).toEqual([1, 2, 3]);
    expect(result).toEqual(
      new Map([
        [
          1,
          [
            "https://placeholder.supabase.co/storage/v1/object/public/posters/a.jpg",
            TMDB,
          ],
        ],
      ]),
    );
  });

  it("throws when the stored posters can't be read", async () => {
    const failure = new Error("boom");
    tables.poster_candidates = () => ({ data: null, error: failure });
    await expect(getPosterSources([1])).rejects.toBe(failure);
  });

  it("never calls AniList unless the page asks for a lookup (search, collage)", async () => {
    mappings = [{ anime_id: 1, external_id: "/anime/101" }];
    await getPosterSources([1]);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(queries.map((q) => q.table)).toEqual(["poster_candidates"]);
  });
});

describe("getPosterSources: AniList lookups (spec 08)", () => {
  it("sends one request for many ids and returns the covers after other sources", async () => {
    candidates = [
      {
        anime_id: 1,
        source: "tmdb",
        priority: 20,
        url: TMDB,
        storage_path: null,
      },
    ];
    mappings = [
      { anime_id: 1, external_id: "/anime/101" },
      { anime_id: 2, external_id: "/anime/102" },
      { anime_id: 3, external_id: "/anime/103" },
    ];
    answer([
      { id: 101, url: cover(101) },
      { id: 102, url: cover(102) },
      { id: 103, url: cover(103) },
    ]);

    const result = await getPosterSources([1, 2, 3], { lookUp: true });

    expect(requestedIds()).toEqual([101, 102, 103]);
    expect(fetchMock.mock.calls[0]![0]).toBe("https://graphql.anilist.co");
    expect(result).toEqual(
      new Map([
        [1, [TMDB, cover(101)]],
        [2, [cover(102)]],
        [3, [cover(103)]],
      ]),
    );
  });

  it("records the covers only after the response", async () => {
    mappings = [{ anime_id: 2, external_id: "/anime/102" }];
    answer([{ id: 102, url: cover(102) }]);

    await getPosterSources([2], { lookUp: true });
    expect(rpc).not.toHaveBeenCalled();

    await runAfter();
    expect(rpc).toHaveBeenCalledExactlyOnceWith("record_anilist_covers", {
      p_covers: [{ anime_id: 2, url: cover(102) }],
    });
  });

  it("skips ids without an AniList mapping, and sends nothing when none have one", async () => {
    mappings = [{ anime_id: 2, external_id: "/anime/102" }];
    answer([{ id: 102, url: cover(102) }]);
    await getPosterSources([1, 2], { lookUp: true });
    expect(requestedIds()).toEqual([102]);

    fetchMock.mockClear();
    mappings = [];
    expect(await getPosterSources([1], { lookUp: true })).toEqual(new Map());
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("doesn't fetch covers it already has stored", async () => {
    candidates = [
      {
        anime_id: 1,
        source: "anilist",
        priority: 30,
        url: STORED,
        storage_path: null,
      },
    ];
    mappings = [
      { anime_id: 1, external_id: "/anime/101" },
      { anime_id: 2, external_id: "/anime/102" },
    ];
    answer([{ id: 102, url: cover(102) }]);

    const result = await getPosterSources([1, 2], { lookUp: true });

    expect(filterValues("external_ids", "in")).toEqual([2]);
    expect(requestedIds()).toEqual([102]);
    expect(result.get(1)).toEqual([STORED]);

    fetchMock.mockClear();
    candidates.push({
      anime_id: 2,
      source: "anilist",
      priority: 30,
      url: cover(102),
      storage_path: null,
    });
    await getPosterSources([1, 2], { lookUp: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("remembers titles AniList has no cover for, and doesn't ask about them again", async () => {
    mappings = [
      { anime_id: 1, external_id: "/anime/101" },
      { anime_id: 2, external_id: "/anime/102" },
      { anime_id: 3, external_id: "/anime/103" },
    ];
    // AniList returns fewer media than asked, and one without a cover.
    answer([
      { id: 101, url: cover(101) },
      { id: 102, url: null },
    ]);

    await getPosterSources([1, 2, 3], { lookUp: true });
    await runAfter();
    expect(rpc).toHaveBeenCalledWith("record_anilist_covers", {
      p_covers: [
        { anime_id: 1, url: cover(101) },
        { anime_id: 2, url: null },
        { anime_id: 3, url: null },
      ],
    });

    // Marks younger than 30 days keep those titles out of the next request.
    fetchMock.mockClear();
    queries.length = 0;
    misses = [2, 3];
    await getPosterSources([2, 3], { lookUp: true });
    const since = Date.parse(
      queries
        .find((q) => q.table === "anime_image_misses")!
        .calls.find((c) => c.method === "gte")!.args[1] as string,
    );
    expect(Date.now() - since).toBeGreaterThanOrEqual(30 * 86_400_000 - 5_000);
    expect(Date.now() - since).toBeLessThan(30 * 86_400_000 + 5_000);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("asks for at most 50 titles in its one request", async () => {
    const ids = Array.from({ length: 60 }, (_, i) => i + 1);
    mappings = ids.map((id) => ({
      anime_id: id,
      external_id: `/anime/${1000 + id}`,
    }));
    answer([]);
    await getPosterSources(ids, { lookUp: true });
    expect(requestedIds()).toHaveLength(50);
  });

  it("makes no lookup while the AniList source is switched off", async () => {
    enabled = false;
    mappings = [{ anime_id: 1, external_id: "/anime/101" }];
    await getPosterSources([1], { lookUp: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    [
      "a 500",
      () => fetchMock.mockResolvedValue(new Response("", { status: 500 })),
    ],
    [
      "a network error",
      () => fetchMock.mockRejectedValue(new TypeError("fetch failed")),
    ],
    [
      "an answer that isn't the expected shape",
      () => fetchMock.mockResolvedValue(Response.json({ errors: [{}] })),
    ],
  ])(
    "returns the stored posters after %s, recording nothing",
    async (_, fail) => {
      candidates = [
        {
          anime_id: 1,
          source: "tmdb",
          priority: 20,
          url: TMDB,
          storage_path: null,
        },
      ];
      mappings = [
        { anime_id: 1, external_id: "/anime/101" },
        { anime_id: 2, external_id: "/anime/102" },
      ];
      fail();
      expect(await getPosterSources([1, 2], { lookUp: true })).toEqual(
        new Map([[1, [TMDB]]]),
      );
      expect(afterCallbacks).toEqual([]);
    },
  );

  it(`gives up after ${TIMEOUT_MS} ms and returns the stored posters`, async () => {
    mappings = [{ anime_id: 1, external_id: "/anime/101" }];
    fetchMock.mockImplementation(
      (_, init) =>
        new Promise((_resolve, reject) => {
          init!.signal!.addEventListener("abort", () =>
            reject(init!.signal!.reason),
          );
        }),
    );
    const started = Date.now();
    expect(await getPosterSources([1], { lookUp: true })).toEqual(new Map());
    const took = Date.now() - started;
    expect(took).toBeGreaterThanOrEqual(TIMEOUT_MS - 50);
    expect(took).toBeLessThan(TIMEOUT_MS + 1_500);
    expect(afterCallbacks).toEqual([]);
  });

  it("pauses every lookup after a 429", async () => {
    mappings = [{ anime_id: 1, external_id: "/anime/101" }];
    fetchMock.mockResolvedValue(new Response("", { status: 429 }));
    expect(await getPosterSources([1], { lookUp: true })).toEqual(new Map());
    expect(fetchMock).toHaveBeenCalledTimes(1);

    answer([{ id: 101, url: cover(101) }]);
    fetchMock.mockClear();
    expect(await getPosterSources([1], { lookUp: true })).toEqual(new Map());
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("still returns the covers when recording them fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mappings = [{ anime_id: 1, external_id: "/anime/101" }];
    answer([{ id: 101, url: cover(101) }]);
    rpc.mockResolvedValue({ data: null, error: { message: "nope" } });
    expect(await getPosterSources([1], { lookUp: true })).toEqual(
      new Map([[1, [cover(101)]]]),
    );
    await expect(runAfter()).resolves.toBeUndefined();
  });

  it("keeps the stored posters when the lookup's own reads fail", async () => {
    candidates = [
      {
        anime_id: 1,
        source: "tmdb",
        priority: 20,
        url: TMDB,
        storage_path: null,
      },
    ];
    tables.external_ids = () => ({ data: null, error: new Error("down") });
    expect(await getPosterSources([1], { lookUp: true })).toEqual(
      new Map([[1, [TMDB]]]),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
