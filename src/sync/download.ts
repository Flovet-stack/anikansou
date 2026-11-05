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

export function readLines(path: string): AsyncIterable<string> {
  return createInterface({
    input: createReadStream(path, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });
}
