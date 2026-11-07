import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { HugeiconsStarIcon } from "@/components/ui/hugeicons-star";

import type { Shelf } from "../types";

/** Empty-shelf copy (decision 0016). No guilt, no goals. */
const COPY: Record<Shelf, string> = {
  watched: "Nothing here yet. Rate a few anime and they'll show up here.",
  watchlist:
    "Nothing saved for later yet. Swipe up on a card in Rate, or tap the bookmark, to add one.",
  liked: "No likes yet. Tap the heart on any anime to keep it here.",
  watching: "Nothing on this shelf right now.",
  on_hold: "Nothing on this shelf right now.",
  dropped: "Nothing on this shelf right now.",
};

export function LibraryEmpty({ shelf }: { shelf: Shelf }) {
  return (
    <div className="flex flex-col items-center gap-6 rounded-lg bg-surface-1 px-6 py-16 text-center">
      <p className="max-w-reading text-body text-muted-foreground">
        {COPY[shelf]}
      </p>
      <Link href="/rate" className={buttonVariants()}>
        <HugeiconsStarIcon size={20} aria-hidden />
        Start rating
      </Link>
    </div>
  );
}
