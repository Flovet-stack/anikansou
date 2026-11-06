import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const inMock = vi.fn();
vi.mock("@/lib/supabase/public", () => ({
  createPublicClient: () => ({
    schema: () => ({
      from: () => ({
        select: () => ({ in: (...args: unknown[]) => inMock(...args) }),
      }),
    }),
  }),
}));

const { getPosterSources, MAX_POSTER_IDS } = await import("./queries");

const TMDB = "https://image.tmdb.org/t/p/w500/abc.jpg";

beforeEach(() => {
  inMock.mockReset();
});

describe("getPosterSources", () => {
  it("makes no request for an empty list", async () => {
    expect(await getPosterSources([])).toEqual(new Map());
    expect(inMock).not.toHaveBeenCalled();
  });

  it("refuses more than the maximum number of ids", async () => {
    const ids = Array.from({ length: MAX_POSTER_IDS + 1 }, (_, i) => i + 1);
    await expect(getPosterSources(ids)).rejects.toThrow(RangeError);
    expect(inMock).not.toHaveBeenCalled();
  });

  it("groups candidates by anime, best first, and leaves out anime without one", async () => {
    inMock.mockReturnValue({
      order: () =>
        Promise.resolve({
          data: [
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
          ],
          error: null,
        }),
    });

    const result = await getPosterSources([1, 2, 2, 3]);

    expect(inMock).toHaveBeenCalledWith("anime_id", [1, 2, 3]);
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

  it("throws when the query fails", async () => {
    const failure = new Error("boom");
    inMock.mockReturnValue({
      order: () => Promise.resolve({ data: null, error: failure }),
    });
    await expect(getPosterSources([1])).rejects.toBe(failure);
  });
});
