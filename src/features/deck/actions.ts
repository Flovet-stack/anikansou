"use server";

import { getCurrentUser } from "@/features/auth/queries";

import { getDeckPage } from "./queries";
import type { DeckPage } from "./types";

/** The next page of cards, for the deck's prefetch (spec 05 #16). */
export async function loadDeckPage(
  after: number | null,
): Promise<DeckPage | { error: string }> {
  if (after !== null && (!Number.isInteger(after) || after < 1)) {
    return { error: "Couldn't load more anime." };
  }
  const user = await getCurrentUser();
  if (!user)
    return { error: "Your session ended. Log in again to keep rating." };
  try {
    return await getDeckPage(after);
  } catch {
    return { error: "Couldn't load more anime. Check your connection." };
  }
}
