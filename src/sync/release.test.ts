import { describe, expect, it } from "vitest";

import { compareTags, parsePin, pickNewestRelease } from "./release.ts";

const asset = (
  name: string,
  digest: string | null = "sha256:" + "a".repeat(64),
) => ({
  name,
  digest,
  browser_download_url: `https://github.com/x/y/releases/download/t/${name}`,
});

describe("parsePin", () => {
  it("accepts a weekly tag and a sha256", () => {
    expect(parsePin({ tag: "2026-44", sha256: "f".repeat(64) })).toEqual({
      tag: "2026-44",
      sha256: "f".repeat(64),
    });
  });

  it("rejects latest and malformed hashes", () => {
    expect(() => parsePin({ tag: "latest", sha256: "f".repeat(64) })).toThrow();
    expect(() => parsePin({ tag: "2026-44", sha256: "abc" })).toThrow();
  });
});

describe("compareTags", () => {
  it("orders by year, then week", () => {
    expect(compareTags("2026-44", "2026-43")).toBeGreaterThan(0);
    expect(compareTags("2025-52", "2026-01")).toBeLessThan(0);
    expect(compareTags("2026-44", "2026-44")).toBe(0);
  });
});

describe("pickNewestRelease", () => {
  it("picks the newest weekly tag that has the jsonl asset with a digest", () => {
    const picked = pickNewestRelease([
      {
        tag_name: "fillers",
        draft: false,
        prerelease: false,
        assets: [asset("fillers.json")],
      },
      {
        tag_name: "2026-45",
        draft: false,
        prerelease: false,
        assets: [asset("anime-offline-database.jsonl", null)],
      },
      {
        tag_name: "2026-44",
        draft: false,
        prerelease: false,
        assets: [asset("anime-offline-database.jsonl")],
      },
      {
        tag_name: "2026-43",
        draft: false,
        prerelease: false,
        assets: [asset("anime-offline-database.jsonl")],
      },
    ]);
    expect(picked).toEqual({ tag: "2026-44", sha256: "a".repeat(64) });
  });

  it("skips drafts and prereleases", () => {
    expect(
      pickNewestRelease([
        {
          tag_name: "2026-46",
          draft: true,
          prerelease: false,
          assets: [asset("anime-offline-database.jsonl")],
        },
        {
          tag_name: "2026-45",
          draft: false,
          prerelease: true,
          assets: [asset("anime-offline-database.jsonl")],
        },
      ]),
    ).toBeNull();
  });
});
