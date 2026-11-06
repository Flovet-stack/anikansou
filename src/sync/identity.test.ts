import { describe, expect, it } from "vitest";

import {
  assignUrlOwners,
  matchIdentities,
  type ExistingState,
} from "./identity.ts";

describe("assignUrlOwners", () => {
  it("gives each URL to one entry, the first by default", () => {
    const r = assignUrlOwners(
      [{ urls: ["a/1", "k/7"] }, { urls: ["b/1", "k/7"] }],
      [null, null],
      new Map(),
    );
    expect(r.owner.get("k/7")).toBe(0);
    expect(r).toMatchObject({ shared: 1, orphans: [] });
  });

  it("prefers the entry that kept the anime the URL already maps to", () => {
    const r = assignUrlOwners(
      [{ urls: ["a/1", "k/7"] }, { urls: ["b/1", "k/7"] }],
      [null, 20],
      new Map([["k/7", 20]]),
    );
    expect(r.owner.get("k/7")).toBe(1);
  });

  it("reports an entry left with no URL of its own", () => {
    const r = assignUrlOwners(
      [{ urls: ["a/1", "k/7"] }, { urls: ["k/7"] }],
      [null, null],
      new Map(),
    );
    expect(r.orphans).toEqual([1]);
  });
});

function existing(
  mappings: Record<string, number>,
  retired: number[] = [],
): ExistingState {
  const ids = new Set(Object.values(mappings));
  retired.forEach((id) => ids.add(id));
  return {
    urlToId: new Map(Object.entries(mappings)),
    anime: new Map(
      [...ids].map((id) => [id, { retired: retired.includes(id) }]),
    ),
  };
}

describe("matchIdentities", () => {
  it("treats an entry with no known URL as new", () => {
    const r = matchIdentities([{ urls: ["a/1"] }], existing({}));
    expect(r.assignments).toEqual([null]);
    expect(r.stats).toMatchObject({ new: 1, matched: 0 });
  });

  it("matches an entry to the anime that owns one of its URLs", () => {
    const r = matchIdentities(
      [{ urls: ["a/1", "b/1"] }],
      existing({ "a/1": 10 }),
    );
    expect(r.assignments).toEqual([10]);
    expect(r.stats).toMatchObject({ new: 0, matched: 1 });
  });

  it("merges: keeps the lowest id and redirects the others to it", () => {
    const r = matchIdentities(
      [{ urls: ["a/1", "b/2", "c/3"] }],
      existing({ "a/1": 30, "b/2": 20, "c/3": 40 }),
    );
    expect(r.assignments).toEqual([20]);
    expect(r.merges).toEqual([
      { from: 30, to: 20 },
      { from: 40, to: 20 },
    ]);
    expect(r.stats.merged).toBe(2);
  });

  it("splits: the entry sharing the most URLs keeps the id", () => {
    const r = matchIdentities(
      [{ urls: ["a/1"] }, { urls: ["b/2", "c/3"] }],
      existing({ "a/1": 10, "b/2": 10, "c/3": 10 }),
    );
    expect(r.assignments).toEqual([null, 10]);
    expect(r.stats).toMatchObject({ split: 1, new: 1 });
  });

  it("splits: a tie goes to the entry with the smallest shared URL", () => {
    const r = matchIdentities(
      [{ urls: ["z/9"] }, { urls: ["m/5"] }],
      existing({ "m/5": 10, "z/9": 10 }),
    );
    expect(r.assignments).toEqual([null, 10]);
  });

  it("retires an active anime that no entry matches", () => {
    const r = matchIdentities(
      [{ urls: ["a/1"] }],
      existing({ "a/1": 10, "b/2": 11 }),
    );
    expect(r.retired).toEqual([11]);
    expect(r.stats.retired).toBe(1);
  });

  it("does not count an already retired anime as retired again", () => {
    const r = matchIdentities([], existing({ "b/2": 11 }, [11]));
    expect(r.retired).toEqual([]);
  });

  it("revives a retired anime whose URLs come back, keeping its id", () => {
    const r = matchIdentities(
      [{ urls: ["b/2"] }],
      existing({ "b/2": 11 }, [11]),
    );
    expect(r.assignments).toEqual([11]);
    expect(r.revived).toEqual([11]);
    expect(r.stats.revived).toBe(1);
  });

  it("handles a split and a merge in the same run", () => {
    // Anime 10 owned a/1 + b/2; anime 20 owned c/3.
    // New release: {a/1} alone, and {b/2, c/3} together.
    const r = matchIdentities(
      [{ urls: ["a/1"] }, { urls: ["b/2", "c/3"] }],
      existing({ "a/1": 10, "b/2": 10, "c/3": 20 }),
    );
    // Entry 0 and entry 1 tie on anime 10 (one URL each): a/1 < b/2, so entry 0 keeps 10.
    // Entry 1 then only wins anime 20.
    expect(r.assignments).toEqual([10, 20]);
    expect(r.merges).toEqual([]);
  });

  it("is deterministic regardless of map insertion order", () => {
    const a = matchIdentities(
      [{ urls: ["b/2", "a/1"] }],
      existing({ "a/1": 2, "b/2": 1 }),
    );
    const b = matchIdentities(
      [{ urls: ["a/1", "b/2"] }],
      existing({ "b/2": 1, "a/1": 2 }),
    );
    expect(a).toEqual(b);
  });
});
