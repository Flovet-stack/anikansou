import { env } from "@/env";

export const siteConfig = {
  name: "AniKansou",
  tagline: "Thoughts after watching",
  description:
    "Log, rate, review and list the anime you watch. Kansou (感想) means thoughts after watching.",
  url: env.NEXT_PUBLIC_SITE_URL,
  locale: "en_US",
} as const;
