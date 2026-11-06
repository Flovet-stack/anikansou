"use client";

import type { ReactNode } from "react";

import { HugeiconsCircleCheckIcon } from "@/components/ui/hugeicons-circle-check";
import { HugeiconsLogOutIcon } from "@/components/ui/hugeicons-log-out";
import { HugeiconsPauseIcon } from "@/components/ui/hugeicons-pause";
import { HugeiconsPlayIcon } from "@/components/ui/hugeicons-play";
import type { WatchStatus } from "@/features/tracking/schemas";
import { cn } from "@/lib/utils";

/** Each status's label, icon and colour (decision 0005). */
export const STATUS_META: Record<
  WatchStatus,
  { label: string; icon: ReactNode; text: string; tint: string }
> = {
  watched: {
    label: "Watched",
    icon: <HugeiconsCircleCheckIcon size={20} aria-hidden />,
    text: "text-state-watched",
    tint: "bg-[color-mix(in_oklab,var(--state-watched)_16%,var(--surface-2))]",
  },
  watching: {
    label: "Watching",
    icon: <HugeiconsPlayIcon size={20} aria-hidden />,
    text: "text-state-watching",
    tint: "bg-[color-mix(in_oklab,var(--state-watching)_16%,var(--surface-2))]",
  },
  on_hold: {
    label: "On hold",
    icon: <HugeiconsPauseIcon size={20} aria-hidden />,
    text: "text-state-onhold",
    tint: "bg-[color-mix(in_oklab,var(--state-onhold)_16%,var(--surface-2))]",
  },
  dropped: {
    label: "Dropped",
    icon: <HugeiconsLogOutIcon size={20} aria-hidden />,
    text: "text-state-dropped",
    tint: "bg-[color-mix(in_oklab,var(--state-dropped)_16%,var(--surface-2))]",
  },
};

const ORDER: WatchStatus[] = ["watched", "watching", "on_hold", "dropped"];

/**
 * The four statuses as toggle buttons (decision 0005: colour, icon and label).
 * Clicking the active one clears it when `clearable`.
 */
export function StatusPicker({
  value,
  onChange,
  clearable = true,
  disabled = false,
}: {
  value: WatchStatus | null;
  onChange: (status: WatchStatus | null) => void;
  clearable?: boolean;
  disabled?: boolean;
}) {
  return (
    <div role="group" aria-label="Status" className="flex flex-wrap gap-2">
      {ORDER.map((status) => {
        const meta = STATUS_META[status];
        const active = value === status;
        return (
          <button
            key={status}
            type="button"
            disabled={disabled}
            aria-pressed={active}
            onClick={() => onChange(active && clearable ? null : status)}
            className={cn(
              "inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-small font-semibold transition-[background-color,color,transform] duration-(--duration-hover-out) ease-in-out active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 hover-fine:duration-(--duration-fast)",
              active
                ? cn(meta.text, meta.tint)
                : "bg-surface-2 text-muted-foreground hover-fine:bg-surface-3 hover-fine:text-foreground",
            )}
          >
            {meta.icon}
            {meta.label}
          </button>
        );
      })}
    </div>
  );
}
