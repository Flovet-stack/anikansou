"use server";

import { getCurrentUser } from "@/features/auth/queries";

import { getLibraryPage } from "./queries";
import { cursorSchema, shelfSchema, sortSchema } from "./schemas";
import type { LibraryPage } from "./types";

/** The next page of a shelf, for "Show more" (spec 07 #9). */
export async function loadLibraryPage(
  shelf: unknown,
  sort: unknown,
  cursor: unknown,
): Promise<LibraryPage | { error: string }> {
  const s = shelfSchema.safeParse(shelf);
  const o = sortSchema.safeParse(sort);
  const c = cursorSchema.safeParse(cursor);
  if (!s.success || !o.success || !c.success || c.data.sort !== o.data) {
    return { error: "Couldn't load more. Reload the page and try again." };
  }
  const user = await getCurrentUser();
  if (!user) return { error: "Your session ended. Log in again." };
  try {
    return await getLibraryPage(s.data, o.data, c.data);
  } catch {
    return {
      error: "Couldn't load more. Check your connection and try again.",
    };
  }
}
