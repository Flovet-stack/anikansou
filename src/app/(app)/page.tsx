import Link from "next/link";
import type { WebSite, WithContext } from "schema-dts";

import { PosterCollage } from "@/components/poster/poster-collage";
import { buttonVariants } from "@/components/ui/button";
import { JsonLd } from "@/lib/seo/json-ld";
import { buildMetadata } from "@/lib/seo/metadata";
import { siteConfig } from "@/lib/seo/site";

export const metadata = buildMetadata({
  absoluteTitle: siteConfig.homeTitle,
  path: "/",
});

const websiteJsonLd: WithContext<WebSite> = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: siteConfig.name,
  description: siteConfig.description,
  url: siteConfig.url,
};

// Landing hero (design brief §11). The signed-in home comes with the deck.
export default function HomePage() {
  return (
    <>
      <JsonLd data={websiteJsonLd} />
      <section className="mx-auto grid w-full max-w-6xl items-center gap-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-20">
        <div className="flex flex-col gap-8">
          <p className="flex items-center gap-3 text-small font-semibold tracking-widest text-text-subtle uppercase">
            <span
              lang="ja"
              className="shrink-0 font-jp text-title-m tracking-normal whitespace-nowrap text-accent-text normal-case"
            >
              感想
            </span>
            kansou · thoughts after watching
          </p>
          <h1 className="font-display text-display-s font-extrabold tracking-tight md:text-display-l">
            {siteConfig.name}
          </h1>
          <p className="max-w-md text-title-s text-muted-foreground">
            Rate, track and remember every anime you watch.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Link
              href="/auth/sign-up"
              className={buttonVariants({ size: "lg" })}
            >
              Create account
            </Link>
            <Link
              href="/auth/login"
              className={buttonVariants({ variant: "secondary", size: "lg" })}
            >
              Log in
            </Link>
          </div>
        </div>
        <PosterCollage count={6} className="pb-8" />
      </section>
    </>
  );
}
