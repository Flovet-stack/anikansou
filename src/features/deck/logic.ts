/**
 * Pure deck rules from decision 0009, kept apart from React so they can be
 * unit-tested.
 */

export type SwipeDirection = "left" | "right" | "up";

/** Left and right commit at 30% of the card width… */
export const HORIZONTAL_COMMIT = 0.3;
/** …or with a flick faster than this (px/s). */
export const FLICK_VELOCITY = 500;
/** Up commits past 25% of the card height… */
export const UP_COMMIT = 0.25;
/** …and only when the drag is within 30° of straight up. */
export const UP_MAX_ANGLE_DEG = 30;

export type DragEnd = {
  /** Offset from the start, px. Up is negative. */
  dx: number;
  dy: number;
  /** Release velocity, px/s. */
  vx: number;
  vy: number;
  width: number;
  height: number;
};

/** What a released drag means, or null to spring back. */
export function classifySwipe(drag: DragEnd): SwipeDirection | null {
  const { dx, dy, vx, width, height } = drag;

  if (dy < 0) {
    const angleFromVertical =
      (Math.atan2(Math.abs(dx), Math.abs(dy)) * 180) / Math.PI;
    if (angleFromVertical <= UP_MAX_ANGLE_DEG && -dy >= height * UP_COMMIT) {
      return "up";
    }
  }

  // Horizontal swipes need the drag to be mostly sideways.
  if (Math.abs(dx) < Math.abs(dy)) return null;
  if (Math.abs(dx) >= width * HORIZONTAL_COMMIT)
    return dx > 0 ? "right" : "left";
  if (Math.abs(vx) >= FLICK_VELOCITY && Math.sign(vx) === Math.sign(dx)) {
    return vx > 0 ? "right" : "left";
  }
  return null;
}

/** How visible a drag label is (0–1), from the drag distance. */
export function dragProgress(offset: number, threshold: number): number {
  if (threshold <= 0) return 0;
  return Math.max(0, Math.min(1, offset / threshold));
}

/** Rating milestones (0009): small celebrations, no streaks. */
export const MILESTONES = [10, 25, 50, 100] as const;

/** The next milestone above `count`, or null after the last one. */
export function nextMilestone(count: number): number | null {
  return MILESTONES.find((m) => m > count) ?? null;
}

/** The milestone reached by going from `before` to `after`, if any. */
export function milestoneReached(before: number, after: number): number | null {
  return MILESTONES.find((m) => before < m && after >= m) ?? null;
}

/** Progress toward the next milestone, 0–1. */
export function milestoneProgress(count: number): number {
  const next = nextMilestone(count);
  if (next === null) return 1;
  const previous = [...MILESTONES].reverse().find((m) => m <= count) ?? 0;
  return (count - previous) / (next - previous);
}

/** Fetch more when this many cards or fewer are left (spec 05 #16). */
export const PREFETCH_WHEN_LEFT = 3;

export function shouldPrefetch(
  remaining: number,
  done: boolean,
  loading: boolean,
): boolean {
  return !done && !loading && remaining <= PREFETCH_WHEN_LEFT;
}

export type InputModel = "touch" | "web";

/** Decision 0009: by input type, not screen width. */
export function inputModelFor(media: {
  coarse: boolean;
  fineHover: boolean;
}): InputModel {
  if (media.coarse) return "touch";
  return media.fineHover ? "web" : "touch";
}

/** Number keys to ratings (0009): 1 = ½ star … 9 = 4½, 0 = 5 stars. */
export function ratingForKey(key: string): number | null {
  if (!/^[0-9]$/.test(key)) return null;
  const n = Number(key);
  return n === 0 ? 10 : n;
}

/** The milestone message (0009): one line, no guilt. */
export function milestoneMessage(milestone: number): string {
  switch (milestone) {
    case 10:
      return "10 ratings. Off to a great start.";
    case 25:
      return "25 ratings. Your taste is taking shape.";
    case 50:
      return "50 ratings. That's a real collection.";
    default:
      return `${milestone} ratings. Seriously impressive.`;
  }
}

export type UndoEntry = {
  animeId: number;
  eventId: number;
  /** Shown in the toast and announced. */
  label: string;
};

/** The undo stack: last in, first out, unlimited within a session (0009). */
export function pushUndo(stack: UndoEntry[], entry: UndoEntry): UndoEntry[] {
  return [...stack, entry];
}

export function popUndo(stack: UndoEntry[]): {
  entry: UndoEntry | null;
  rest: UndoEntry[];
} {
  if (stack.length === 0) return { entry: null, rest: stack };
  return { entry: stack[stack.length - 1] ?? null, rest: stack.slice(0, -1) };
}

/**
 * Which controls a card offers (0009): unaired anime can't be rated, given a
 * status or marked "Seen it"; like and watchlist always work.
 */
export function controlsFor(card: { isUpcoming: boolean }): {
  rating: boolean;
  status: boolean;
  seenIt: boolean;
  like: true;
  watchlist: true;
} {
  const aired = !card.isUpcoming;
  return {
    rating: aired,
    status: aired,
    seenIt: aired,
    like: true,
    watchlist: true,
  };
}
