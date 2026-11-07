"use client";

import { useEffect } from "react";

import { cn } from "@/lib/utils";

import { milestoneProgress, nextMilestone } from "../logic";

/**
 * Session counter and a ring toward the next milestone (decision 0009).
 * Progress only: no streaks, timers or goals.
 */
export function DeckProgress({
  sessionRated,
  ratedTotal,
  className,
}: {
  sessionRated: number;
  ratedTotal: number;
  className?: string;
}) {
  const next = nextMilestone(ratedTotal);
  const progress = milestoneProgress(ratedTotal);
  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className={cn("flex items-center gap-4", className)}>
      <svg
        viewBox="0 0 48 48"
        className="size-12 shrink-0 -rotate-90"
        aria-hidden
      >
        <circle
          cx="24"
          cy="24"
          r={radius}
          fill="none"
          strokeWidth="4"
          className="stroke-surface-3"
        />
        <circle
          cx="24"
          cy="24"
          r={radius}
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          className="stroke-kohaku transition-[stroke-dashoffset] duration-(--duration-slow) ease-standard"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress)}
        />
      </svg>
      <div className="flex flex-col">
        <p className="font-display text-title-s font-bold tabular-nums">
          {sessionRated} rated
        </p>
        <p className="text-small text-muted-foreground tabular-nums">
          {next === null
            ? `${ratedTotal} ratings in total`
            : `${ratedTotal} of ${next} ratings`}
        </p>
      </div>
    </div>
  );
}

/**
 * A milestone: a short accent burst (≤ 600 ms, none under reduced motion) and
 * a one-line message that stays for a few seconds. Never blocks input.
 */
export function MilestoneBurst({
  message,
  onDone,
}: {
  message: string;
  onDone: () => void;
}) {
  useEffect(() => {
    const timer = window.setTimeout(onDone, 4000);
    return () => window.clearTimeout(timer);
  }, [onDone]);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-24 z-40 flex justify-center px-4">
      <div className="relative">
        <span
          aria-hidden
          className="absolute inset-0 m-auto size-4 animate-[milestone-burst_600ms_var(--ease-emphasized)_forwards] rounded-full bg-kohaku opacity-0 motion-reduce:hidden"
        />
        <p className="relative rounded-full bg-kohaku px-6 py-3 font-display text-title-s font-bold text-on-accent shadow-float">
          {message}
        </p>
      </div>
    </div>
  );
}

/** Nothing left (spec 05 #20). */
export function DeckEmpty({ sessionRated }: { sessionRated: number }) {
  return (
    <div className="mx-auto flex max-w-reading flex-col items-center gap-4 py-16 text-center">
      <h2 className="font-display text-title-l font-extrabold">
        You&apos;ve been through everything for now
      </h2>
      <p className="text-body text-muted-foreground">
        Titles you skipped or passed come back in 30 days.
        {sessionRated > 0
          ? ` You rated ${sessionRated} anime this session.`
          : ""}
      </p>
    </div>
  );
}
