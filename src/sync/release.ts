import { readFile } from "node:fs/promises";

import { z } from "zod";

export const RELEASE_ASSET = "anime-offline-database.jsonl";
export const RELEASES_API =
  "https://api.github.com/repos/cedya77/anime-offline-database/releases";
export const PIN_PATH = new URL("./release.json", import.meta.url);

const WEEKLY_TAG = /^(\d{4})-(\d{2})$/;

const pinSchema = z.object({
  tag: z.string().regex(WEEKLY_TAG, "tag must look like 2026-44"),
  sha256: z.string().regex(/^[0-9a-f]{64}$/, "sha256 must be 64 hex chars"),
});

export type Pin = z.infer<typeof pinSchema>;

export function parsePin(value: unknown): Pin {
  return pinSchema.parse(value);
}

export async function readPin(path: URL | string = PIN_PATH): Promise<Pin> {
  return parsePin(JSON.parse(await readFile(path, "utf8")) as unknown);
}

export function assetUrl(tag: string): string {
  return `https://github.com/cedya77/anime-offline-database/releases/download/${tag}/${RELEASE_ASSET}`;
}

function tagParts(tag: string): [number, number] {
  const match = WEEKLY_TAG.exec(tag);
  if (!match) throw new Error(`Not a weekly tag: ${tag}`);
  return [Number(match[1]), Number(match[2])];
}

export function compareTags(a: string, b: string): number {
  const [ay, aw] = tagParts(a);
  const [by, bw] = tagParts(b);
  return ay - by || aw - bw;
}

export type GithubRelease = {
  tag_name: string;
  draft: boolean;
  prerelease: boolean;
  assets: { name: string; digest?: string | null }[];
};

/**
 * The newest weekly release (`YYYY-WW`) whose `.jsonl` asset has a sha256
 * digest. Skips drafts, prereleases and non-dataset releases like `fillers`.
 */
export function pickNewestRelease(releases: GithubRelease[]): Pin | null {
  let best: Pin | null = null;
  for (const release of releases) {
    if (release.draft || release.prerelease) continue;
    if (!WEEKLY_TAG.test(release.tag_name)) continue;
    const digest = release.assets.find((a) => a.name === RELEASE_ASSET)?.digest;
    const sha256 = digest?.startsWith("sha256:") ? digest.slice(7) : null;
    if (!sha256 || !/^[0-9a-f]{64}$/.test(sha256)) continue;
    if (!best || compareTags(release.tag_name, best.tag) > 0) {
      best = { tag: release.tag_name, sha256 };
    }
  }
  return best;
}
