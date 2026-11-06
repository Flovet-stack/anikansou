import { describe, expect, it } from "vitest";

import { entry, metadataLine, TAG } from "./fixtures/builders.ts";
import { ValidationError, validateLines } from "./validate.ts";

const lines = (...rows: unknown[]) =>
  rows.map((r) => (typeof r === "string" ? r : JSON.stringify(r)));

describe("validateLines", () => {
  it("accepts a metadata line plus valid entries", async () => {
    const result = await validateLines(lines(metadataLine(), entry()), {
      tag: TAG,
    });
    expect(result.metadata.lastUpdate).toBe("2026-11-01");
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]?.line).toBe(2);
    expect(result.entries[0]?.entry.title).toBe("Cowboy Bebop");
  });

  it("rejects metadata from a different tag", async () => {
    await expect(
      validateLines(lines(metadataLine("2026-43"), entry()), { tag: TAG }),
    ).rejects.toThrow(/line 1.*2026-44/);
  });

  it("rejects metadata from another repository", async () => {
    const meta = JSON.parse(metadataLine()) as Record<string, unknown>;
    meta.repository = "https://github.com/someone/else";
    await expect(
      validateLines(lines(JSON.stringify(meta), entry()), { tag: TAG }),
    ).rejects.toThrow(/line 1/);
  });

  it("reports the line number of an invalid entry", async () => {
    const bad = entry({ type: "MUSIC" });
    const error = await validateLines(lines(metadataLine(), entry(), bad), {
      tag: TAG,
    }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).issues[0]?.line).toBe(3);
    expect((error as Error).message).toMatch(/line 3/);
  });

  it("reports a line that is not JSON", async () => {
    await expect(
      validateLines(lines(metadataLine(), "<html>"), { tag: TAG }),
    ).rejects.toThrow(/line 2/);
  });

  it("rejects an entry without sources, since it has no identity", async () => {
    await expect(
      validateLines(lines(metadataLine(), entry({ sources: [] })), {
        tag: TAG,
      }),
    ).rejects.toThrow(/line 2/);
  });

  it("rejects an empty file", async () => {
    await expect(validateLines([], { tag: TAG })).rejects.toThrow(/empty/i);
  });

  it("allows entries without the optional duration and score", async () => {
    const e = entry();
    delete (e as Record<string, unknown>).duration;
    delete (e as Record<string, unknown>).score;
    const result = await validateLines(lines(metadataLine(), e), { tag: TAG });
    expect(result.entries[0]?.entry.duration).toBeUndefined();
  });
});
