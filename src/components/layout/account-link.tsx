"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { buttonVariants } from "@/components/ui/button";
import { isSignedIn, onAuthChange } from "@/features/auth/queries.client";

/**
 * "Log in" or "Settings", read in the browser so layouts never touch cookies.
 * Re-checks on every navigation, because sign-in and sign-out happen in Server
 * Actions that the browser client doesn't hear about.
 */
export function AccountLink() {
  const pathname = usePathname();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    const check = () =>
      void isSignedIn().then((value) => {
        if (active) setSignedIn(value);
      });
    check();
    const unsubscribe = onAuthChange(check);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [pathname]);

  if (signedIn === null) {
    // Reserves the space so the header doesn't shift.
    return <span className="inline-block h-8 w-16" aria-hidden />;
  }

  return signedIn ? (
    <Link href="/settings" className={buttonVariants({ variant: "ghost" })}>
      Settings
    </Link>
  ) : (
    <Link href="/auth/login" className={buttonVariants({ variant: "ghost" })}>
      Log in
    </Link>
  );
}
