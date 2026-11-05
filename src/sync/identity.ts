/**
 * Matches release entries to our anime IDs. The dataset has no stable IDs, so
 * an entry is the same anime as before when it shares a source URL with it.
 * Pure and deterministic: the same inputs always give the same plan.
 */

export type ExistingState = {
  /** URL key (see normalizeUrl) → anime id, from catalog.external_ids. */
  urlToId: Map<string, number>;
  /** Every anime id we know, with whether it is retired. */
  anime: Map<number, { retired: boolean }>;
};

export type IdentityPlan = {
  /** For each entry, the existing anime id it keeps, or null for a new anime. */
  assignments: (number | null)[];
  /** Anime merged into another (from → to), sorted by `from`. */
  merges: { from: number; to: number }[];
  /** Active anime no entry matched, sorted. */
  retired: number[];
  /** Retired anime that an entry matched again, sorted. */
  revived: number[];
  stats: {
    matched: number;
    new: number;
    /** Entries that matched an anime but lost it to another entry. */
    split: number;
    merged: number;
    retired: number;
    revived: number;
  };
};

type Claim = { entry: number; overlap: number; smallestUrl: string };

/** Higher overlap wins; on a tie, the smaller shared URL; then the earlier entry. */
function betterClaim(a: Claim, b: Claim): boolean {
  if (a.overlap !== b.overlap) return a.overlap > b.overlap;
  if (a.smallestUrl !== b.smallestUrl) return a.smallestUrl < b.smallestUrl;
  return a.entry < b.entry;
}

export function matchIdentities(
  entries: { urls: string[] }[],
  existing: ExistingState,
): IdentityPlan {
  // 1. For each anime, the best entry claiming it.
  const winner = new Map<number, Claim>();
  const matchedAny = new Array<boolean>(entries.length).fill(false);

  entries.forEach((e, index) => {
    const shared = new Map<number, string[]>();
    for (const url of e.urls) {
      const id = existing.urlToId.get(url);
      if (id === undefined) continue;
      const list = shared.get(id) ?? [];
      list.push(url);
      shared.set(id, list);
    }
    for (const [id, urls] of shared) {
      matchedAny[index] = true;
      const claim: Claim = {
        entry: index,
        overlap: urls.length,
        smallestUrl: [...urls].sort()[0] ?? "",
      };
      const current = winner.get(id);
      if (!current || betterClaim(claim, current)) winner.set(id, claim);
    }
  });

  // 2. For each entry, the ids it won. The lowest is kept; the rest merge into it.
  const won = new Map<number, number[]>();
  for (const [id, claim] of winner) {
    const list = won.get(claim.entry) ?? [];
    list.push(id);
    won.set(claim.entry, list);
  }

  const assignments: (number | null)[] = [];
  const merges: { from: number; to: number }[] = [];
  const kept = new Set<number>();
  let split = 0;

  entries.forEach((_, index) => {
    const ids = (won.get(index) ?? []).sort((a, b) => a - b);
    const [keep, ...rest] = ids;
    if (keep === undefined) {
      if (matchedAny[index]) split += 1;
      assignments.push(null);
      return;
    }
    assignments.push(keep);
    kept.add(keep);
    for (const from of rest) merges.push({ from, to: keep });
  });

  merges.sort((a, b) => a.from - b.from);
  const mergedAway = new Set(merges.map((m) => m.from));

  const retired: number[] = [];
  const revived: number[] = [];
  for (const [id, state] of existing.anime) {
    if (kept.has(id)) {
      if (state.retired) revived.push(id);
    } else if (!state.retired && !mergedAway.has(id)) {
      retired.push(id);
    }
  }
  retired.sort((a, b) => a - b);
  revived.sort((a, b) => a - b);

  const matched = assignments.filter((a) => a !== null).length;
  return {
    assignments,
    merges,
    retired,
    revived,
    stats: {
      matched,
      new: entries.length - matched,
      split,
      merged: merges.length,
      retired: retired.length,
      revived: revived.length,
    },
  };
}
