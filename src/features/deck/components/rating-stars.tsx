"use client";

import { useId } from "react";

import { ratingToStars } from "@/features/tracking/schemas";
import { cn } from "@/lib/utils";

// The Hugeicons star outline (decision 0003), drawn static so a half can be
// clipped (0003 allows clipping a full star for the half star).
const STAR =
  "M13.7276 3.44418L15.4874 6.99288C15.7274 7.48687 16.3673 7.9607 16.9073 8.05143L20.0969 8.58575C22.1367 8.92853 22.6167 10.4206 21.1468 11.8925L18.6671 14.3927C18.2471 14.8161 18.0172 15.6327 18.1471 16.2175L18.8571 19.3125C19.417 21.7623 18.1271 22.71 15.9774 21.4296L12.9877 19.6452C12.4478 19.3226 11.5579 19.3226 11.0079 19.6452L8.01827 21.4296C5.8785 22.71 4.57865 21.7522 5.13859 19.3125L5.84851 16.2175C5.97849 15.6327 5.74852 14.8161 5.32856 14.3927L2.84884 11.8925C1.389 10.4206 1.85895 8.92853 3.89872 8.58575L7.08837 8.05143C7.61831 7.9607 8.25824 7.48687 8.49821 6.99288L10.258 3.44418C11.2179 1.51861 12.7777 1.51861 13.7276 3.44418Z";

function starsLabel(rating: number): string {
  const stars = ratingToStars(rating);
  return `${stars} ${stars === 1 ? "star" : "stars"}`;
}

/**
 * Half-star rating (brief: stored 1–10, shown as ½–5 stars). Ten targets, two
 * per star, each a real button so it works with a mouse, touch, keyboard and
 * screen readers. The current value is announced; clicking it again clears it
 * when `clearable`.
 */
export function RatingStars({
  value,
  onChange,
  size = "md",
  clearable = false,
  disabled = false,
  label = "Your rating",
  describedBy,
}: {
  value: number | null;
  onChange: (rating: number | null) => void;
  size?: "md" | "lg";
  clearable?: boolean;
  disabled?: boolean;
  label?: string;
  /** Id of a line explaining why the stars are disabled. */
  describedBy?: string;
}) {
  const id = useId();
  const box = size === "lg" ? "size-14" : "size-10";

  return (
    <div className="flex items-center gap-4">
      <div
        role="group"
        aria-label={
          value ? `${label}: ${starsLabel(value)}` : `${label}: not rated`
        }
        aria-describedby={describedBy}
        aria-disabled={disabled || undefined}
        className={cn("flex items-center", disabled && "opacity-50")}
      >
        {[1, 2, 3, 4, 5].map((star) => {
          const full = value !== null && value >= star * 2;
          const half = value !== null && value === star * 2 - 1;
          return (
            <span key={star} className={cn("relative", box)}>
              <svg
                viewBox="0 0 24 24"
                aria-hidden
                className="pointer-events-none absolute inset-0 size-full"
              >
                <defs>
                  <clipPath id={`${id}-half-${star}`}>
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
                    clipPath={half ? `url(#${id}-half-${star})` : undefined}
                  />
                ) : null}
              </svg>
              {[star * 2 - 1, star * 2].map((rating) => (
                <button
                  key={rating}
                  type="button"
                  disabled={disabled}
                  aria-label={starsLabel(rating)}
                  aria-pressed={value === rating}
                  onClick={() =>
                    onChange(clearable && value === rating ? null : rating)
                  }
                  className={cn(
                    "absolute inset-y-0 w-1/2 rounded-sm transition-transform duration-(--duration-fast) active:scale-[0.97] disabled:cursor-not-allowed",
                    rating % 2 === 1 ? "left-0" : "right-0",
                  )}
                />
              ))}
            </span>
          );
        })}
      </div>
      <span
        aria-hidden
        className="min-w-[3ch] font-display text-title-m font-extrabold text-accent-text tabular-nums"
      >
        {value ? ratingToStars(value) : ""}
      </span>
    </div>
  );
}
