import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { readLines, verifyFile } from "./download.ts";

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "anikansou-sync-"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("verifyFile", () => {
  it("accepts a file whose sha256 matches the pin", async () => {
    const path = join(dir, "release.jsonl");
    await writeFile(path, "a\nb\n");
    const sha = createHash("sha256").update("a\nb\n").digest("hex");
    await expect(verifyFile(path, sha)).resolves.toBeUndefined();
  });

  it("rejects a truncated or substituted file", async () => {
    const path = join(dir, "release.jsonl");
    await writeFile(path, "<html>rate limited</html>");
    await expect(verifyFile(path, "0".repeat(64))).rejects.toThrow(/sha256/);
  });
});

describe("readLines", () => {
  it("streams lines, including CRLF endings", async () => {
    const path = join(dir, "release.jsonl");
    await writeFile(path, "one\r\ntwo\nthree");
    const lines: string[] = [];
    for await (const line of readLines(path)) lines.push(line);
    expect(lines).toEqual(["one", "two", "three"]);
  });
});
