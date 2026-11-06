import { cn } from "@/lib/utils";

import { type DeckCard, metaLine, studioLine } from "../types";

/** Title and facts under the poster (decisions 0006, 0010). No score. */
export function CardDetails({
  card,
  headingId,
  className,
}: {
  card: DeckCard;
  headingId: string;
  className?: string;
}) {
  const meta = metaLine(card);
  const studio = studioLine(card);
  return (
    <div className={cn("flex min-w-0 flex-col gap-2", className)}>
      <h2
        id={headingId}
        className="line-clamp-3 font-display text-title-m font-extrabold tracking-tight"
        title={card.title}
      >
        {card.title}
      </h2>
      {meta ? (
        <p className="text-small text-muted-foreground tabular-nums">{meta}</p>
      ) : null}
      {studio ? <p className="text-small text-text-subtle">{studio}</p> : null}
      {card.tags.length > 0 ? (
        <ul aria-label="Tags" className="flex flex-wrap gap-2 pt-1">
          {card.tags.slice(0, 3).map((tag) => (
            <li
              key={tag}
              className="rounded-full bg-surface-2 px-3 py-1 text-caption text-muted-foreground"
            >
              {tag}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
