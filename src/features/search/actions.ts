"use server";

import { z } from "zod";

import { MAX_RESULTS, isSearchable } from "./logic";
import { searchAnime } from "./queries";
import type { SearchPage } from "./types";

const inputSchema = z.object({
  query: z.string().refine(isSearchable),
  offset: z
    .number()
    .int()
    .min(0)
    .max(MAX_RESULTS - 1),
});

/** A page of results, for typing in the field and for "Show more" (spec 09). */
export async function loadSearchPage(
  query: unknown,
  offset: unknown,
): Promise<SearchPage | { error: string }> {
  const input = inputSchema.safeParse({ query, offset });
  if (!input.success) return { error: "Type at least 2 characters to search." };
  try {
    return await searchAnime(input.data.query, input.data.offset);
  } catch {
    return { error: "Search isn't working right now." };
  }
}
