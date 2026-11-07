/** Decision 0018: from 2 characters, at most 100, 24 a page, 200 in all. */
export const MIN_QUERY_CHARS = 2;
export const MAX_QUERY_CHARS = 100;
export const SEARCH_PAGE_SIZE = 24;
export const MAX_RESULTS = 200;
/** Wait this long after the last keystroke before searching. */
export const SEARCH_DEBOUNCE_MS = 250;

/**
 * The query as titles are stored for search (`search_text`): NFKC,
 * lowercase, single spaces. The same steps as the importer's `searchText`
 * (a test keeps them equal); the database normalizes again, the same way.
 */
export function normalizeQuery(raw: string): string {
  return raw.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Whether a query is worth sending: at least 2 characters that aren't
 * spaces, punctuation or symbols (so "!!" and "「」" aren't), and at most 100. Mirrors the
 * database's own check, which strips `[[:space:][:punct:]]`.
 */
export function isSearchable(raw: string): boolean {
  const query = normalizeQuery(raw);
  if (query.length > MAX_QUERY_CHARS) return false;
  // Postgres's [[:punct:]] (UTF-8 locale) also drops Unicode punctuation
  // and symbols such as 「」 and ・, so the same goes here.
  const meaningful = query.replace(/[\s\p{P}\p{S}]/gu, "");
  return [...meaningful].length >= MIN_QUERY_CHARS;
}

/** What the field holds: trimmed of line breaks, cut to 100 characters. */
export function clampInput(raw: string): string {
  return [...raw.replace(/[\r\n]+/g, " ")].slice(0, MAX_QUERY_CHARS).join("");
}

/** `36 results for "frieren"`, or `200+ results` at the cap (0018). */
export function resultsText(total: number, query: string): string {
  const shown = query.trim();
  if (total > MAX_RESULTS) return `200+ results for "${shown}"`;
  return `${total} ${total === 1 ? "result" : "results"} for "${shown}"`;
}

/** The Discover URL for a query (empty query: plain `/discover`). */
export function discoverHref(raw: string): string {
  const query = raw.trim();
  return query ? `/discover?q=${encodeURIComponent(query)}` : "/discover";
}

/** The query from `?q=`, as the field should show it. */
export function parseQuery(value: unknown): string {
  const first = Array.isArray(value) ? value[0] : value;
  return typeof first === "string" ? clampInput(first) : "";
}
