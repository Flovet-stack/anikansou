import { z } from "zod";

/** Statuses from the brief, as stored (decision 0011). */
export const WATCH_STATUSES = [
  "watched",
  "watching",
  "on_hold",
  "dropped",
] as const;
export type WatchStatus = (typeof WATCH_STATUSES)[number];

export const animeIdSchema = z.number().int().positive();
export const statusSchema = z.enum(WATCH_STATUSES);
/** Half stars: 1 = ½ star … 10 = 5 stars (brief). */
export const ratingSchema = z.number().int().min(1).max(10);
export const skipViaSchema = z.enum(["not_seen", "passed"]);
export const eventIdSchema = z.number().int().positive();

/** One user's state for one anime. */
export const trackingStateSchema = z.object({
  status: statusSchema.nullable(),
  rating: ratingSchema.nullable(),
  liked: z.boolean(),
  watchlisted: z.boolean(),
});
export type TrackingState = z.infer<typeof trackingStateSchema>;

export const EMPTY_STATE: TrackingState = {
  status: null,
  rating: null,
  liked: false,
  watchlisted: false,
};

/** What every tracking function returns. */
export const trackingResultSchema = z.object({
  event_id: eventIdSchema,
  state: trackingStateSchema,
});

/** 1–10 to stars, e.g. 7 → 3.5. */
export function ratingToStars(rating: number): number {
  return rating / 2;
}

/** Stars (0.5 steps) to 1–10, e.g. 3.5 → 7. */
export function starsToRating(stars: number): number {
  return Math.round(stars * 2);
}
