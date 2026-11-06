"use client";

import { HugeiconsBookmark01Icon } from "@/components/ui/hugeicons-bookmark-01";
import { HugeiconsHeartIcon } from "@/components/ui/hugeicons-heart";
import { cn } from "@/lib/utils";

const KINDS = {
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
 * Like and watchlist toggles (decisions 0005 and 0007 §2): each has its own
 * colour and icon, fills when on, and tints toward its colour on hover.
 */
export function ToggleAction({
  kind,
  on,
  onToggle,
  compact = false,
  disabled = false,
  keyHint,
}: {
  kind: keyof typeof KINDS;
  on: boolean;
  onToggle: () => void;
  compact?: boolean;
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
        compact ? "size-12" : "min-h-11 px-4 text-small",
        on
          ? cn(meta.text, meta.tint, "[&_path]:fill-current")
          : cn("bg-surface-2 text-muted-foreground", meta.hover),
      )}
    >
      <Icon size={compact ? 24 : 20} aria-hidden />
      {compact ? null : label}
    </button>
  );
}
