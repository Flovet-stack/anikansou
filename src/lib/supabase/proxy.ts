import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { env } from "@/env";
import { DEFAULT_NEXT, safeNext } from "@/features/auth/schemas";
import type { Database } from "@/types/database.types";

type Supabase = ReturnType<typeof createServerClient<Database>>;

/**
 * Refreshes the auth session, writes the new cookies to the response, and
 * applies the signed-in redirects from spec 02. Redirects happen here, rather
 * than in pages, so they are real HTTP redirects.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          // Stops CDNs from caching a response that carries a session token.
          Object.entries(headers).forEach(([key, value]) =>
            response.headers.set(key, value),
          );
        },
      },
    },
  );

  // Do not add code between client creation and this call.
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub ?? null;

  const target = await redirectTarget(request, supabase, userId);
  if (!target) return response;

  const redirect = NextResponse.redirect(
    new URL(target, request.nextUrl.origin),
  );
  // Keep any refreshed session cookies and no-cache headers.
  response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  response.headers.forEach((value, key) => {
    if (
      key.toLowerCase() === "cache-control" ||
      key.toLowerCase() === "expires"
    ) {
      redirect.headers.set(key, value);
    }
  });
  return redirect;
}

function withNext(path: string, next: string): string {
  return `${path}?${new URLSearchParams({ next }).toString()}`;
}

async function hasUsername(supabase: Supabase, userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", userId)
    .maybeSingle();
  return Boolean(data?.username);
}

/** Pages that need an account and a username: settings and the deck. */
function isSignedInArea(pathname: string): boolean {
  return ["/settings", "/rate"].some(
    (area) => pathname === area || pathname.startsWith(`${area}/`),
  );
}

/**
 * The redirect table in specs/02-accounts.md ("Proxy rules"), with /rate added
 * and the default destination changed to the deck by spec 05.
 */
async function redirectTarget(
  request: NextRequest,
  supabase: Supabase,
  userId: string | null,
): Promise<string | null> {
  const { pathname, search } = request.nextUrl;
  const here = `${pathname}${search}`;

  if (pathname === "/auth/callback") return null;

  if (isSignedInArea(pathname)) {
    if (!userId) return withNext("/auth/login", here);
    if (!(await hasUsername(supabase, userId))) {
      return withNext("/auth/username", here);
    }
    return null;
  }

  if (pathname === "/auth/login" || pathname === "/auth/sign-up") {
    if (!userId) return null;
    const next = safeNext(
      request.nextUrl.searchParams.get("next"),
      request.nextUrl.origin,
    );
    if (!(await hasUsername(supabase, userId))) {
      return withNext("/auth/username", next);
    }
    // Spec 05: the deck by default; an explicit safe `next` still wins.
    return next;
  }

  if (pathname === "/auth/username") {
    if (!userId) return withNext("/auth/login", pathname);
    if (await hasUsername(supabase, userId)) return DEFAULT_NEXT;
    return null;
  }

  return null;
}
