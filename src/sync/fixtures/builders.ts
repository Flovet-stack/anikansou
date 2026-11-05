export const TAG = "2026-44";

export function metadataLine(tag = TAG) {
  return JSON.stringify({
    $schema: `https://raw.githubusercontent.com/cedya77/anime-offline-database/refs/tags/${tag}/schemas/anime-offline-database.jsonl.schema.json`,
    license: { name: "ODbL + DbCL", url: "https://example.test/LICENSE" },
    repository: "https://github.com/cedya77/anime-offline-database",
    lastUpdate: "2026-11-01",
  });
}

export function entry(overrides: Record<string, unknown> = {}) {
  return {
    sources: ["https://myanimelist.net/anime/1"],
    title: "Cowboy Bebop",
    type: "TV",
    episodes: 26,
    status: "FINISHED",
    animeSeason: { season: "SPRING", year: 1998 },
    picture: "https://cdn.example.test/1.jpg",
    thumbnail: "https://cdn.example.test/1t.jpg",
    duration: { value: 1440, unit: "SECONDS" },
    score: { arithmeticGeometricMean: 8.7, arithmeticMean: 8.7, median: 8.8 },
    synonyms: ["カウボーイビバップ"],
    studios: ["sunrise"],
    producers: ["bandai visual"],
    relatedAnime: [],
    tags: ["space"],
    ...overrides,
  };
}
