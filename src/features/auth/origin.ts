import "server-only";

import { headers } from "next/headers";

/**
 * The origin the current request was made to, for Server Actions. On Vercel the
 * host and protocol headers are set by Vercel's edge, so they can be trusted.
 * Route Handlers and the proxy use `request.nextUrl.origin` instead.
 */
export async function requestOrigin(): Promise<string> {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  if (!host) throw new Error("The request has no host header.");

  const forwardedProto = headerList.get("x-forwarded-proto")?.split(",")[0];
  const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host);
  const proto = forwardedProto ?? (isLocal ? "http" : "https");

  return `${proto}://${host}`;
}
