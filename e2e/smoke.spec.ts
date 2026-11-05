import { expect, test } from "@playwright/test";

const siteUrl = "https://anikansou.test";

test("home page renders branding and SEO tags", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("AniKansou");
  await expect(page).toHaveTitle("AniKansou");
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

  expect(head).toContain("<title>AniKansou</title>");
  expect(head).toContain('rel="canonical"');
});

test("theme toggle switches and persists with no console errors", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");

  const html = page.locator("html");
  const toggle = page.getByRole("button", { name: "Toggle dark mode" });

  await expect(html).not.toHaveClass(/\bdark\b/);
  await toggle.click();
  await expect(html).toHaveClass(/\bdark\b/);

  await page.reload();
  await expect(html).toHaveClass(/\bdark\b/);

  await toggle.click();
  await expect(html).not.toHaveClass(/\bdark\b/);

  expect(errors).toEqual([]);
});

test("unknown URLs return a real 404", async ({ request }) => {
  const response = await request.get("/this-page-does-not-exist");

  expect(response.status()).toBe(404);
});

test("proxied routes run the session refresh without erroring", async ({
  request,
}) => {
  // No route exists here yet, so a 404 means the proxy ran and passed through.
  const response = await request.get("/settings");

  expect(response.status()).toBe(404);
});

test("robots.txt blocks crawling outside production", async ({ request }) => {
  const body = await (await request.get("/robots.txt")).text();

  expect(body).toContain("Disallow: /");
});

test("sitemap.xml lists absolute URLs", async ({ request }) => {
  const response = await request.get("/sitemap.xml");

  expect(response.status()).toBe(200);
  expect(await response.text()).toContain(`<loc>${siteUrl}</loc>`);
});

test("default Open Graph image is served", async ({ request }) => {
  const response = await request.get("/opengraph-image");

  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("image/png");
});
