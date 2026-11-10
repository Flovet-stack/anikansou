"use client";

import { Dialog } from "@base-ui/react/dialog";
import { type ReactNode, useState } from "react";

import { Button } from "@/components/ui/button";
import { HugeiconsXIcon } from "@/components/ui/hugeicons-x";
import { cn } from "@/lib/utils";

import {
  type Filters,
  GENRES,
  GENRE_KEYS,
  SEASONS,
  SEASON_LABELS,
  STATUSES,
  STATUS_LABELS,
  TYPES,
  TYPE_LABELS,
  activeFilterCount,
  clearedFilters,
  isSingleYear,
  toggled,
  withYear,
  yearOptions,
} from "../filters";

/**
 * The filters on phones (decision 0020): one button that opens a bottom sheet
 * of chips. Nothing changes until Show results; closing discards the draft.
 */
export function FilterSheet({
  filters,
  latestYear,
  onApply,
}: {
  filters: Filters;
  latestYear: number;
  onApply: (next: Filters) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(filters);
  const count = activeFilterCount(filters);
  const single = isSingleYear(draft.year);

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        // Every opening starts from what's applied.
        if (next) setDraft(filters);
        setOpen(next);
      }}
    >
      <Dialog.Trigger
        className={cn(
          "inline-flex min-h-11 items-center gap-2 self-start rounded-full px-5 text-small font-semibold",
          count > 0
            ? "bg-surface-3 text-foreground"
            : "bg-surface-2 text-muted-foreground",
        )}
      >
        Filters
        {count > 0 ? (
          <span className="text-accent-text tabular-nums">· {count}</span>
        ) : null}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/60 transition-opacity duration-(--duration-base) data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup className="fixed inset-x-0 bottom-0 z-50 flex max-h-[90dvh] flex-col rounded-t-lg bg-surface-1 shadow-float transition-transform duration-(--duration-base) ease-standard outline-none data-ending-style:translate-y-full data-starting-style:translate-y-full">
          <div className="flex items-center justify-between gap-4 p-4 pb-2">
            <Dialog.Title className="font-display text-title-m font-extrabold">
              Filters
            </Dialog.Title>
            <Dialog.Close
              aria-label="Close filters"
              className="flex size-11 items-center justify-center rounded-full text-muted-foreground"
            >
              <HugeiconsXIcon size={20} aria-hidden />
            </Dialog.Close>
          </div>

          <div className="flex flex-col gap-5 overflow-y-auto px-4 pb-4">
            <ChipGroup label="Type">
              {TYPES.map((type) => (
                <Chip
                  key={type}
                  on={draft.types.includes(type)}
                  onClick={() =>
                    setDraft({
                      ...draft,
                      types: toggled(draft.types, type, TYPES),
                    })
                  }
                >
                  {TYPE_LABELS[type]}
                </Chip>
              ))}
            </ChipGroup>

            <ChipGroup label="Genres">
              {GENRES.filter((g) => g.group === "genre").map((genre) => (
                <Chip
                  key={genre.key}
                  on={draft.genres.includes(genre.key)}
                  onClick={() =>
                    setDraft({
                      ...draft,
                      genres: toggled(draft.genres, genre.key, GENRE_KEYS),
                    })
                  }
                >
                  {genre.label}
                </Chip>
              ))}
            </ChipGroup>

            <ChipGroup label="Audience">
              {GENRES.filter((g) => g.group === "audience").map((genre) => (
                <Chip
                  key={genre.key}
                  on={draft.genres.includes(genre.key)}
                  onClick={() =>
                    setDraft({
                      ...draft,
                      genres: toggled(draft.genres, genre.key, GENRE_KEYS),
                    })
                  }
                >
                  {genre.label}
                </Chip>
              ))}
            </ChipGroup>

            <ChipGroup label="Year">
              {yearOptions(latestYear).map((option) => (
                <Chip
                  key={option.value}
                  on={draft.year === option.value}
                  onClick={() =>
                    setDraft(
                      withYear(
                        draft,
                        draft.year === option.value ? null : option.value,
                      ),
                    )
                  }
                >
                  {option.label}
                </Chip>
              ))}
            </ChipGroup>

            <ChipGroup
              label="Season"
              hint={single ? undefined : "Choose a single year first."}
            >
              {SEASONS.map((season) => (
                <Chip
                  key={season}
                  on={draft.season === season}
                  disabled={!single}
                  onClick={() =>
                    setDraft({
                      ...draft,
                      season: draft.season === season ? null : season,
                    })
                  }
                >
                  {SEASON_LABELS[season]}
                </Chip>
              ))}
            </ChipGroup>

            <ChipGroup label="Status">
              {STATUSES.map((status) => (
                <Chip
                  key={status}
                  on={draft.status === status}
                  onClick={() =>
                    setDraft({
                      ...draft,
                      status: draft.status === status ? null : status,
                    })
                  }
                >
                  {STATUS_LABELS[status]}
                </Chip>
              ))}
            </ChipGroup>
          </div>

          <div className="flex gap-3 border-t border-border p-4 pb-[calc(var(--spacing)*4+env(safe-area-inset-bottom))]">
            <Button
              variant="ghost"
              className="flex-1"
              onClick={() => setDraft(clearedFilters(draft))}
            >
              Clear all
            </Button>
            <Button
              className="flex-1"
              onClick={() => {
                setOpen(false);
                onApply(draft);
              }}
            >
              Show results
            </Button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ChipGroup({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string | undefined;
  children: ReactNode;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="pb-2 text-small font-semibold">{label}</legend>
      {hint ? (
        <p className="-mt-1 text-caption text-muted-foreground">{hint}</p>
      ) : null}
      <div className="flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}

function Chip({
  on,
  disabled = false,
  onClick,
  children,
}: {
  on: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "min-h-11 rounded-full px-4 text-small font-semibold transition-colors active:scale-[0.97] disabled:opacity-40",
        on
          ? "bg-kohaku text-on-accent"
          : "bg-surface-2 text-muted-foreground hover-fine:bg-surface-3",
      )}
    >
      {children}
    </button>
  );
}
