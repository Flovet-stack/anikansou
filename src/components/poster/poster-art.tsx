"use client";

import { cn } from "@/lib/utils";
import { useCallback, useState } from "react";

import { posterChip, posterColors, posterGlyph } from "./poster-style";

// A few hundred bytes of film grain, inline so no image is ever fetched for it.
const GRAIN = `url("data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="140" height="140"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch"/></filter><rect width="140" height="140" filter="url(#n)"/></svg>',
)}")`;

export type PosterArtProps = {
  animeId: number | bigint | string;
  romajiTitle: string;
  nativeTitle?: string | null;
  format?: string | null;
  year?: number | null;
  /** Artwork URLs, best first (spec 03's `resolvePosterUrls` output). */
  urls?: readonly string[];
  className?: string;
};

/**
 * A 2:3 poster (decision 0004). Shows the first artwork URL that loads and
 * moves to the next one on error. The generated poster sits underneath, so it
 * shows when there are no URLs, while the first is loading, and when every
 * URL fails. Everything here is decorative: the title next to the poster is
 * what assistive tech reads.
 */
export function PosterArt(props: PosterArtProps) {
  const urls = props.urls ?? [];
  // A new anime or a new URL list starts the fallback chain from the top.
  return (
    <PosterArtInner
      key={`${String(props.animeId)}|${urls.join("|")}`}
      {...props}
      urls={urls}
    />
  );
}

function PosterArtInner({
  animeId,
  romajiTitle,
  nativeTitle,
  format,
  year,
  urls = [],
  className,
}: PosterArtProps) {
  const [index, setIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const { from, to, angle } = posterColors(animeId);
  const glyph = posterGlyph(nativeTitle, romajiTitle);
  const chip = posterChip(format, year);
  const src = urls[index];

  const next = useCallback(() => {
    setLoaded(false);
    setIndex((current) => current + 1);
  }, []);

  // A server-rendered image can finish (or fail) before React hydrates and
  // attaches onLoad/onError, so check its state when it mounts.
  const checkSettled = useCallback(
    (image: HTMLImageElement | null) => {
      if (!image?.complete || !image.currentSrc) return;
      if (image.naturalWidth > 0) setLoaded(true);
      else next();
    },
    [next],
  );

  return (
    <div
      data-slot="poster"
      className={cn(
        "[container-type:inline-size] relative aspect-[2/3] w-full max-w-full overflow-hidden rounded-md bg-surface-2",
        className,
      )}
    >
      <div
        aria-hidden
        data-testid="poster-fallback"
        className="absolute inset-0 text-white"
        style={{ background: `linear-gradient(${angle}deg, ${from}, ${to})` }}
      >
        <div
          className="absolute inset-0 opacity-20 mix-blend-overlay"
          style={{ backgroundImage: GRAIN }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_30%_100%,rgb(10_6_6/0.55),transparent_60%)]" />
        <span className="absolute top-[7cqw] right-[6cqw] max-h-[calc(100%-25cqw)] overflow-hidden font-jp text-[clamp(1.25rem,17cqw,3rem)] leading-none font-extrabold tracking-wide opacity-55 [writing-mode:vertical-rl]">
          {glyph}
        </span>
        {chip ? (
          <span className="absolute bottom-[5cqw] left-[5cqw] rounded-full bg-black/55 px-2 py-0.5 text-caption font-semibold text-white tabular-nums">
            {chip}
          </span>
        ) : null}
      </div>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- poster hosts come from spec 03's allowlist and vary per source; next/image needs each one configured.
        <img
          key={src}
          ref={checkSettled}
          src={src}
          alt=""
          decoding="async"
          data-testid="poster-image"
          className={cn(
            "absolute inset-0 size-full object-cover transition-opacity duration-(--duration-base) ease-standard",
            loaded ? "opacity-100" : "opacity-0",
          )}
          onLoad={() => setLoaded(true)}
          onError={next}
        />
      ) : null}
    </div>
  );
}
