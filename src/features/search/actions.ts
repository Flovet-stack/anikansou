"use server";

import { z } from "zod";

import {
  type Filters,
  GENRE_KEYS,
  SEASONS,
  SORTS,
  STATUSES,
  TYPES,
  isSingleYear,
} from "./filters";
import { MAX_RESULTS, isSearchable, shouldSearch } from "./logic";
import { searchAnime } from "./queries";
import type { SearchPage } from "./types";

const filtersSchema = z
  .object({
    types: z.array(z.enum(TYPES)),
    genres: z.array(z.enum(GENRE_KEYS as [string, ...string[]])),
    year: z
      .string()
      .regex(/^(\d{4}|\d{4}s|pre1970)$/)
      .nullable(),
    season: z.enum(SEASONS).nullable(),
    status: z.enum(STATUSES).nullable(),
    sort: z.enum(SORTS),
  })
  .refine((f) => f.season === null || isSingleYear(f.year));

const inputSchema = z.object({
  query: z.string().max(400),
  filters: filtersSchema,
  offset: z
    .number()
    .int()
    .min(0)
    .max(MAX_RESULTS - 1),
});

/** A page of results, for the field, the filters and "Show more" (spec 10). */
export async function loadSearchPage(
  query: unknown,
  filters: unknown,
  offset: unknown,
): Promise<SearchPage | { error: string }> {
  const input = inputSchema.safeParse({ query, filters, offset });
  if (!input.success) return { error: "That search doesn't look right." };
  const parsed = input.data.filters as Filters;
  if (!shouldSearch(input.data.query, parsed)) {
    return { error: "Type at least 2 characters to search." };
  }
  try {
    return await searchAnime(
      isSearchable(input.data.query) ? input.data.query : "",
      parsed,
      input.data.offset,
    );
  } catch {
    return { error: "Search isn't working right now." };
  }
}
