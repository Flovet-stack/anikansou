/**
 * Moves the pin in release.json to the newest weekly dataset release, if there
 * is one. The weekly workflow then opens a PR; merging it runs the import.
 *
 *   pnpm sync:bump
 *
 * Writes `bumped=true|false` and `tag=<tag>` to $GITHUB_OUTPUT when set.
 */
import { appendFile, writeFile } from "node:fs/promises";

import { z } from "zod";

import {
  compareTags,
  PIN_PATH,
  pickNewestRelease,
  readPin,
  RELEASES_API,
} from "./release.ts";

const releasesSchema = z.array(
  z.object({
    tag_name: z.string(),
    draft: z.boolean(),
    prerelease: z.boolean(),
    assets: z.array(
      z.object({ name: z.string(), digest: z.string().nullish() }),
    ),
  }),
);

async function output(values: Record<string, string>) {
  const file = process.env.GITHUB_OUTPUT;
  if (!file) return;
  await appendFile(
    file,
    Object.entries(values)
      .map(([k, v]) => `${k}=${v}\n`)
      .join(""),
  );
}

async function main() {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "anikansou-catalog-bump",
  };
  if (process.env.GITHUB_TOKEN)
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

  const response = await fetch(`${RELEASES_API}?per_page=30`, { headers });
  if (!response.ok)
    throw new Error(`GitHub API: ${response.status} ${response.statusText}`);
  const releases = releasesSchema.parse(await response.json());

  const newest = pickNewestRelease(releases);
  if (!newest)
    throw new Error("No weekly release with a verifiable .jsonl asset found");

  const current = await readPin();
  if (compareTags(newest.tag, current.tag) <= 0) {
    console.log(`Already on the newest release (${current.tag})`);
    await output({ bumped: "false", tag: current.tag });
    return;
  }

  await writeFile(PIN_PATH, `${JSON.stringify(newest, null, 2)}\n`);
  console.log(
    `Bumped ${current.tag} → ${newest.tag} (sha256 ${newest.sha256})`,
  );
  await output({ bumped: "true", tag: newest.tag });
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
