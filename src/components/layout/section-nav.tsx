"use client";

import { usePathname } from "next/navigation";

import { HugeiconsStarIcon } from "@/components/ui/hugeicons-star";

import { NavItem, type NavItemPlacement } from "./nav-item";

/**
 * The product's sections (decision 0002). A section appears only once its
 * feature ships: Rate came with spec 05. Signed-out visitors see it too; the
 * proxy sends them to log in.
 */
export function SectionNav({ placement }: { placement: NavItemPlacement }) {
  const pathname = usePathname();
  return (
    <NavItem
      placement={placement}
      href="/rate"
      label="Rate"
      icon={<HugeiconsStarIcon size={22} aria-hidden />}
      current={pathname === "/rate" || pathname.startsWith("/rate/")}
    />
  );
}
