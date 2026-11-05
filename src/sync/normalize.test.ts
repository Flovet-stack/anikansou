import { describe, expect, it } from "vitest";

import {
  normalizeEntry,
  normalizeUrl,
  searchText,
  studioKey,
} from "./normalize.ts";
import type { Entry } from "./schema.ts";

describe("normalizeUrl", () => {
  it("splits a URL into host and path", () => {
    expect(normalizeUrl("https://myanimelist.net/anime/52991")).toEqual({
      site: "myanimelist.net",
      externalId: "/anime/52991",
      url: "https://myanimelist.net/anime/52991",
      key: "myanimelist.net/anime/52991",
    });
  });

  it("keeps the query string, which some sites use as the ID", () => {
    expect(
      normalizeUrl(
        "https://animenewsnetwork.com/encyclopedia/anime.php?id=3397",
      ),
    ).toMatchObject({
      site: "animenewsnetwork.com",
      externalId: "/encyclopedia/anime.php?id=3397",
    });
  });

  it("normalizes case, www, trailing slash and fragments", () => {
    expect(normalizeUrl("https://WWW.AniList.co/anime/136/#top").key).toBe(
      "anilist.co/anime/136",
    );
  });
});

describe("searchText", () => {
  it("lowercases, applies NFKC and collapses whitespace", () => {
    expect(searchText("  Ｓｏｕｓｏｕ  no Frieren ")).toBe("sousou no frieren");
  });

  it("keeps non-Latin text searchable", () => {
    expect(searchText("●● no Mahou")).toBe("●● no mahou");
    expect(searchText("葬送のフリーレン")).toBe("葬送のフリーレン");
  });
});

describe("studioKey", () => {
  it("merges spellings that differ only by a corporate suffix", () => {
    expect(studioKey("wit studio")).toBe(studioKey("wit studio, inc."));
    expect(studioKey("mappa")).toBe(studioKey("mappa co., ltd."));
    expect(studioKey("madhouse inc.")).toBe("madhouse");
    expect(studioKey("toho animation studio co., ltd.")).toBe(
      "toho animation studio",
    );
  });

  it("does not merge different studios", () => {
    expect(studioKey("production i.g")).not.toBe(studioKey("production ims"));
    expect(studioKey("studio live")).toBe("studio live");
  });
});

const base: Entry = {
  sources: ["https://myanimelist.net/anime/1", "https://anilist.co/anime/1"],
  title: "Cowboy Bebop",
  type: "TV",
  episodes: 26,
  status: "FINISHED",
  animeSeason: { season: "SPRING", year: 1998 },
  picture: "https://cdn.example.test/1.jpg",
  thumbnail: "https://cdn.example.test/1t.jpg",
  duration: { value: 1440, unit: "SECONDS" },
  score: { arithmeticGeometricMean: 8.7, arithmeticMean: 8.71, median: 8.8 },
  synonyms: ["COWBOY BEBOP", "カウボーイビバップ"],
  studios: ["sunrise inc."],
  producers: ["bandai visual"],
  relatedAnime: ["https://myanimelist.net/anime/5"],
  tags: ["space", "Space"],
};

describe("normalizeEntry", () => {
  it("maps fields and keeps the title main, deduping synonyms", () => {
    const n = normalizeEntry(base);
    expect(n).toMatchObject({
      title: "Cowboy Bebop",
      type: "tv",
      episodes: 26,
      status: "finished",
      season: "spring",
      year: 1998,
      durationSeconds: 1440,
    });
    expect(n.titles).toEqual([
      { title: "Cowboy Bebop", kind: "main", searchText: "cowboy bebop" },
      {
        title: "カウボーイビバップ",
        kind: "synonym",
        searchText: "カウボーイビバップ",
      },
    ]);
    expect(n.studios).toEqual([
      { raw: "sunrise inc.", role: "studio" },
      { raw: "bandai visual", role: "producer" },
    ]);
    expect(n.tags).toEqual(["space"]);
    expect(n.related.map((r) => r.key)).toEqual(["myanimelist.net/anime/5"]);
  });

  it("maps dataset sentinels to null", () => {
    const n = normalizeEntry({
      ...base,
      type: "UNKNOWN",
      status: "UNKNOWN",
      episodes: 0,
      animeSeason: { season: "UNDEFINED" },
      duration: undefined,
      score: undefined,
    });
    expect(n).toMatchObject({
      type: null,
      status: null,
      episodes: null,
      season: null,
      year: null,
      durationSeconds: null,
      score: null,
    });
  });

  it("drops a relation that points at the entry itself", () => {
    const n = normalizeEntry({
      ...base,
      relatedAnime: ["https://anilist.co/anime/1", "https://kitsu.app/anime/9"],
    });
    expect(n.related.map((r) => r.key)).toEqual(["kitsu.app/anime/9"]);
  });
});
