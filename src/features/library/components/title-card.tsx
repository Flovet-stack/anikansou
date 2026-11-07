"use client";

import { forwardRef } from "react";

import { PosterArt } from "@/components/poster/poster-art";
import { HugeiconsHeartIcon } from "@/components/ui/hugeicons-heart";
import { metaLine } from "@/features/deck/types";
import { StarsDisplay } from "@/features/tracking/components/stars-display";
import { STATUS_META } from "@/features/tracking/components/status-picker";
import { ToggleAction } from "@/features/tracking/components/toggle-action";
import { cn } from "@/lib/utils";

import { cardLabel } from "../logic";
import type { LibraryCard } from "../types";
import { MoreIcon } from "./more-icon";

/**
 * The title card (decision 0006) as the Library uses it: poster with your
 * status badge and heart, the title beneath (two lines), the meta line, and
 * your rating as the context line. On pointer devices a quick-action bar
 * shows on hover or focus; on touch only the ⋯ button shows. The card itself
 * (its title button, stretched over the card) opens the edit sheet, since
 * there are no title pages yet (0016).
 */
export const TitleCard = forwardRef<
  HTMLButtonElement,
  {
    card: LibraryCard;
    /** Off the current shelf after an edit: dimmed until its toast closes. */
    leaving: boolean;
    onOpen: () => void;
    onToggleWatched: () => void;
    onToggleLike: () => void;
    onToggleWatchlist: () => void;
  }
>(function TitleCard(
  { card, leaving, onOpen, onToggleWatched, onToggleLike, onToggleWatchlist },
  ref,
) {
  const { status, rating, liked, watchlisted } = card.state;
  const meta = metaLine(card);
  return (
    <div
      className={cn(
        "group/card relative flex flex-col gap-2 transition-opacity duration-(--duration-base) ease-standard",
        leaving && "opacity-40",
      )}
    >
      <div className="relative">
        <PosterArt
          animeId={card.animeId}
          romajiTitle={card.title}
          nativeTitle={card.nativeTitle}
          format={card.format}
          year={card.year}
          urls={card.posterUrls}
        />
        {/* Your state, on the poster (0006): one status badge, a heart. */}
        {status ? (
          <span
            aria-hidden
            data-testid="status-badge"
            className={cn(
              "pointer-events-none absolute top-2 left-2 flex size-8 items-center justify-center rounded-full bg-black/70 [&_svg]:size-[18px]",
              STATUS_META[status].text,
            )}
          >
            {STATUS_META[status].icon}
          </span>
        ) : null}
        {liked ? (
          <span
            aria-hidden
            className="pointer-events-none absolute top-2 right-2 flex size-8 items-center justify-center rounded-full bg-black/70 text-state-like [&_path]:fill-current"
          >
            <HugeiconsHeartIcon size={18} aria-hidden />
          </span>
        ) : null}

        {/* Quick actions (0006): hover/focus bar on pointer devices. */}
        <div
          role="group"
          aria-label={`Quick actions for ${card.title}`}
          className="absolute inset-x-2 bottom-2 z-10 hidden justify-between gap-1 rounded-full bg-black/70 p-1 opacity-0 backdrop-blur-sm transition-opacity duration-(--duration-fast) group-focus-within/card:opacity-100 group-hover/card:opacity-100 pointer-fine:flex"
        >
          <ToggleAction
            kind="watched"
            on={status === "watched"}
            onToggle={onToggleWatched}
            disabled={card.isUpcoming}
            compact
            small
          />
          <ToggleAction
            kind="like"
            on={liked}
            onToggle={onToggleLike}
            compact
            small
          />
          <ToggleAction
            kind="watchlist"
            on={watchlisted}
            onToggle={onToggleWatchlist}
            compact
            small
          />
          <MoreButton title={card.title} onClick={onOpen} />
        </div>
        {/* Touch: the ⋯ button only, 44 × 44 (0006). */}
        <div className="absolute right-1 bottom-1 z-10 pointer-fine:hidden">
          <MoreButton title={card.title} onClick={onOpen} touch />
        </div>
      </div>

      <button
        ref={ref}
        type="button"
        onClick={onOpen}
        aria-label={cardLabel(card)}
        aria-haspopup="dialog"
        data-card-id={card.animeId}
        className="text-left font-display text-base leading-snug font-bold after:absolute after:inset-0 after:rounded-md focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-kohaku min-[600px]:text-title-s"
      >
        <span className="line-clamp-2">{card.title}</span>
      </button>
      {meta ? (
        <p className="-mt-1 text-[0.8125rem] text-muted-foreground tabular-nums min-[600px]:text-small">
          {meta}
        </p>
      ) : null}
      {rating ? <StarsDisplay rating={rating} /> : null}
    </div>
  );
});

function MoreButton({
  title,
  onClick,
  touch = false,
}: {
  title: string;
  onClick: () => void;
  touch?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`More for ${title}`}
      aria-haspopup="dialog"
      className={cn(
        "flex items-center justify-center rounded-full text-white transition-[background-color,transform] duration-(--duration-hover-out) active:scale-[0.97] hover-fine:bg-white/15 hover-fine:duration-(--duration-fast)",
        touch ? "size-11 bg-black/70" : "size-10",
      )}
    >
      <MoreIcon size={22} />
    </button>
  );
}
