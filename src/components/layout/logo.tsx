import { cn } from "@/lib/utils";
import Link from "next/link";

import { siteConfig } from "@/lib/seo/site";

/**
 * The wordmark, linking home. `compact` shows only the 感 mark (icon rail).
 */
export function Logo({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  return (
    <Link
      href="/"
      aria-label={`${siteConfig.name}, home`}
      className={cn(
        "inline-flex min-h-11 items-center gap-2 rounded-full font-display text-title-s font-extrabold tracking-tight text-foreground",
        className,
      )}
    >
      <span
        aria-hidden
        className="flex size-9 items-center justify-center rounded-md bg-kohaku font-jp text-small font-bold text-on-accent"
      >
        感
      </span>
      {compact ? null : (
        <span aria-hidden>
          Ani<span className="text-accent-text">Kansou</span>
        </span>
      )}
    </Link>
  );
}
