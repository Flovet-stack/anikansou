import { useId } from "react";

import { cn } from "@/lib/utils";

import { STAR } from "./rating-stars";

/**
 * A rating shown, not edited: ½ to 5 small stars in Kohaku (decision 0006's
 * "your rating" context line). Decorative: the card's accessible name already
 * says the rating.
 */
export function StarsDisplay({
  rating,
  className,
}: {
  rating: number;
  className?: string;
}) {
  const id = useId();
  return (
    <span aria-hidden className={cn("flex items-center gap-0.5", className)}>
      {[1, 2, 3, 4, 5].map((star) => {
        const full = rating >= star * 2;
        const half = rating === star * 2 - 1;
        return (
          <svg key={star} viewBox="0 0 24 24" className="size-4">
            <defs>
              <clipPath id={`${id}-${star}`}>
                <rect x="0" y="0" width="12" height="24" />
              </clipPath>
            </defs>
            <path
              d={STAR}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="text-text-subtle"
            />
            {full || half ? (
              <path
                d={STAR}
                className="fill-kohaku stroke-kohaku"
                strokeWidth="1.5"
                clipPath={half ? `url(#${id}-${star})` : undefined}
              />
            ) : null}
          </svg>
        );
      })}
    </span>
  );
}
