import type { MetadataRoute } from "next";

import { env } from "@/env";
import { buildRobots } from "@/lib/seo/robots";
import { siteConfig } from "@/lib/seo/site";

export default function robots(): MetadataRoute.Robots {
  return buildRobots({
    isProduction: env.VERCEL_ENV === "production",
    siteUrl: siteConfig.url,
  });
}
