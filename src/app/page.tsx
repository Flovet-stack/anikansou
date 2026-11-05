import type { WebSite, WithContext } from "schema-dts";

import { JsonLd } from "@/lib/seo/json-ld";
import { buildMetadata } from "@/lib/seo/metadata";
import { siteConfig } from "@/lib/seo/site";

export const metadata = buildMetadata({ path: "/" });

const websiteJsonLd: WithContext<WebSite> = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: siteConfig.name,
  description: siteConfig.description,
  url: siteConfig.url,
};

export default function HomePage() {
  return (
    <>
      <JsonLd data={websiteJsonLd} />
      <h1 className="font-heading text-4xl font-semibold tracking-tight">
        {siteConfig.name}
      </h1>
      <p className="mt-3 text-lg text-muted-foreground">{siteConfig.tagline}</p>
    </>
  );
}
