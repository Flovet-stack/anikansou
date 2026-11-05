import type { Metadata } from "next";

import { siteConfig } from "./site";

const defaultOpenGraph = {
  siteName: siteConfig.name,
  locale: siteConfig.locale,
  type: "website",
} as const;

/** Served by app/opengraph-image.tsx. */
const DEFAULT_OG_IMAGE = "/opengraph-image";

/**
 * Site-wide defaults for the root layout. Do not add a canonical here: every
 * child route would inherit it and point at the homepage.
 */
export const rootMetadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  applicationName: siteConfig.name,
  title: {
    default: siteConfig.name,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  openGraph: {
    ...defaultOpenGraph,
    title: siteConfig.name,
    description: siteConfig.description,
  },
  twitter: { card: "summary_large_image" },
};

type PageMetadataInput = {
  /** Omit to use the site name as the title. */
  title?: string;
  description?: string;
  /** Path of this page's own URL, such as `/anime/some-slug`. Becomes the canonical. */
  path: string;
  /** Absolute URLs. Defaults to the site's Open Graph image. */
  images?: string[];
};

/**
 * Metadata for a page. Use this rather than setting fields directly, because
 * Next.js merges metadata shallowly: a child `openGraph` replaces the parent's
 * object entirely, which would drop the site name, locale and default image.
 */
export function buildMetadata({
  title,
  description = siteConfig.description,
  path,
  images = [DEFAULT_OG_IMAGE],
}: PageMetadataInput): Metadata {
  return {
    ...(title ? { title } : {}),
    description,
    alternates: { canonical: path },
    openGraph: {
      ...defaultOpenGraph,
      title: title ?? siteConfig.name,
      description,
      url: path,
      images,
    },
  };
}
