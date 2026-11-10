import {
  type Filters,
  EMPTY_FILTERS,
  filterParams,
  hasFilters,
} from "./filters";

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

/**
 * `36 results for "frieren"`, `200+` at the cap (0018), or just `36 results`
 * when browsing by filter with no query (0020).
 */
export function resultsText(total: number, query: string): string {
  const shown = query.trim();
  const count =
    total > MAX_RESULTS
      ? "200+ results"
      : `${total} ${total === 1 ? "result" : "results"}`;
  return shown ? `${count} for "${shown}"` : count;
}

/** The no-results message: 0020's with a filter on, 0018's without. */
export function noResultsText(query: string, filters: Filters): string {
  return hasFilters(filters)
    ? "No anime match these filters."
    : `No anime match “${query.trim()}”.`;
}

/** Whether there's anything to search for: a real query, or a filter (0020). */
export function shouldSearch(query: string, filters: Filters): boolean {
  return isSearchable(query) || hasFilters(filters);
}

/** The query to send: empty when the field holds too little to mean anything. */
export function effectiveQuery(query: string): string {
  return isSearchable(query) ? query : "";
}

/** The Discover URL for a search. Nothing to say: plain `/discover`. */
export function discoverHref(
  raw: string,
  filters: Filters = EMPTY_FILTERS,
): string {
  const query = raw.trim();
  const parts = [
    ...(query ? [`q=${encodeURIComponent(query)}`] : []),
    ...filterParams(filters),
  ];
  return parts.length > 0 ? `/discover?${parts.join("&")}` : "/discover";
}

/** The query from `?q=`, as the field should show it. */
export function parseQuery(value: unknown): string {
  const first = Array.isArray(value) ? value[0] : value;
  return typeof first === "string" ? clampInput(first) : "";
}
