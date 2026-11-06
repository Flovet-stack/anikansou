import { cn } from "@/lib/utils";
import Link from "next/link";
import type { ReactNode } from "react";

export type NavItemPlacement = "sidebar" | "rail" | "tabbar";

/**
 * One navigation entry, shaped for where it sits (decision 0002): icon and
 * label in the sidebar, icon with a tooltip in the rail, icon over a short
 * label in the phone tab bar. The current page is marked with
 * `aria-current="page"` and the accent colour.
 */
export function NavItem({
  placement,
  href,
  label,
  icon,
  current,
  emphasis = false,
}: {
  placement: NavItemPlacement;
  href: string;
  label: string;
  icon: ReactNode;
  current: boolean;
  /** Draws the item in the accent colour (e.g. "Create account" in the rail). */
  emphasis?: boolean;
}) {
  const state = current || emphasis;

  if (placement === "tabbar") {
    return (
      <Link
        href={href}
        aria-current={current ? "page" : undefined}
        className={cn(
          "flex min-h-14 min-w-16 flex-col items-center justify-center gap-1 rounded-md px-3 text-caption font-medium transition-[color,background-color,transform] duration-(--duration-hover-out) ease-in-out active:scale-[0.97] hover-fine:duration-(--duration-fast)",
          state ? "text-accent-text" : "text-text-subtle",
        )}
      >
        {icon}
        <span>{label}</span>
      </Link>
    );
  }

  if (placement === "rail") {
    return (
      <Link
        href={href}
        aria-label={label}
        aria-current={current ? "page" : undefined}
        className={cn(
          "group/nav relative flex size-12 items-center justify-center rounded-full transition-[color,background-color,transform] duration-(--duration-hover-out) ease-in-out active:scale-[0.97] hover-fine:bg-surface-2 hover-fine:duration-(--duration-fast)",
          state ? "text-accent-text" : "text-muted-foreground",
          current && "bg-surface-2",
        )}
      >
        {icon}
        {/* Tooltip (0007 §3): on hover and keyboard focus, after a short delay. */}
        <span
          aria-hidden
          className="pointer-events-none absolute left-full z-20 ml-3 rounded-sm bg-surface-3 px-2.5 py-1.5 text-small whitespace-nowrap text-foreground opacity-0 shadow-float transition-opacity delay-0 duration-(--duration-hover-out) group-hover/nav:opacity-100 group-hover/nav:delay-400 group-focus-visible/nav:opacity-100 group-focus-visible/nav:delay-400"
        >
          {label}
        </span>
      </Link>
    );
  }

  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={cn(
        "flex min-h-12 items-center gap-3 rounded-full px-4 text-body font-medium transition-[color,background-color,transform] duration-(--duration-hover-out) ease-in-out active:scale-[0.97] hover-fine:bg-surface-2 hover-fine:text-foreground hover-fine:duration-(--duration-fast)",
        current
          ? "bg-surface-2 text-foreground [&_svg]:text-accent-text"
          : "text-muted-foreground",
      )}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}
