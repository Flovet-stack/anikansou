"use client";

import { Menu } from "@base-ui/react/menu";
import type { ReactNode } from "react";

import { HugeiconsCheckIcon } from "@/components/ui/hugeicons-check";
import { HugeiconsChevronRightIcon } from "@/components/ui/hugeicons-chevron-right";
import { cn } from "@/lib/utils";

import {
  type Filters,
  GENRES,
  GENRE_KEYS,
  type GenreKey,
  SEASONS,
  SEASON_LABELS,
  STATUSES,
  STATUS_LABELS,
  type Season,
  type Status,
  TYPES,
  TYPE_LABELS,
  isSingleYear,
  toggled,
  withYear,
  yearOptions,
} from "../filters";

const ITEM =
  "flex min-h-11 cursor-default items-center justify-between gap-4 rounded-md px-3 text-small outline-none select-none data-disabled:opacity-40 data-highlighted:bg-surface-3 data-checked:font-semibold";
const GROUP_LABEL =
  "px-3 pt-3 pb-1 text-caption font-semibold text-muted-foreground";
const ANY = "any";

/**
 * The filter row on desktop (decision 0020): Type, Genre, Year and More
 * filters, each a small menu. Every change applies straight away (with the
 * search's debounce), so menus stay open for picking several values.
 */
export function FilterMenus({
  filters,
  latestYear,
  onChange,
}: {
  filters: Filters;
  latestYear: number;
  onChange: (next: Filters) => void;
}) {
  const moreCount =
    (filters.status === null ? 0 : 1) + (filters.season === null ? 0 : 1);
  return (
    <div className="flex flex-wrap gap-2">
      <FilterMenu label="Type" count={filters.types.length}>
        {TYPES.map((type) => (
          <CheckItem
            key={type}
            label={TYPE_LABELS[type]}
            checked={filters.types.includes(type)}
            onToggle={() =>
              onChange({
                ...filters,
                types: toggled(filters.types, type, TYPES),
              })
            }
          />
        ))}
      </FilterMenu>

      <FilterMenu label="Genre" count={filters.genres.length}>
        <GenreGroup
          label="Genres"
          group="genre"
          filters={filters}
          onChange={onChange}
        />
        <GenreGroup
          label="Audience"
          group="audience"
          filters={filters}
          onChange={onChange}
        />
      </FilterMenu>

      <FilterMenu label="Year" count={filters.year === null ? 0 : 1}>
        <Menu.RadioGroup
          value={filters.year ?? ANY}
          onValueChange={(value: string) =>
            onChange(withYear(filters, value === ANY ? null : value))
          }
        >
          <RadioItem value={ANY} label="Any year" />
          {yearOptions(latestYear).map((option) => (
            <RadioItem
              key={option.value}
              value={option.value}
              label={option.label}
            />
          ))}
        </Menu.RadioGroup>
      </FilterMenu>

      <FilterMenu label="More filters" count={moreCount}>
        <Menu.Group>
          <Menu.GroupLabel className={GROUP_LABEL}>Status</Menu.GroupLabel>
          <Menu.RadioGroup
            value={filters.status ?? ANY}
            onValueChange={(value: string) =>
              onChange({
                ...filters,
                status: value === ANY ? null : (value as Status),
              })
            }
          >
            <RadioItem value={ANY} label="Any status" />
            {STATUSES.map((status) => (
              <RadioItem
                key={status}
                value={status}
                label={STATUS_LABELS[status]}
              />
            ))}
          </Menu.RadioGroup>
        </Menu.Group>
        <Menu.Group>
          <Menu.GroupLabel className={GROUP_LABEL}>Season</Menu.GroupLabel>
          {isSingleYear(filters.year) ? null : (
            <p className="px-3 pb-1 text-caption text-muted-foreground">
              Choose a single year first.
            </p>
          )}
          <Menu.RadioGroup
            value={filters.season ?? ANY}
            onValueChange={(value: string) =>
              onChange({
                ...filters,
                season: value === ANY ? null : (value as Season),
              })
            }
          >
            <RadioItem
              value={ANY}
              label="Any season"
              disabled={!isSingleYear(filters.year)}
            />
            {SEASONS.map((season) => (
              <RadioItem
                key={season}
                value={season}
                label={SEASON_LABELS[season]}
                disabled={!isSingleYear(filters.year)}
              />
            ))}
          </Menu.RadioGroup>
        </Menu.Group>
      </FilterMenu>
    </div>
  );
}

function FilterMenu({
  label,
  count,
  children,
}: {
  label: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <Menu.Root modal={false}>
      <Menu.Trigger
        aria-label={count > 0 ? `${label}, ${count} selected` : label}
        className={cn(
          "inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-small font-semibold transition-colors duration-(--duration-hover-out) outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kohaku hover-fine:duration-(--duration-fast)",
          count > 0
            ? "bg-surface-3 text-foreground"
            : "bg-surface-2 text-muted-foreground hover-fine:bg-surface-3 hover-fine:text-foreground",
        )}
      >
        {label}
        {count > 0 ? (
          <span className="text-accent-text tabular-nums">{count}</span>
        ) : null}
        <HugeiconsChevronRightIcon
          size={16}
          aria-hidden
          className="rotate-90"
        />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner sideOffset={8} align="start" className="z-40">
          <Menu.Popup className="max-h-[min(24rem,var(--available-height))] w-56 overflow-y-auto rounded-lg bg-surface-2 p-1.5 shadow-float outline-none">
            {children}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

function GenreGroup({
  label,
  group,
  filters,
  onChange,
}: {
  label: string;
  group: "genre" | "audience";
  filters: Filters;
  onChange: (next: Filters) => void;
}) {
  return (
    <Menu.Group>
      <Menu.GroupLabel className={GROUP_LABEL}>{label}</Menu.GroupLabel>
      {GENRES.filter((genre) => genre.group === group).map((genre) => (
        <CheckItem
          key={genre.key}
          label={genre.label}
          checked={filters.genres.includes(genre.key as GenreKey)}
          onToggle={() =>
            onChange({
              ...filters,
              genres: toggled(filters.genres, genre.key, GENRE_KEYS),
            })
          }
        />
      ))}
    </Menu.Group>
  );
}

function CheckItem({
  label,
  checked,
  onToggle,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <Menu.CheckboxItem
      checked={checked}
      onCheckedChange={onToggle}
      closeOnClick={false}
      className={ITEM}
    >
      {label}
      <Menu.CheckboxItemIndicator className="text-accent-text">
        <HugeiconsCheckIcon size={16} aria-hidden />
      </Menu.CheckboxItemIndicator>
    </Menu.CheckboxItem>
  );
}

function RadioItem({
  value,
  label,
  disabled = false,
}: {
  value: string;
  label: string;
  disabled?: boolean;
}) {
  return (
    <Menu.RadioItem
      value={value}
      disabled={disabled}
      closeOnClick={false}
      className={ITEM}
    >
      {label}
      <Menu.RadioItemIndicator className="text-accent-text">
        <HugeiconsCheckIcon size={16} aria-hidden />
      </Menu.RadioItemIndicator>
    </Menu.RadioItem>
  );
}
