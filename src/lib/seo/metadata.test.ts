import { describe, expect, it } from "vitest";

import { buildMetadata, rootMetadata } from "./metadata";

describe("rootMetadata", () => {
  it("has no canonical for child routes to inherit", () => {
    expect(rootMetadata.alternates).toBeUndefined();
  });
});

describe("buildMetadata", () => {
  it("sets a canonical from the page's own path", () => {
    const metadata = buildMetadata({ title: "Test", path: "/anime/test" });

    expect(metadata.alternates?.canonical).toBe("/anime/test");
  });

  it("keeps the shared Open Graph fields a shallow merge would drop", () => {
    const metadata = buildMetadata({ title: "Test", path: "/anime/test" });

    expect(metadata.openGraph).toMatchObject({
      siteName: "AniKansou",
      title: "Test",
      url: "/anime/test",
      images: ["/opengraph-image"],
    });
  });

  it("lets a page replace the default image", () => {
    const images = ["https://cdn.example.com/cover.jpg"];
    const metadata = buildMetadata({ path: "/anime/test", images });

    expect(metadata.openGraph?.images).toEqual(images);
  });
});
