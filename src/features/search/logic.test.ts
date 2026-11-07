import { describe, expect, it } from "vitest";

// Test-only: the importer's normalization, which the query must match.
import { searchText } from "../../sync/normalize";

import {
  clampInput,
  discoverHref,
  isSearchable,
  normalizeQuery,
  parseQuery,
  resultsText,
} from "./logic";

describe("normalizeQuery", () => {
  it.each([
    "Sousou no Frieren",
    "  Ｓｏｕｓｏｕ  no Frieren ",
    "Pokémon: Mezase Pokémon Master",
    "Ｋ－ＯＮ！",
    "葬送のフリーレン",
    "進撃の巨人\tThe Final Season",
    "ＡｏＴ",
  ])("matches the importer's searchText for %j", (title) => {
    expect(normalizeQuery(title)).toBe(searchText(title));
  });
});

describe("isSearchable", () => {
  it("needs 2 characters that aren't spaces or ASCII punctuation", () => {
    expect(isSearchable("")).toBe(false);
    expect(isSearchable("a")).toBe(false);
    expect(isSearchable("  a  ")).toBe(false);
    expect(isSearchable("!!")).toBe(false);
    expect(isSearchable("a!")).toBe(false);
    // Unicode punctuation counts as punctuation, as in the database.
    expect(isSearchable("「」")).toBe(false);
    expect(isSearchable("・・")).toBe(false);
    expect(isSearchable("——")).toBe(false);
    expect(isSearchable("ao")).toBe(true);
    expect(isSearchable("k-on")).toBe(true);
    expect(isSearchable("葬送")).toBe(true);
  });

  it("refuses more than 100 characters", () => {
    expect(isSearchable("x".repeat(100))).toBe(true);
    expect(isSearchable("x".repeat(101))).toBe(false);
  });
});

describe("clampInput", () => {
  it("turns line breaks into spaces and cuts to 100 characters", () => {
    expect(clampInput("frieren\n")).toBe("frieren ");
    expect([...clampInput("葬".repeat(500))]).toHaveLength(100);
  });
});

describe("resultsText", () => {
  it("counts results, and says 200+ at the cap", () => {
    expect(resultsText(1, "bebop")).toBe('1 result for "bebop"');
    expect(resultsText(36, " frieren ")).toBe('36 results for "frieren"');
    expect(resultsText(200, "k-on")).toBe('200 results for "k-on"');
    expect(resultsText(201, "k-on")).toBe('200+ results for "k-on"');
  });
});

describe("discoverHref and parseQuery", () => {
  it("round-trips a query through ?q=", () => {
    expect(discoverHref("")).toBe("/discover");
    expect(discoverHref("  ")).toBe("/discover");
    const href = discoverHref("葬送 & co");
    expect(href).toBe("/discover?q=%E8%91%AC%E9%80%81%20%26%20co");
    const q = new URL(href, "https://x.test").searchParams.get("q");
    expect(parseQuery(q)).toBe("葬送 & co");
  });

  it("takes the first ?q= and ignores anything else", () => {
    expect(parseQuery(["frieren", "bebop"])).toBe("frieren");
    expect(parseQuery(undefined)).toBe("");
    expect(parseQuery(3)).toBe("");
  });
});
