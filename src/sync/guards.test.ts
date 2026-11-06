import { describe, expect, it } from "vitest";

import { checkGuards } from "./guards.ts";

const ok = {
  entryCount: 38_337,
  previousEntryCount: 38_200,
  activeBefore: 38_200,
  retired: 10,
  merged: 5,
};

describe("checkGuards", () => {
  it("passes a normal weekly change", () => {
    expect(checkGuards(ok)).toEqual([]);
  });

  it("passes the first run, with nothing to compare against", () => {
    expect(
      checkGuards({
        entryCount: 38_337,
        previousEntryCount: null,
        activeBefore: 0,
        retired: 0,
        merged: 0,
      }),
    ).toEqual([]);
  });

  it("fails below the minimum entry count", () => {
    expect(checkGuards({ ...ok, entryCount: 29_999 })[0]).toMatch(/30000/);
  });

  it("fails when the count moves more than 5%", () => {
    expect(checkGuards({ ...ok, entryCount: 40_200 })).toHaveLength(1);
    expect(checkGuards({ ...ok, entryCount: 36_000 })).toHaveLength(1);
  });

  it("fails when more than 2% would be retired", () => {
    expect(checkGuards({ ...ok, retired: 800 })[0]).toMatch(/retire/);
  });

  it("fails when more than 1% would be merged", () => {
    expect(checkGuards({ ...ok, merged: 400 })[0]).toMatch(/merge/);
  });

  it("uses custom thresholds", () => {
    // The minimum is lowered, so only the count-change rule fires.
    expect(checkGuards({ ...ok, entryCount: 3 }, { minEntries: 1 })).toEqual([
      expect.stringMatching(/limit is 5\.0%/),
    ]);
  });
});
