import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { createInterface } from "node:readline";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

/** Downloads `url` to `path`. GitHub release URLs redirect, which fetch follows. */
export async function download(url: string, path: string): Promise<void> {
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok || !response.body) {
    throw new Error(
      `Download failed: ${response.status} ${response.statusText} for ${url}`,
    );
  }
  await pipeline(
    Readable.fromWeb(response.body as import("node:stream/web").ReadableStream),
    createWriteStream(path),
  );
}

export async function sha256File(path: string): Promise<string> {
  const hash = createHash("sha256");
  await pipeline(
    createReadStream(path),
    new Transform({
      transform(chunk: Buffer, _encoding, done) {
        hash.update(chunk);
        done();
      },
    }),
  );
  return hash.digest("hex");
}

/** Throws unless the file's sha256 equals the pinned one. */
export async function verifyFile(
  path: string,
  expected: string,
): Promise<void> {
  const actual = await sha256File(path);
  if (actual !== expected) {
    throw new Error(
      `sha256 mismatch: expected ${expected}, got ${actual}. The download is incomplete or the release changed.`,
    );
  }
}

/**
 * Lines of a file. A generator, so the file is opened only when iteration
 * starts: a readline interface created early emits lines while the caller is
 * still awaiting something else (the importer awaits the database first), and
 * those lines are lost, leaving the loop waiting forever.
 */
export async function* readLines(path: string): AsyncGenerator<string> {
  const lines = createInterface({
    input: createReadStream(path, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });
  for await (const line of lines) yield line;
}
