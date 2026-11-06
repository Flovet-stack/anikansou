import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

import { HugeiconsCheckIcon } from "@/components/ui/hugeicons-check";

const STEPS = ["Account", "Username"] as const;

/** "Account → Username" progress for sign-up (design brief §11). */
function StepIndicator({ step }: { step: 1 | 2 }) {
  return (
    <ol aria-label={`Step ${step} of 2`} className="flex items-center gap-3">
      {STEPS.map((label, index) => {
        const number = index + 1;
        const done = number < step;
        const current = number === step;
        return (
          <li
            key={label}
            aria-current={current ? "step" : undefined}
            className="flex items-center gap-3"
          >
            {index > 0 ? (
              <span
                aria-hidden
                className={cn(
                  "h-0.5 w-8 rounded-full",
                  done || current ? "bg-kohaku" : "bg-surface-3",
                )}
              />
            ) : null}
            <span
              className={cn(
                "flex items-center gap-2 text-small font-medium",
                current ? "text-foreground" : "text-muted-foreground",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "flex size-7 items-center justify-center rounded-full text-caption font-bold",
                  done && "bg-kohaku text-on-accent",
                  current && "bg-surface-3 text-accent-text ring-2 ring-kohaku",
                  !done && !current && "bg-surface-2 text-text-subtle",
                )}
              >
                {done ? <HugeiconsCheckIcon size={16} /> : number}
              </span>
              {label}
              {done ? <span className="sr-only"> (done)</span> : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function AuthShell({
  title,
  description,
  step,
  children,
}: {
  title: string;
  description: string;
  /** Shows the two-step sign-up progress when set. */
  step?: 1 | 2;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-4">
        {step ? <StepIndicator step={step} /> : null}
        <h1 className="font-display text-title-l font-extrabold tracking-tight md:text-display-s">
          {title}
        </h1>
        <p className="text-body text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  );
}

/** Same height as a form, so the page doesn't jump while it streams in. */
export function FormFallback() {
  return <div className="h-96" aria-hidden />;
}
