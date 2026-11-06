/** One usable poster for an anime, as `catalog.poster_candidates` returns it. */
export type PosterCandidate = {
  source: string;
  priority: number;
  url: string | null;
  storage_path: string | null;
};

/** The public Storage bucket for in-house posters (decision 0008). */
export const POSTER_BUCKET = "posters";

/** Public URL of a file in the posters bucket. Each path segment is encoded. */
export function posterStorageUrl(supabaseUrl: string, path: string): string {
  const base = supabaseUrl.replace(/\/+$/, "");
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return `${base}/storage/v1/object/public/${POSTER_BUCKET}/${encoded}`;
}

/**
 * Turns candidates into image URLs, best source first. Drops anything that
 * isn't https and any duplicate. An empty result means "show the generated
 * poster".
 */
export function resolvePosterUrls(
  candidates: readonly PosterCandidate[],
  supabaseUrl: string,
): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();
  const ordered = [...candidates].sort((a, b) => a.priority - b.priority);
  for (const candidate of ordered) {
    const url = candidate.storage_path
      ? posterStorageUrl(supabaseUrl, candidate.storage_path)
      : candidate.url;
    if (!url || !isHttps(url) || seen.has(url)) continue;
    seen.add(url);
    urls.push(url);
  }
  return urls;
}

function isHttps(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}
