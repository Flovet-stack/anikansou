import { env } from "@/env";

export const siteConfig = {
  name: "AniKansou",
  tagline: "Thoughts after watching",
  homeTitle: "AniKansou: rate, track and remember every anime",
  /** Search Console's HTML tag token for the production URL. Not a secret. */
  googleSiteVerification: "Y11NUKVp4G8Zg070Ewmt2InDGLAuoTvgXSNonO1CVL0",
  description:
    "Log, rate, review and list the anime you watch. Kansou (感想) means thoughts after watching.",
  url: env.NEXT_PUBLIC_SITE_URL,
  locale: "en_US",
} as const;
