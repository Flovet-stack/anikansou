import { type NextRequest, NextResponse } from "next/server";

import { exchangeAuthCode } from "@/features/auth/queries";
import { safeNext } from "@/features/auth/schemas";

/** Google sends users back here with a PKCE code to exchange for a session. */
export async function GET(request: NextRequest) {
  const { origin, searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const failed = new URL("/auth/login?error=google", origin);

  if (searchParams.has("error") || !code) {
    return NextResponse.redirect(failed);
  }

  if (!(await exchangeAuthCode(code))) {
    return NextResponse.redirect(failed);
  }

  // The proxy sends users without a username to the username step from here.
  const next = safeNext(searchParams.get("next"), origin);
  return NextResponse.redirect(new URL(next, origin));
}
