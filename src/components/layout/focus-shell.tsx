import type { ReactNode } from "react";

import { PosterCollage } from "@/components/poster/poster-collage";

import { Logo } from "./logo";
import { SkipLink } from "./skip-link";

/**
 * The focused layout for auth and onboarding (decision 0002): no navigation.
 * From 1024 px the form sits left and a poster collage fills the right half;
 * below that it's a single column and the collage is hidden, so it never
 * pushes the form down.
 */
export function FocusShell({ children }: { children: ReactNode }) {
  return (
    <>
      <SkipLink />
      <div className="grid min-h-dvh lg:grid-cols-2">
        <div className="flex flex-col px-4 py-6 sm:px-8 lg:px-16">
          <header>
            <Logo />
          </header>
          <main
            id="content"
            tabIndex={-1}
            className="flex flex-1 flex-col justify-center py-12 outline-none md:py-16"
          >
            <div className="mx-auto w-full max-w-md">{children}</div>
          </main>
        </div>
        <div
          aria-hidden
          className="relative hidden overflow-hidden bg-surface-1 lg:block"
        >
          <PosterCollage
            count={8}
            className="absolute inset-x-12 -top-8 -rotate-3 opacity-90"
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,var(--surface-1)_0%,transparent_30%,transparent_70%,var(--bg)_100%)]" />
        </div>
      </div>
    </>
  );
}
