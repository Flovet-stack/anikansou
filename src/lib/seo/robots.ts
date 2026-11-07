import type { MetadataRoute } from "next";

/** Filtered, private and non-page URLs that should not use crawl budget. */
const DISALLOWED_PATHS = [
  "/search",
  "/api/",
  "/auth/",
  "/settings",
  "/rate",
  "/library",
];

/** Add one entry per sitemap as content types are added. */
const SITEMAP_PATHS = ["/sitemap.xml"];

export function buildRobots({
  isProduction,
  siteUrl,
}: {
  isProduction: boolean;
  siteUrl: string;
}): MetadataRoute.Robots {
  // Preview and local deployments must never be indexed.
  if (!isProduction) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

  return {
    rules: { userAgent: "*", allow: "/", disallow: DISALLOWED_PATHS },
    sitemap: SITEMAP_PATHS.map((path) => `${siteUrl}${path}`),
  };
}
