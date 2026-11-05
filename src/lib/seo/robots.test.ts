import { describe, expect, it } from "vitest";

import { buildRobots } from "./robots";

const siteUrl = "https://anikansou.com";

describe("buildRobots", () => {
  it("blocks all crawling outside production", () => {
    expect(buildRobots({ isProduction: false, siteUrl })).toEqual({
      rules: { userAgent: "*", disallow: "/" },
    });
  });

  it("allows crawling and lists absolute sitemap URLs in production", () => {
    const robots = buildRobots({ isProduction: true, siteUrl });

    expect(robots.rules).toMatchObject({ userAgent: "*", allow: "/" });
    expect(robots.sitemap).toEqual(["https://anikansou.com/sitemap.xml"]);
  });
});
