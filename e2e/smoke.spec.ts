import { expect, test } from "@playwright/test";

const siteUrl = "https://anikansou.test";

test("home page renders branding and SEO tags", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("AniKansou");
  await expect(page).toHaveTitle(
    "AniKansou: rate, track and remember every anime",
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    siteUrl,
  );
  await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute(
    "content",
    "AniKansou",
  );
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    "content",
    new RegExp(`^${siteUrl}/opengraph-image`),
  );

  const jsonLd = await page
    .locator('script[type="application/ld+json"]')
    .textContent();
  expect(JSON.parse(jsonLd ?? "{}")).toMatchObject({ "@type": "WebSite" });
});

test("metadata is in the initial HTML, not streamed in later", async ({
  request,
}) => {
  const html = await (await request.get("/")).text();
  const head = html.slice(0, html.indexOf("</head>"));

  expect(head).toContain(
    "<title>AniKansou: rate, track and remember every anime</title>",
  );
  expect(head).toContain('rel="canonical"');
});

test("without a token, nothing is sent to PostHog (spec 11)", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (/posthog/i.test(request.url())) requests.push(request.url());
  });

  await page.goto("/");
  await page.getByRole("link", { name: "Discover" }).first().click();
  await expect(page).toHaveURL(/\/discover$/);

  expect(requests).toEqual([]);
});

test("the site is always dark, with no theme toggle (decision 0012)", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  // A light system preference and a stored "light" choice both stay dark.
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  const html = page.locator("html");
  await expect(html).toHaveClass(/\bdark\b/);

  await page.evaluate(() => localStorage.setItem("theme", "light"));
  await page.reload();
  await expect(html).toHaveClass(/\bdark\b/);
  await expect(html).not.toHaveClass(/\blight\b/);

  await expect(
    page.getByRole("button", { name: /theme|dark mode/i }),
  ).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("unknown URLs return a real 404", async ({ request }) => {
  const response = await request.get("/this-page-does-not-exist");

  expect(response.status()).toBe(404);
});

test("proxied routes run the session refresh without erroring", async ({
  request,
}) => {
  // A signed-out visit to a proxied route gets a real HTTP redirect.
  const response = await request.get("/settings", { maxRedirects: 0 });

  expect(response.status()).toBe(307);
});

test("robots.txt blocks crawling outside production", async ({ request }) => {
  const body = await (await request.get("/robots.txt")).text();

  expect(body).toContain("Disallow: /");
});

test("sitemap.xml lists absolute URLs", async ({ request }) => {
  const response = await request.get("/sitemap.xml");

  expect(response.status()).toBe(200);
  const body = await response.text();
  expect(body).toContain(`<loc>${siteUrl}</loc>`);
  expect(body).toContain(`<loc>${siteUrl}/discover</loc>`);
});

test("default Open Graph image is served", async ({ request }) => {
  const response = await request.get("/opengraph-image");

  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("image/png");
});
