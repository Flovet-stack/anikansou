"use client";

import { HugeiconsBookmark01Icon } from "@/components/ui/hugeicons-bookmark-01";
import { HugeiconsCircleCheckIcon } from "@/components/ui/hugeicons-circle-check";
import { HugeiconsHeartIcon } from "@/components/ui/hugeicons-heart";
import { cn } from "@/lib/utils";

const KINDS = {
  watched: {
    on: "Watched",
    off: "Mark watched",
    icon: HugeiconsCircleCheckIcon,
    text: "text-state-watched",
    tint: "bg-[color-mix(in_oklab,var(--state-watched)_16%,var(--surface-2))]",
    hover:
      "hover-fine:bg-[color-mix(in_oklab,var(--state-watched)_12%,var(--surface-2))] hover-fine:text-state-watched",
  },
  like: {
    on: "Liked",
    off: "Like",
    icon: HugeiconsHeartIcon,
    text: "text-state-like",
    tint: "bg-[color-mix(in_oklab,var(--state-like)_16%,var(--surface-2))]",
    hover:
      "hover-fine:bg-[color-mix(in_oklab,var(--state-like)_12%,var(--surface-2))] hover-fine:text-state-like",
  },
  watchlist: {
    on: "On watchlist",
    off: "Watchlist",
    icon: HugeiconsBookmark01Icon,
    text: "text-state-watchlist",
    tint: "bg-[color-mix(in_oklab,var(--state-watchlist)_16%,var(--surface-2))]",
    hover:
      "hover-fine:bg-[color-mix(in_oklab,var(--state-watchlist)_12%,var(--surface-2))] hover-fine:text-state-watchlist",
  },
} as const;

/**
 * Watched, like and watchlist toggles (decisions 0005 and 0007 §2): each has its own
 * colour and icon, fills when on, and tints toward its colour on hover.
 */
export function ToggleAction({
  kind,
  on,
  onToggle,
  compact = false,
  small = false,
  disabled = false,
  keyHint,
}: {
  kind: keyof typeof KINDS;
  on: boolean;
  onToggle: () => void;
  compact?: boolean;
  /** With `compact`: a 40 px button, for the title card's action bar. */
  small?: boolean;
  disabled?: boolean;
  keyHint?: string;
}) {
  const meta = KINDS[kind];
  const Icon = meta.icon;
  const label = on ? meta.on : meta.off;
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={compact ? label : undefined}
      aria-keyshortcuts={keyHint}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-[background-color,color,transform] duration-(--duration-hover-out) ease-in-out active:scale-[0.97] disabled:opacity-50 hover-fine:duration-(--duration-fast)",
        compact ? (small ? "size-10" : "size-12") : "min-h-11 px-4 text-small",
        on
          ? cn(
              meta.text,
              meta.tint,
              // Heart and bookmark fill; a filled circle-check would hide its tick.
              kind !== "watched" && "[&_path]:fill-current",
            )
          : cn("bg-surface-2 text-muted-foreground", meta.hover),
      )}
    >
      <Icon size={compact && !small ? 24 : 20} aria-hidden />
      {compact ? null : label}
    </button>
  );
}
