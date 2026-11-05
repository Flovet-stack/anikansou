import type { MetadataRoute } from "next";

import { siteConfig } from "@/lib/seo/site";

/**
 * Static routes only. Each content type gets its own sitemap beside its route,
 * such as app/anime/sitemap.ts using generateSitemaps, listed in lib/seo/robots.ts.
 *
 * Only set lastModified from a real content date. Google ignores it when it is
 * inaccurate, and it ignores priority and changeFrequency entirely.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: siteConfig.url }];
}
