import "server-only";

import { FORMAT_LABELS } from "@/features/deck/types";
import { getPosterSources } from "@/features/posters/queries";
import { statusSchema } from "@/features/tracking/schemas";
import { createClient } from "@/lib/supabase/server";

import {
  LIBRARY_PAGE_SIZE,
  type LibraryCard,
  type LibraryCursor,
  type LibraryPage,
  SHELVES,
  type Shelf,
  type ShelfCounts,
  type Sort,
} from "./types";
import { cursorSchema } from "./schemas";

/**
 * One page of a shelf for the signed-in user (decision 0016), from the
 * `library_page` database function, which runs as the caller under RLS.
 */
export async function getLibraryPage(
  shelf: Shelf,
  sort: Sort,
  cursor: LibraryCursor | null,
): Promise<LibraryPage> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("library_page", {
    p_shelf: shelf,
    p_sort: sort,
    ...(cursor === null ? {} : { p_cursor: cursor }),
    p_page_size: LIBRARY_PAGE_SIZE,
  });
  if (error) throw error;

  const rows = data ?? [];
  const posters = await getPosterSources(rows.map((row) => row.anime_id));
  const cards: LibraryCard[] = rows.map((row) => {
    const status = statusSchema.safeParse(row.status);
    return {
      animeId: row.anime_id,
      title: row.title,
      // Generated types mark every column non-null; these can be null.
      nativeTitle: (row.native_title as string | null) ?? null,
      format: row.type ? (FORMAT_LABELS[row.type] ?? null) : null,
      year: (row.year as number | null) ?? null,
      episodes: (row.episodes as number | null) ?? null,
      durationMinutes: row.duration_seconds
        ? Math.round(row.duration_seconds / 60)
        : null,
      isUpcoming: row.is_upcoming === true,
      posterUrls: posters.get(row.anime_id) ?? [],
      state: {
        status: status.success ? status.data : null,
        rating: (row.rating as number | null) ?? null,
        liked: row.liked === true,
        watchlisted: row.watchlisted === true,
      },
    };
  });

  const last = rows.at(-1);
  const parsed =
    rows.length === LIBRARY_PAGE_SIZE && last
      ? cursorSchema.safeParse(last.cursor)
      : null;
  return { cards, next: parsed?.success ? parsed.data : null };
}

/** How many titles are on each shelf, for the tabs. */
export async function getShelfCounts(): Promise<ShelfCounts> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("library_counts");
  if (error) throw error;
  const counts = Object.fromEntries(
    SHELVES.map((shelf) => [shelf, 0]),
  ) as ShelfCounts;
  for (const row of data ?? []) {
    if ((SHELVES as readonly string[]).includes(row.shelf)) {
      counts[row.shelf as Shelf] = Number(row.count);
    }
  }
  return counts;
}
