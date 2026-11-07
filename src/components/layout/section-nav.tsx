"use client";

import { usePathname } from "next/navigation";

import { HugeiconsBookTextIcon } from "@/components/ui/hugeicons-book-text";
import { HugeiconsSearchIcon } from "@/components/ui/hugeicons-search";
import { HugeiconsStarIcon } from "@/components/ui/hugeicons-star";

import { NavItem, type NavItemPlacement } from "./nav-item";

/**
 * The product's sections (decision 0002). A section appears only once its
 * feature ships: Rate came with spec 05, Library with spec 07, Discover
 * with spec 09. Signed-out visitors see them too; the proxy sends them to log
 * in from Rate and Library (Discover is public).
 */
export function SectionNav({ placement }: { placement: NavItemPlacement }) {
  const pathname = usePathname();
  const isAt = (path: string) =>
    pathname === path || pathname.startsWith(`${path}/`);
  return (
    <>
      <NavItem
        placement={placement}
        href="/rate"
        label="Rate"
        icon={<HugeiconsStarIcon size={22} aria-hidden />}
        current={isAt("/rate")}
      />
      <NavItem
        placement={placement}
        href="/library"
        label="Library"
        icon={<HugeiconsBookTextIcon size={22} aria-hidden />}
        current={isAt("/library")}
      />
      <NavItem
        placement={placement}
        href="/discover"
        label="Discover"
        icon={<HugeiconsSearchIcon size={22} aria-hidden />}
        current={isAt("/discover")}
      />
    </>
  );
}
