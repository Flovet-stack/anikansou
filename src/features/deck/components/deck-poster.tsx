"use client";

import { PosterArt } from "@/components/poster/poster-art";
import { cn } from "@/lib/utils";

import type { DeckCard } from "../types";

/**
 * The deck's poster (decision 0010): the artwork or generated fallback, with an
 * "Upcoming" or "18+" badge. Adult posters stay blurred until revealed.
 */
export function DeckPoster({
  card,
  revealed,
  onReveal,
}: {
  card: DeckCard;
  revealed: boolean;
  onReveal: () => void;
}) {
  const blurred = card.isAdult && !revealed;
  return (
    <div className="relative">
      <div
        className={cn(
          "overflow-hidden rounded-md transition-[filter] duration-(--duration-base)",
          blurred && "blur-xl saturate-50",
        )}
      >
        <PosterArt
          animeId={card.animeId}
          romajiTitle={card.title}
          nativeTitle={card.nativeTitle}
          format={card.format}
          year={card.year}
          urls={card.posterUrls}
        />
      </div>
      <div className="pointer-events-none absolute top-3 left-3 flex gap-2">
        {card.isUpcoming ? (
          <span className="rounded-full bg-black/70 px-3 py-1 text-caption font-semibold text-white">
            Upcoming
          </span>
        ) : null}
        {card.isAdult ? (
          <span className="rounded-full bg-black/70 px-3 py-1 text-caption font-semibold text-white">
            18+
          </span>
        ) : null}
      </div>
      {blurred ? (
        <button
          type="button"
          onClick={onReveal}
          className="absolute inset-0 flex items-center justify-center rounded-md text-small font-semibold text-white"
        >
          <span className="rounded-full bg-black/70 px-4 py-2">
            Show poster (18+)
          </span>
        </button>
      ) : null}
    </div>
  );
}
