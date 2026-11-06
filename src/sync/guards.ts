export type GuardInput = {
  entryCount: number;
  /** Entry count of the last successful run, or null on the first run. */
  previousEntryCount: number | null;
  /** Active (not retired) anime before this run. */
  activeBefore: number;
  retired: number;
  merged: number;
};

export type GuardOptions = {
  minEntries: number;
  maxCountChange: number;
  maxRetiredShare: number;
  maxMergedShare: number;
};

export const DEFAULT_GUARDS: GuardOptions = {
  minEntries: 30_000,
  maxCountChange: 0.05,
  maxRetiredShare: 0.02,
  maxMergedShare: 0.01,
};

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

/** Returns the guard rails this run breaks. Empty means it is safe to apply. */
export function checkGuards(
  input: GuardInput,
  options: Partial<GuardOptions> = {},
): string[] {
  const o = { ...DEFAULT_GUARDS, ...options };
  const problems: string[] = [];

  if (input.entryCount < o.minEntries) {
    problems.push(
      `only ${input.entryCount} entries, the minimum is ${o.minEntries}`,
    );
  }
  if (input.previousEntryCount !== null && input.previousEntryCount > 0) {
    const change =
      Math.abs(input.entryCount - input.previousEntryCount) /
      input.previousEntryCount;
    if (change > o.maxCountChange) {
      problems.push(
        `entry count changed by ${pct(change)} (${input.previousEntryCount} → ${input.entryCount}), the limit is ${pct(o.maxCountChange)}`,
      );
    }
  }
  if (input.activeBefore > 0) {
    const retiredShare = input.retired / input.activeBefore;
    if (retiredShare > o.maxRetiredShare) {
      problems.push(
        `would retire ${input.retired} anime (${pct(retiredShare)}), the limit is ${pct(o.maxRetiredShare)}`,
      );
    }
    const mergedShare = input.merged / input.activeBefore;
    if (mergedShare > o.maxMergedShare) {
      problems.push(
        `would merge ${input.merged} anime (${pct(mergedShare)}), the limit is ${pct(o.maxMergedShare)}`,
      );
    }
  }
  return problems;
}
