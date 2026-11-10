import { expect, it } from "vitest";

import sitemap from "./sitemap";

it("lists the homepage and plain Discover, with no filtered URLs", () => {
  expect(sitemap().map((entry) => entry.url)).toEqual([
    "https://anikansou.test",
    "https://anikansou.test/discover",
  ]);
});
