/**
 * Pure helpers for the generated fallback poster (decision 0004). They run the
 * same on the server and in the browser, so a poster never changes on
 * hydration.
 */

/** Dark-friendly gradient pairs: [deep, bright]. Curated, so no clashes. */
export const POSTER_PAIRS = [
  ["#3b1f5e", "#d1495b"],
  ["#0f3d3e", "#e0a458"],
  ["#1b2a49", "#6d9dc5"],
  ["#4a1c1c", "#f28f3b"],
  ["#123524", "#9bc53d"],
  ["#2b1b3d", "#ef767a"],
  ["#1d3557", "#e63946"],
  ["#3d2c2e", "#d4a373"],
  ["#0b3954", "#bfd7ea"],
  ["#40263d", "#f3a712"],
  ["#16302b", "#7ab8a6"],
  ["#2d1e2f", "#c2a83e"],
] as const;

/** FNV-1a 32-bit hash of the id's decimal string. Stable across runtimes. */
export function hashId(id: number | bigint | string): number {
  let hash = 0x811c9dc5;
  for (const char of String(id)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

export type PosterColors = { from: string; to: string; angle: number };

/** The gradient for an anime: always the same for the same id. */
export function posterColors(id: number | bigint | string): PosterColors {
  const hash = hashId(id);
  const [from, to] =
    POSTER_PAIRS[hash % POSTER_PAIRS.length] ?? POSTER_PAIRS[0];
  // 120°–239°, so the bright end always lands toward the bottom right.
  const angle = 120 + ((hash >>> 8) % 120);
  return { from, to, angle };
}

/**
 * The large vertical text on the poster: the native title, or the first word
 * of the romaji title when there is none (decision 0004).
 */
export function posterGlyph(
  nativeTitle: string | null | undefined,
  romajiTitle: string,
): string {
  const native = nativeTitle?.trim();
  if (native) return native;
  return romajiTitle.trim().split(/\s+/)[0] ?? "";
}

/** "TV · 2023", "Movie", "2016" or "" from whatever is known. */
export function posterChip(
  format: string | null | undefined,
  year: number | null | undefined,
): string {
  return [format?.trim() || null, year ?? null]
    .filter((part) => part !== null && part !== "")
    .join(" · ");
}
