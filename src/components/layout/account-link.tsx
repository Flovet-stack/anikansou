"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { buttonVariants } from "@/components/ui/button";
import { HugeiconsLogInIcon } from "@/components/ui/hugeicons-log-in";
import { HugeiconsSettingsIcon } from "@/components/ui/hugeicons-settings";
import { HugeiconsUserPlusIcon } from "@/components/ui/hugeicons-user-plus";
import { isSignedIn, onAuthChange } from "@/features/auth/queries.client";

import { NavItem, type NavItemPlacement } from "./nav-item";

/**
 * Reads the session in the browser, so layouts never touch cookies. Re-checks
 * on every navigation, because sign-in and sign-out happen in Server Actions
 * that the browser client doesn't hear about.
 */
function useSignedIn(): boolean | null {
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

  return signedIn;
}

/**
 * The account entry in the sidebar, the icon rail and the phone tab bar
 * (decision 0002): "Log in" plus a primary "Create account" when signed out,
 * "Settings" when signed in.
 */
export function AccountNav({ placement }: { placement: NavItemPlacement }) {
  const pathname = usePathname();
  const signedIn = useSignedIn();

  if (signedIn === null) {
    return (
      <>
        {/* Without JavaScript the session can't be read: offer Log in. */}
        <noscript>
          <NavItem
            placement={placement}
            href="/auth/login"
            label="Log in"
            icon={<HugeiconsLogInIcon size={22} aria-hidden />}
            current={false}
          />
        </noscript>
        {/* Reserves the space so the shell doesn't shift while it loads. */}
        <div className="min-h-11" aria-hidden />
      </>
    );
  }

  if (signedIn) {
    return (
      <NavItem
        placement={placement}
        href="/settings"
        label="Settings"
        icon={<HugeiconsSettingsIcon size={22} aria-hidden />}
        current={pathname === "/settings"}
      />
    );
  }

  return (
    <>
      <NavItem
        placement={placement}
        href="/auth/login"
        label="Log in"
        icon={<HugeiconsLogInIcon size={22} aria-hidden />}
        current={pathname === "/auth/login"}
      />
      {placement === "sidebar" ? (
        <Link
          href="/auth/sign-up"
          className={cn(buttonVariants({ size: "sm" }), "mt-2 w-full")}
        >
          Create account
        </Link>
      ) : placement === "rail" ? (
        <NavItem
          placement="rail"
          href="/auth/sign-up"
          label="Create account"
          icon={<HugeiconsUserPlusIcon size={22} aria-hidden />}
          current={false}
          emphasis
        />
      ) : null}
    </>
  );
}

/** The phone top bar's single action: "Create account" when signed out. */
export function TopBarAction() {
  const signedIn = useSignedIn();
  if (signedIn !== false) return null;
  return (
    <Link href="/auth/sign-up" className={buttonVariants({ size: "sm" })}>
      Create account
    </Link>
  );
}
