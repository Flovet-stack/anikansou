import Link from "next/link";

import { ThemeToggle } from "@/components/theme/theme-toggle";
import { siteConfig } from "@/lib/seo/site";

export function SiteHeader() {
  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4">
        <Link href="/" className="font-heading text-lg font-semibold">
          {siteConfig.name}
        </Link>
        {/* Navigation and the user menu go here. Keep the user menu a Client
            Component: layouts must not read cookies (see README). */}
        <ThemeToggle />
      </div>
    </header>
  );
}
