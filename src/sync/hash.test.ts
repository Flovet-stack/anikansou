import { describe, expect, it } from "vitest";

import { canonicalJson, contentHash } from "./hash.ts";

describe("canonicalJson", () => {
  it("sorts object keys at every depth", () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: 3 } })).toBe(
      '{"a":{"c":3,"d":2},"b":1}',
    );
  });

  it("sorts arrays, since every dataset array is a set", () => {
    expect(canonicalJson({ tags: ["b", "a", "c"] })).toBe(
      '{"tags":["a","b","c"]}',
    );
  });
});

describe("contentHash", () => {
  const base = {
    title: "Frieren",
    tags: ["magic", "elf"],
    sources: ["https://a.test/1", "https://b.test/2"],
    animeSeason: { season: "FALL", year: 2023 },
  };

  it("is stable when array order and key order change", () => {
    const shuffled = {
      animeSeason: { year: 2023, season: "FALL" },
      sources: ["https://b.test/2", "https://a.test/1"],
      tags: ["elf", "magic"],
      title: "Frieren",
    };
    expect(contentHash(shuffled)).toBe(contentHash(base));
  });

  it("changes when a value changes", () => {
    expect(contentHash({ ...base, title: "Frieren 2" })).not.toBe(
      contentHash(base),
    );
  });

  it("is a sha256 hex digest", () => {
    expect(contentHash(base)).toMatch(/^[0-9a-f]{64}$/);
  });
});
