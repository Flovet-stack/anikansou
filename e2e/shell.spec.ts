import { randomUUID } from "node:crypto";

import { type Page, expect, test } from "@playwright/test";

// Decision 0002: the shell changes with the width. Only one "Main" navigation
// is visible at a time.
function mainNav(page: Page) {
  return page
    .getByRole("navigation", { name: "Main" })
    .filter({ visible: true });
}

test.describe("app shell at each breakpoint (signed out)", () => {
  test("360 px: top bar and bottom tab bar", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto("/");

    await expect(mainNav(page)).toHaveCount(1);
    const nav = mainNav(page);
    await expect(nav.getByRole("link", { name: "Log in" })).toBeVisible();
    // The bottom bar is pinned to the bottom of the screen.
    const box = await nav.boundingBox();
    expect(box && box.y + box.height).toBeGreaterThanOrEqual(770);
    await expect(
      page.locator("header").getByRole("link", { name: "Create account" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });

  test("768 px: icon rail", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto("/");

    const nav = mainNav(page);
    await expect(nav).toHaveCount(1);
    const box = await nav.boundingBox();
    expect(box?.x).toBeLessThan(72);
    await expect(nav.getByRole("link", { name: "Log in" })).toBeVisible();
    await expect(
      nav.getByRole("link", { name: "Create account" }),
    ).toBeVisible();
  });

  for (const width of [1024, 1440]) {
    test(`${width} px: labelled sidebar with the data credit`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");

      const nav = mainNav(page);
      await expect(nav).toHaveCount(1);
      await expect(nav.getByText("Log in")).toBeVisible();
      await expect(
        nav.getByRole("link", { name: "Create account" }),
      ).toBeVisible();
      await expect(
        page.getByText("Anime data from", { exact: false }),
      ).toBeVisible();
      // No page fills the right rail yet, so it doesn't render.
      await expect(page.locator("[data-slot=right-rail]")).toHaveCount(0);
    });
  }
});

test("the skip link is the first stop and moves focus to the content", async ({
  page,
}) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to content" });
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.locator("#content")).toBeFocused();
});

test("on phones, focus reaches the navigation before the content", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/");
  // Walk the tab order and note where each stop sits.
  const stops: string[] = [];
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press("Tab");
    stops.push(
      await page.evaluate(() => {
        const el = document.activeElement;
        if (!el) return "none";
        if (el.closest("nav")) return "nav";
        if (el.closest("main")) return "main";
        return "other";
      }),
    );
  }
  const firstNav = stops.indexOf("nav");
  const firstMain = stops.indexOf("main");
  expect(firstNav).toBeGreaterThan(-1);
  expect(firstMain === -1 || firstNav < firstMain).toBe(true);
});

test("auth pages use the focused layout without navigation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/auth/sign-up");
  await expect(page.getByRole("navigation", { name: "Main" })).toHaveCount(0);
  await expect(page.getByRole("list", { name: "Step 1 of 2" })).toBeVisible();
});

// Screenshots for the PR (spec 04 #22): every page at 390 and 1440 px.
test("page screenshots", async ({ page }, testInfo) => {
  test.slow();
  const shoot = async (name: string) => {
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      await page.waitForTimeout(150);
      await page.screenshot({
        path: testInfo.outputPath(`${name}-${width}.png`),
        fullPage: true,
      });
    }
  };

  await page.goto("/");
  await shoot("home");
  await page.goto("/this-page-does-not-exist");
  await shoot("not-found");
  await page.goto("/auth/login");
  await shoot("log-in");
  await page.goto("/auth/sign-up");
  await shoot("sign-up");

  const suffix = randomUUID().replaceAll("-", "").slice(0, 10);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page
    .getByLabel("Email")
    .filter({ visible: true })
    .fill(`e2e-${suffix}@anikansou.test`);
  await page
    .getByLabel("Password")
    .filter({ visible: true })
    .fill(`pw-${suffix}`);
  await page
    .getByRole("button", { name: "Create account" })
    .filter({ visible: true })
    .click();
  await expect(page).toHaveURL(/\/auth\/username/);
  await page
    .getByLabel("Username")
    .filter({ visible: true })
    .fill(`shot_${suffix}`);
  await shoot("username");
  await page.getByRole("button", { name: "Save username" }).click();
  // New users land on the deck (spec 05).
  await expect(page).toHaveURL(/\/rate$/);
  await expect(page.locator("main section h2").first()).toBeVisible();
  await shoot("rate");
  await page.goto("/settings");
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
  await shoot("settings");
});
