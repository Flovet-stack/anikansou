import { describe, expect, it } from "vitest";

import {
  POSTER_PAIRS,
  hashId,
  posterChip,
  posterColors,
  posterGlyph,
} from "./poster-style";

describe("posterColors", () => {
  it("gives the same colours for the same id, whatever its type", () => {
    expect(posterColors(42)).toEqual(posterColors(42));
    expect(posterColors(42)).toEqual(posterColors(BigInt(42)));
    expect(posterColors(42)).toEqual(posterColors("42"));
  });

  it("always picks a curated pair and an angle in range", () => {
    for (let id = 1; id <= 500; id++) {
      const { from, to, angle } = posterColors(id);
      expect(
        POSTER_PAIRS.some(([a, b]) => a === from && b === to),
      ).toBeTruthy();
      expect(angle).toBeGreaterThanOrEqual(120);
      expect(angle).toBeLessThan(240);
    }
  });

  it("spreads ids across the palette", () => {
    const used = new Set(
      Array.from({ length: 200 }, (_, i) => posterColors(i + 1).from),
    );
    expect(used.size).toBe(POSTER_PAIRS.length);
  });

  it("hashes to an unsigned 32-bit integer", () => {
    expect(hashId(0)).toBeGreaterThanOrEqual(0);
    expect(hashId(BigInt("9007199254740993"))).toBeLessThan(2 ** 32);
  });
});

describe("posterGlyph", () => {
  it("uses the native title when there is one", () => {
    expect(posterGlyph("葬送のフリーレン", "Sousou no Frieren")).toBe(
      "葬送のフリーレン",
    );
  });

  it("falls back to the first romaji word", () => {
    expect(posterGlyph(null, "Sousou no Frieren")).toBe("Sousou");
    expect(posterGlyph("   ", "  Odd Taxi ")).toBe("Odd");
  });
});

describe("posterChip", () => {
  it("joins what is known", () => {
    expect(posterChip("TV", 2023)).toBe("TV · 2023");
    expect(posterChip("Movie", null)).toBe("Movie");
    expect(posterChip(null, 2016)).toBe("2016");
    expect(posterChip("", undefined)).toBe("");
  });
});
