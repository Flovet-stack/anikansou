import type { ReactNode } from "react";

import { PosterArt } from "@/components/poster/poster-art";

/**
 * The 404 and error screens (design brief §11): a generated poster, a short
 * on-brand line and one way forward.
 */
export function StatusScreen({
  posterId,
  posterGlyph,
  posterChip,
  title,
  description,
  action,
}: {
  posterId: number;
  posterGlyph: string;
  posterChip: string;
  title: string;
  description: string;
  action: ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-reading flex-col items-center gap-10 py-8 text-center sm:flex-row sm:items-center sm:gap-12 sm:text-left">
      <div className="w-40 shrink-0 sm:w-48">
        <PosterArt
          animeId={posterId}
          romajiTitle={posterGlyph}
          nativeTitle={posterGlyph}
          format={posterChip}
        />
      </div>
      <div className="flex flex-col items-center gap-5 sm:items-start">
        <h1 className="font-display text-title-l font-extrabold tracking-tight md:text-display-s">
          {title}
        </h1>
        <p className="text-body text-muted-foreground">{description}</p>
        <div className="pt-2">{action}</div>
      </div>
    </div>
  );
}
