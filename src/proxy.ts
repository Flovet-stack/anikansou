import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // An allowlist of signed-in areas. Public pages stay out so crawler traffic
  // never runs this; they get per-user state from the browser client instead.
  matcher: ["/auth/:path*", "/settings/:path*"],
};
