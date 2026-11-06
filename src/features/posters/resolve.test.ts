import { describe, expect, it } from "vitest";

import { posterStorageUrl, resolvePosterUrls } from "./resolve";

const SUPABASE = "https://abc.supabase.co/";
const TMDB = "https://image.tmdb.org/t/p/w500/abc.jpg";

describe("posterStorageUrl", () => {
  it("builds a public URL in the posters bucket and encodes each segment", () => {
    expect(posterStorageUrl(SUPABASE, "frieren/key art #1.jpg")).toBe(
      "https://abc.supabase.co/storage/v1/object/public/posters/frieren/key%20art%20%231.jpg",
    );
  });
});

describe("resolvePosterUrls", () => {
  it("orders by priority and turns Storage paths into URLs", () => {
    expect(
      resolvePosterUrls(
        [
          { source: "tmdb", priority: 20, url: TMDB, storage_path: null },
          {
            source: "inhouse",
            priority: 10,
            url: null,
            storage_path: "frieren.jpg",
          },
        ],
        SUPABASE,
      ),
    ).toEqual([
      "https://abc.supabase.co/storage/v1/object/public/posters/frieren.jpg",
      TMDB,
    ]);
  });

  it("drops duplicates, non-https links and empty rows", () => {
    expect(
      resolvePosterUrls(
        [
          { source: "tmdb", priority: 20, url: TMDB, storage_path: null },
          { source: "x", priority: 25, url: TMDB, storage_path: null },
          {
            source: "y",
            priority: 30,
            url: "http://a.test/b.jpg",
            storage_path: null,
          },
          { source: "z", priority: 40, url: "not a url", storage_path: null },
          { source: "w", priority: 50, url: null, storage_path: null },
        ],
        SUPABASE,
      ),
    ).toEqual([TMDB]);
  });

  it("returns an empty list when there is nothing to show", () => {
    expect(resolvePosterUrls([], SUPABASE)).toEqual([]);
  });
});
