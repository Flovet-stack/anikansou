import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { fetchAniListCovers, isPaused, resetAniListPause, RATE_LIMIT_PAUSE_MS } =
  await import("./anilist");

const COVER = "https://s4.anilist.co/file/anilistcdn/media/anime/cover/";
const fetchMock = vi.fn<typeof fetch>();

function media(
  id: number,
  coverImage: { extraLarge?: string | null; large?: string | null } | null,
) {
  return { id, coverImage };
}

function answer(list: ReturnType<typeof media>[]) {
  fetchMock.mockResolvedValue(
    Response.json({ data: { Page: { media: list } } }),
  );
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  resetAniListPause();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchAniListCovers", () => {
  it("asks once, server-side, for up to 50 distinct ids, uncached and with a time limit", async () => {
    answer([]);
    const ids = Array.from({ length: 55 }, (_, i) => i + 1);
    await fetchAniListCovers([...ids, 1, 2]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://graphql.anilist.co");
    expect(init?.method).toBe("POST");
    expect(init?.cache).toBe("no-store");
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    const body = JSON.parse(String(init?.body)) as {
      query: string;
      variables: { ids: number[] };
    };
    expect(body.variables.ids).toEqual(ids.slice(0, 50));
    expect(body.query).toMatch(/Page\(perPage: 50\)/);
    expect(body.query).toMatch(/media\(id_in: \$ids, type: ANIME\)/);
    expect(body.query).toMatch(/coverImage \{ extraLarge large \}/);
  });

  it("makes no request for no ids", async () => {
    expect(await fetchAniListCovers([])).toEqual({
      ok: true,
      covers: new Map(),
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("prefers extraLarge, falls back to large, and maps missing media to null", async () => {
    answer([
      media(1, {
        extraLarge: `${COVER}extraLarge/bx1.jpg`,
        large: `${COVER}large/bx1.jpg`,
      }),
      media(2, { extraLarge: null, large: `${COVER}large/bx2.png` }),
      media(3, null),
    ]);
    expect(await fetchAniListCovers([1, 2, 3, 4])).toEqual({
      ok: true,
      covers: new Map([
        [1, `${COVER}extraLarge/bx1.jpg`],
        [2, `${COVER}large/bx2.png`],
        [3, null],
        [4, null],
      ]),
    });
  });

  it("keeps only s4.anilist.co anime cover links", async () => {
    answer([
      media(1, {
        extraLarge: "https://evil.test/x.jpg",
        large: `${COVER}large/ok.jpg`,
      }),
      media(2, {
        extraLarge:
          "http://s4.anilist.co/file/anilistcdn/media/anime/cover/x.jpg",
      }),
      media(3, {
        extraLarge:
          "https://s4.anilist.co/file/anilistcdn/media/anime/banner/x.jpg",
      }),
      media(4, { extraLarge: `${COVER}../../x.jpg` }),
      media(5, { extraLarge: `${COVER}large/x.jpg?track=1` }),
    ]);
    const result = await fetchAniListCovers([1, 2, 3, 4, 5]);
    expect(result).toEqual({
      ok: true,
      covers: new Map([
        [1, `${COVER}large/ok.jpg`],
        [2, null],
        [3, null],
        [4, null],
        [5, null],
      ]),
    });
  });

  it("ignores media it didn't ask for", async () => {
    answer([media(9, { extraLarge: `${COVER}x.jpg` })]);
    expect(await fetchAniListCovers([1])).toEqual({
      ok: true,
      covers: new Map([[1, null]]),
    });
  });

  it.each([
    ["a GraphQL error", { errors: [{ message: "x" }], data: null }],
    ["a wrong shape", { data: { Page: { media: [{ id: "1" }] } } }],
  ])("fails soft on %s", async (_, body) => {
    fetchMock.mockResolvedValue(Response.json(body));
    expect(await fetchAniListCovers([1])).toEqual({ ok: false });
  });

  it("fails soft on a body that isn't JSON", async () => {
    fetchMock.mockResolvedValue(new Response("<html>"));
    expect(await fetchAniListCovers([1])).toEqual({ ok: false });
  });

  it("pauses for 60 s after a 429 without Retry-After", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      fetchMock.mockResolvedValue(new Response("", { status: 429 }));
      expect(await fetchAniListCovers([1])).toEqual({ ok: false });
      expect(isPaused()).toBe(true);

      vi.advanceTimersByTime(RATE_LIMIT_PAUSE_MS - 1);
      expect(await fetchAniListCovers([1])).toEqual({ ok: false });
      expect(fetchMock).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(1);
      expect(isPaused()).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it.each([
    ["seconds", () => "120", 120_000],
    ["an HTTP date", () => new Date(Date.now() + 90_000).toUTCString(), 90_000],
    ["nonsense", () => "soon", 60_000],
  ])("honours Retry-After given as %s", async (_, header, pause) => {
    vi.useFakeTimers({
      toFake: ["Date"],
      now: new Date("2026-11-07T12:00:00Z"),
    });
    try {
      fetchMock.mockResolvedValue(
        new Response("", { status: 429, headers: { "Retry-After": header() } }),
      );
      await fetchAniListCovers([1]);
      vi.advanceTimersByTime(pause - 1_000);
      expect(isPaused()).toBe(true);
      vi.advanceTimersByTime(1_000);
      expect(isPaused()).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});
