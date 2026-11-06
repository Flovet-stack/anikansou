import { createHash } from "node:crypto";

/**
 * JSON with sorted object keys and sorted arrays. Every array in a dataset
 * entry is a set (`uniqueItems`), so its order carries no meaning and must
 * not change the hash.
 */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    const items = value.map(canonicalJson).sort();
    return `[${items.join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

/** sha256 hex of the canonical JSON of an entry as published. */
export function contentHash(raw: unknown): string {
  return createHash("sha256").update(canonicalJson(raw)).digest("hex");
}
