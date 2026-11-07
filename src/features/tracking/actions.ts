"use server";

import { getCurrentUser } from "@/features/auth/queries";
import { createClient } from "@/lib/supabase/server";

import {
  type TrackingState,
  type WatchStatus,
  animeIdSchema,
  eventIdSchema,
  ratingSchema,
  skipViaSchema,
  statusSchema,
  trackingResultSchema,
} from "./schemas";

/**
 * Server actions for tracking. Each wraps one database function, which writes
 * the state change and its history event together (decision 0011).
 */
export type TrackingResult =
  | { ok: true; eventId: number; state: TrackingState }
  /** `gone`: the anime was retired from the catalog. */
  | { ok: false; error: string; gone?: boolean };

const GENERIC_ERROR = "That didn't save. Check your connection and try again.";
const SIGNED_OUT = "Your session ended. Log in again to keep rating.";

type Rpc =
  | {
      fn: "set_status";
      args: { p_anime_id: number; p_status: WatchStatus | null };
    }
  | { fn: "set_rating"; args: { p_anime_id: number; p_rating: number | null } }
  | { fn: "set_watchlist"; args: { p_anime_id: number; p_on: boolean } }
  | { fn: "set_like"; args: { p_anime_id: number; p_liked: boolean } }
  | {
      fn: "deck_seen";
      args: {
        p_anime_id: number;
        p_status: WatchStatus;
        p_rating: number | null;
      };
    }
  | { fn: "deck_skip"; args: { p_anime_id: number; p_via: string } }
  | { fn: "deck_undo"; args: { p_event_id: number } }
  | { fn: "library_remove"; args: { p_anime_id: number } };

async function call(rpc: Rpc): Promise<TrackingResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: SIGNED_OUT };

  const supabase = await createClient();
  // The generated types mark nullable function arguments as required values;
  // the database functions accept null for "clear", which is what we send.
  const { data, error } = await supabase.rpc(rpc.fn, rpc.args as never);
  if (error) {
    if (error.code === "42501") return { ok: false, error: SIGNED_OUT };
    // Messages raised by our own functions are written for users.
    if (error.code === "P0002") {
      return {
        ok: false,
        error: error.message,
        gone: error.message.includes("catalog"),
      };
    }
    if (error.code === "23514") return { ok: false, error: error.message };
    return { ok: false, error: GENERIC_ERROR };
  }
  const parsed = trackingResultSchema.safeParse(data);
  if (!parsed.success) return { ok: false, error: GENERIC_ERROR };
  return { ok: true, eventId: parsed.data.event_id, state: parsed.data.state };
}

function invalid(): TrackingResult {
  return { ok: false, error: GENERIC_ERROR };
}

export async function setStatus(
  animeId: number,
  status: WatchStatus | null,
): Promise<TrackingResult> {
  if (!animeIdSchema.safeParse(animeId).success) return invalid();
  if (status !== null && !statusSchema.safeParse(status).success)
    return invalid();
  return call({
    fn: "set_status",
    args: { p_anime_id: animeId, p_status: status },
  });
}

export async function setRating(
  animeId: number,
  rating: number | null,
): Promise<TrackingResult> {
  if (!animeIdSchema.safeParse(animeId).success) return invalid();
  if (rating !== null && !ratingSchema.safeParse(rating).success)
    return invalid();
  return call({
    fn: "set_rating",
    args: { p_anime_id: animeId, p_rating: rating },
  });
}

export async function setWatchlist(
  animeId: number,
  on: boolean,
): Promise<TrackingResult> {
  if (!animeIdSchema.safeParse(animeId).success) return invalid();
  return call({
    fn: "set_watchlist",
    args: { p_anime_id: animeId, p_on: on === true },
  });
}

export async function setLike(
  animeId: number,
  liked: boolean,
): Promise<TrackingResult> {
  if (!animeIdSchema.safeParse(animeId).success) return invalid();
  return call({
    fn: "set_like",
    args: { p_anime_id: animeId, p_liked: liked === true },
  });
}

/** Touch "Seen it": a status (Watched by default) and an optional rating. */
export async function deckSeen(
  animeId: number,
  status: WatchStatus,
  rating: number | null,
): Promise<TrackingResult> {
  if (!animeIdSchema.safeParse(animeId).success) return invalid();
  if (!statusSchema.safeParse(status).success) return invalid();
  if (rating !== null && !ratingSchema.safeParse(rating).success)
    return invalid();
  return call({
    fn: "deck_seen",
    args: { p_anime_id: animeId, p_status: status, p_rating: rating },
  });
}

/** "Not seen" on touch, or moving past an untouched anime on the web. */
export async function deckSkip(
  animeId: number,
  via: "not_seen" | "passed",
): Promise<TrackingResult> {
  if (!animeIdSchema.safeParse(animeId).success) return invalid();
  if (!skipViaSchema.safeParse(via).success) return invalid();
  return call({ fn: "deck_skip", args: { p_anime_id: animeId, p_via: via } });
}

/** "Remove from library": everything for this anime, as one undoable event. */
export async function removeFromLibrary(
  animeId: number,
): Promise<TrackingResult> {
  if (!animeIdSchema.safeParse(animeId).success) return invalid();
  return call({ fn: "library_remove", args: { p_anime_id: animeId } });
}

export async function deckUndo(eventId: number): Promise<TrackingResult> {
  if (!eventIdSchema.safeParse(eventId).success) return invalid();
  return call({ fn: "deck_undo", args: { p_event_id: eventId } });
}
