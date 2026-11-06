import type { ReactNode } from "react";

import { AccountNav, TopBarAction } from "./account-link";
import { DataAttribution } from "./data-attribution";
import { Logo } from "./logo";
import { SkipLink } from "./skip-link";

/**
 * The app shell (decision 0002):
 * - under 768 px: a slim top bar, full-width content, a bottom tab bar;
 * - 768–1023 px: a 72 px icon rail;
 * - from 1024 px: a 240 px sidebar with labels.
 * The right rail (from 1280 px) renders only on pages that fill it; none do
 * yet. No section nav items exist until their features ship (spec 04, #10).
 *
 * Focus order is skip link → navigation → content at every width: the phone
 * tab bar comes before <main> in the DOM and is pinned to the bottom with CSS.
 *
 * Never reads cookies: the account entry checks the session in the browser.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <>
      <SkipLink />
      <div className="min-h-dvh md:grid md:grid-cols-[var(--spacing-rail)_minmax(0,1fr)] lg:grid-cols-[var(--spacing-sidebar)_minmax(0,1fr)]">
        {/* Phone top bar */}
        <header className="sticky top-0 z-30 flex h-topbar items-center justify-between bg-background/90 px-4 backdrop-blur md:hidden">
          <Logo />
          <TopBarAction />
        </header>

        {/* Phone bottom tab bar */}
        <nav
          aria-label="Main"
          className="fixed inset-x-0 bottom-0 z-30 flex h-[calc(var(--spacing-tabbar)+env(safe-area-inset-bottom))] items-start justify-center gap-2 border-t border-border/60 bg-background/95 px-4 pt-1 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
        >
          <AccountNav placement="tabbar" />
        </nav>

        {/* Rail (768–1023) and sidebar (1024+) */}
        <aside className="sticky top-0 hidden h-dvh flex-col justify-between border-r border-border/60 py-6 md:flex md:items-center lg:items-stretch lg:px-4">
          <div className="flex flex-col gap-8">
            <Logo compact className="lg:hidden" />
            <Logo className="hidden px-2 lg:inline-flex" />
          </div>
          <div className="flex flex-col gap-6">
            <nav
              aria-label="Main"
              className="flex flex-col items-center gap-1 lg:hidden"
            >
              <AccountNav placement="rail" />
            </nav>
            <nav aria-label="Main" className="hidden flex-col gap-1 lg:flex">
              <AccountNav placement="sidebar" />
            </nav>
            <DataAttribution className="hidden px-2 lg:block" />
          </div>
        </aside>

        <main
          id="content"
          tabIndex={-1}
          className="min-w-0 px-4 pt-8 pb-[calc(var(--spacing-tabbar)+var(--spacing)*8+env(safe-area-inset-bottom))] outline-none sm:px-6 md:px-10 md:pt-16 md:pb-24 lg:px-16"
        >
          {children}
        </main>
      </div>
    </>
  );
}
