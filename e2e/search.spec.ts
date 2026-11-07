import { randomUUID } from "node:crypto";

import { type Page, devices, expect, test } from "@playwright/test";

// Spec 09: title search on Discover, against the live catalog.

function suffix() {
  return randomUUID().replaceAll("-", "").slice(0, 10);
}

async function signUp(page: Page) {
  const email = `e2e-${suffix()}@anikansou.test`;
  const password = `pw-${suffix()}`;
  await page.goto("/auth/sign-up");
  await page.getByLabel("Email").filter({ visible: true }).fill(email);
  await page.getByLabel("Password").filter({ visible: true }).fill(password);
  await page
    .getByRole("button", { name: "Create account" })
    .filter({ visible: true })
    .click();
  await expect(page).toHaveURL(/\/auth\/username/);
  await page
    .getByLabel("Username")
    .filter({ visible: true })
    .fill(`srch_${suffix()}`);
  await page.getByRole("button", { name: "Save username" }).click();
  await expect(page).toHaveURL(/\/rate$/);
  return { email, password };
}

function field(page: Page) {
  return page.getByRole("searchbox", { name: "Search anime" });
}

function results(page: Page) {
  return page.getByRole("heading", { name: /results? for "/ });
}

/** Counts server-action calls (POSTs with a Next-Action header). */
function countServerActions(page: Page) {
  const calls = { n: 0 };
  page.on("request", (request) => {
    if (request.method() === "POST" && request.headers()["next-action"]) {
      calls.n += 1;
    }
  });
  return calls;
}

test.describe("Discover search (mouse and keyboard)", () => {
  test("signed out: search, open a title, log in and land back on the search", async ({
    page,
    context,
  }) => {
    const { email, password } = await signUp(page);
    await context.clearCookies();

    await page.goto("/discover");
    await expect(
      page.getByRole("link", { name: "Discover" }).first(),
    ).toHaveAttribute("aria-current", "page");
    await field(page).fill("frieren");
    await expect(results(page)).toBeVisible();
    await expect(page).toHaveURL(/\/discover\?q=frieren$/);
    // No quick actions for signed-out visitors.
    await expect(
      page.getByRole("group", { name: /^Quick actions/ }),
    ).toHaveCount(0);

    await page
      .getByRole("button", { name: "Sousou no Frieren", exact: true })
      .click();
    await expect(page).toHaveURL(/\/auth\/login\?next=/);
    await page.getByLabel("Email").filter({ visible: true }).fill(email);
    await page.getByLabel("Password").filter({ visible: true }).fill(password);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/discover\?q=frieren$/);
    await expect(field(page)).toHaveValue("frieren");
    await expect(
      page.getByRole("button", { name: "Sousou no Frieren", exact: true }),
    ).toBeVisible();
  });

  test("signed in: watchlist a result, then undo it", async ({ page }) => {
    await signUp(page);
    await page.goto("/discover?q=cowboy%20bebop");
    const title = page
      .getByRole("button", { name: /^Cowboy Bebop(,|$)/ })
      .first();
    await expect(title).toBeVisible();
    await title.hover();
    await page
      .getByRole("group", { name: "Quick actions for Cowboy Bebop" })
      .getByRole("button", { name: /watchlist/i })
      .click();
    await expect(
      page.getByRole("button", { name: "Cowboy Bebop, on your watchlist" }),
    ).toBeVisible();
    await page.getByRole("button", { name: /Undo/ }).click();
    await expect(
      page.getByRole("button", { name: "Cowboy Bebop", exact: true }),
    ).toBeVisible();
  });

  test("one character sends nothing; no results and Clear search; Japanese; reload", async ({
    page,
  }) => {
    await page.goto("/discover");
    const calls = countServerActions(page);
    await field(page).fill("f");
    await page.waitForTimeout(600);
    expect(calls.n).toBe(0);
    await expect(
      page.getByText(
        "Find any anime by its English, romaji or Japanese title.",
      ),
    ).toBeVisible();

    await field(page).fill("zzzzqqq");
    await expect(page.getByText("No anime match “zzzzqqq”.")).toBeVisible();
    await page.getByRole("button", { name: "Clear search" }).last().click();
    await expect(field(page)).toHaveValue("");
    await expect(page).toHaveURL(/\/discover$/);

    await field(page).fill("葬送");
    await expect(
      page.getByRole("button", { name: "Sousou no Frieren", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Also known as 葬送のフリーレン").first(),
    ).toBeVisible();

    await page.reload();
    await expect(field(page)).toHaveValue("葬送");
    await expect(
      page.getByRole("button", { name: "Sousou no Frieren", exact: true }),
    ).toBeVisible();
  });
});

test.describe("Discover search on a phone (touch)", () => {
  const phone = devices["Pixel 7"];
  test.use({
    viewport: { width: 390, height: 844 },
    userAgent: phone.userAgent,
    deviceScaleFactor: phone.deviceScaleFactor,
    isMobile: phone.isMobile,
    hasTouch: phone.hasTouch,
  });
  test.slow();

  test("results show; ⋯ opens the sheet and a watchlist save can be undone", async ({
    page,
  }) => {
    await signUp(page);
    await page.goto("/discover");
    await field(page).fill("bebop");
    await expect(results(page)).toBeVisible();
    await expect(
      page.getByRole("group", { name: /^Quick actions/ }).first(),
    ).toBeHidden();
    await page.getByRole("button", { name: "More for Cowboy Bebop" }).tap();
    const sheet = page.getByRole("dialog");
    await expect(sheet).toBeVisible();
    await sheet.getByRole("button", { name: /watchlist/i }).tap();
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("button", { name: "Cowboy Bebop, on your watchlist" }),
    ).toBeVisible();
    await page.getByRole("button", { name: /Undo/ }).tap();
    await expect(
      page.getByRole("button", { name: "Cowboy Bebop", exact: true }),
    ).toBeVisible();
  });
});
