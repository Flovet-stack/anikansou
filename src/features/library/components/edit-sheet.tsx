"use client";

import { Dialog } from "@base-ui/react/dialog";
import { useId } from "react";

import { Button } from "@/components/ui/button";
import { HugeiconsTrashIcon } from "@/components/ui/hugeicons-trash";
import { HugeiconsXIcon } from "@/components/ui/hugeicons-x";
import { metaLine } from "@/features/deck/types";
import { RatingStars } from "@/features/tracking/components/rating-stars";
import { StatusPicker } from "@/features/tracking/components/status-picker";
import { ToggleAction } from "@/features/tracking/components/toggle-action";
import type { WatchStatus } from "@/features/tracking/schemas";

import type { LibraryCard } from "../types";

/**
 * Edit one title (decision 0016): the four statuses, the stars (only when
 * Watched, per 0015), like, watchlist and "Remove from library". A dialog on
 * pointer devices, a bottom sheet on touch. Traps focus, closes on Esc and
 * returns focus to the card it came from.
 */
export function EditSheet({
  open,
  card,
  onClose,
  returnFocus,
  onStatus,
  onRate,
  onToggleLike,
  onToggleWatchlist,
  onRemove,
}: {
  open: boolean;
  /** Kept while the sheet animates closed. */
  card: LibraryCard | null;
  onClose: () => void;
  /** The element to focus when the sheet closes (the card). */
  returnFocus: () => HTMLElement | null;
  onStatus: (status: WatchStatus | null) => void;
  onRate: (rating: number | null) => void;
  onToggleLike: () => void;
  onToggleWatchlist: () => void;
  onRemove: () => void;
}) {
  const hintId = useId();
  const state = card?.state;
  const canRate = state?.status === "watched" && !card?.isUpcoming;
  const inLibrary = Boolean(
    state &&
    (state.status !== null ||
      state.rating !== null ||
      state.liked ||
      state.watchlisted),
  );

  return (
    <Dialog.Root
      open={open && card !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/60 transition-opacity duration-(--duration-base) data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup
          finalFocus={() => returnFocus() ?? true}
          className="fixed z-50 flex max-h-[90dvh] flex-col gap-6 overflow-y-auto bg-surface-1 p-6 shadow-float transition-[opacity,transform] duration-(--duration-base) ease-standard outline-none pointer-coarse:inset-x-0 pointer-coarse:bottom-0 pointer-coarse:rounded-t-lg pointer-coarse:pb-[calc(var(--spacing)*6+env(safe-area-inset-bottom))] pointer-coarse:data-ending-style:translate-y-full pointer-coarse:data-starting-style:translate-y-full pointer-fine:top-1/2 pointer-fine:left-1/2 pointer-fine:w-[min(30rem,calc(100vw-2rem))] pointer-fine:-translate-x-1/2 pointer-fine:-translate-y-1/2 pointer-fine:rounded-lg pointer-fine:data-ending-style:opacity-0 pointer-fine:data-starting-style:opacity-0"
        >
          {card && state ? (
            <>
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 flex-col gap-1">
                  <Dialog.Title className="font-display text-title-m font-extrabold">
                    {card.title}
                  </Dialog.Title>
                  <Dialog.Description className="text-small text-muted-foreground tabular-nums">
                    {metaLine(card) || "Edit this title"}
                  </Dialog.Description>
                </div>
                <Dialog.Close
                  aria-label="Close"
                  className="-mt-2 -mr-2 flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover-fine:bg-surface-2 hover-fine:text-foreground"
                >
                  <HugeiconsXIcon size={22} aria-hidden />
                </Dialog.Close>
              </div>

              <section className="flex flex-col gap-3">
                <h3 className="text-small font-semibold text-muted-foreground">
                  Status
                </h3>
                {card.isUpcoming ? (
                  <p className="text-small text-muted-foreground">
                    This anime hasn&apos;t aired yet, so it can&apos;t be rated
                    or given a status.
                  </p>
                ) : (
                  <StatusPicker value={state.status} onChange={onStatus} />
                )}
              </section>

              <section className="flex flex-col gap-3">
                <h3 className="text-small font-semibold text-muted-foreground">
                  Your rating
                </h3>
                <RatingStars
                  value={state.rating}
                  onChange={onRate}
                  clearable
                  disabled={!canRate}
                  describedBy={canRate ? undefined : hintId}
                />
                {canRate ? null : (
                  <p id={hintId} className="text-small text-muted-foreground">
                    {card.isUpcoming
                      ? "You can rate it once it airs."
                      : "Mark it watched to rate it."}
                  </p>
                )}
              </section>

              <div className="flex flex-wrap gap-2">
                <ToggleAction
                  kind="like"
                  on={state.liked}
                  onToggle={onToggleLike}
                />
                <ToggleAction
                  kind="watchlist"
                  on={state.watchlisted}
                  onToggle={onToggleWatchlist}
                />
              </div>

              <div className="border-hairline border-t pt-4">
                <Button
                  variant="destructive"
                  onClick={onRemove}
                  disabled={!inLibrary}
                >
                  <HugeiconsTrashIcon size={20} aria-hidden />
                  Remove from library
                </Button>
              </div>
            </>
          ) : null}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
