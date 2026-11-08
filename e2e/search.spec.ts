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
  return page.getByRole("heading", { name: /^\d+\+? results?( for ".*")?$/ });
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
      .getByRole("group", {
        name: "Quick actions for Cowboy Bebop",
        exact: true,
      })
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
    await expect(
      page.getByText("No anime match “zzzzqqq”.").first(),
    ).toBeVisible();
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
    await page
      .getByRole("button", { name: "More for Cowboy Bebop", exact: true })
      .tap();
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

  test("signed out: no ⋯ button, and a tap goes to log in and back", async ({
    page,
    context,
  }) => {
    const { email, password } = await signUp(page);
    await context.clearCookies();
    await page.goto("/discover");
    await field(page).fill("frieren");
    await expect(results(page)).toBeVisible();
    await expect(page.getByRole("button", { name: /^More for / })).toHaveCount(
      0,
    );
    await page
      .getByRole("button", { name: "Sousou no Frieren", exact: true })
      .tap();
    await expect(page).toHaveURL(/\/auth\/login\?next=/);
    await page.getByLabel("Email").filter({ visible: true }).fill(email);
    await page.getByLabel("Password").filter({ visible: true }).fill(password);
    await page.getByRole("button", { name: "Log in" }).tap();
    await expect(page).toHaveURL(/\/discover\?q=frieren$/);
    await expect(field(page)).toHaveValue("frieren");
  });

  test("one character sends nothing; no results; Japanese; reload", async ({
    page,
  }) => {
    await page.goto("/discover");
    const calls = countServerActions(page);
    await field(page).fill("f");
    await page.waitForTimeout(600);
    expect(calls.n).toBe(0);

    await field(page).fill("zzzzqqq");
    await expect(
      page.getByText("No anime match “zzzzqqq”.").first(),
    ).toBeVisible();
    await page.getByRole("button", { name: "Clear search" }).last().tap();
    await expect(field(page)).toHaveValue("");

    await field(page).fill("葬送");
    await expect(
      page.getByRole("button", { name: "Sousou no Frieren", exact: true }),
    ).toBeVisible();
    await page.reload();
    await expect(field(page)).toHaveValue("葬送");
  });
});

test.describe("Discover filters (mouse and keyboard)", () => {
  test("genre and year narrow results, survive a reload, and chips widen them again", async ({
    page,
  }) => {
    await page.goto("/discover");
    await page.getByRole("button", { name: "Genre" }).click();
    await page.getByRole("menuitemcheckbox", { name: "Josei" }).click();
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/genre=josei/);
    await expect(results(page)).toBeVisible();

    const wide = await results(page).innerText();

    await page.getByRole("button", { name: "Year" }).click();
    await page.getByRole("menuitemradio", { name: "2023" }).click();
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/genre=josei&year=2023/);
    await expect(results(page)).not.toHaveText(wide);
    const narrowed = await results(page).innerText();

    await page.reload();
    await expect(results(page)).toHaveText(narrowed);
    await expect(
      page.getByRole("button", { name: "Remove filter: 2023" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Remove filter: 2023" }).click();
    await expect(page).toHaveURL(/genre=josei$/);
    await expect(results(page)).not.toHaveText(narrowed);
  });

  test("an impossible combination shows no results, and Clear filters recovers", async ({
    page,
  }) => {
    await page.goto(
      "/discover?q=cowboy%20bebop&type=special&genre=josei&year=1990s&status=upcoming",
    );
    await expect(
      page.getByText("No anime match these filters.").first(),
    ).toBeVisible();
    await page.getByRole("button", { name: "Clear filters" }).last().click();
    await expect(page).toHaveURL(/\/discover\?q=cowboy%20bebop$/);
    await expect(field(page)).toHaveValue("cowboy bebop");
    await expect(
      page.getByRole("button", { name: "Cowboy Bebop", exact: true }),
    ).toBeVisible();
  });

  test("a query plus a filter; signed in, watchlist a filtered result and undo", async ({
    page,
  }) => {
    await signUp(page);
    await page.goto("/discover?q=cowboy%20bebop&type=tv");
    const title = page
      .getByRole("button", { name: /^Cowboy Bebop(,|$)/ })
      .first();
    await expect(title).toBeVisible();
    await title.hover();
    await page
      .getByRole("group", {
        name: "Quick actions for Cowboy Bebop",
        exact: true,
      })
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

  test("Season waits for a single year, and the sort lands in the URL", async ({
    page,
  }) => {
    await page.goto("/discover?year=2023&type=tv");
    await expect(results(page)).toBeVisible();
    await page.getByRole("button", { name: /^More filters/ }).click();
    await page.getByRole("menuitemradio", { name: "Fall" }).click();
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/year=2023&season=fall/);

    await page.getByRole("button", { name: /^Year/ }).click();
    await page.getByRole("menuitemradio", { name: "1990s" }).click();
    await page.keyboard.press("Escape");
    await expect(page).not.toHaveURL(/season=/);
    await expect(page).toHaveURL(/year=1990s/);

    await page.getByLabel("Sort").selectOption("oldest");
    await expect(page).toHaveURL(/sort=oldest/);
  });

  test("signed out: filters survive the log-in round trip", async ({
    page,
    context,
  }) => {
    const { email, password } = await signUp(page);
    await context.clearCookies();
    await page.goto("/discover?type=tv&year=2023&season=fall");
    const first = page.getByRole("list").locator("[data-card-id]").first();
    await expect(first).toBeVisible();
    await first.click();
    await expect(page).toHaveURL(/\/auth\/login\?next=/);
    await page.getByLabel("Email").filter({ visible: true }).fill(email);
    await page.getByLabel("Password").filter({ visible: true }).fill(password);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/discover\?type=tv&year=2023&season=fall$/);
    await expect(
      page.getByRole("button", { name: "Remove filter: Fall" }),
    ).toBeVisible();
  });

  test("filter pages aren't indexed; plain Discover keeps its normal robots", async ({
    page,
  }) => {
    await page.goto("/discover?type=tv");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      /noindex/,
    );
    await page.goto("/discover");
    await expect(
      page.locator('meta[name="robots"][content*="noindex"]'),
    ).toHaveCount(0);
  });
});

test.describe("Discover filters on a phone (touch)", () => {
  const phone = devices["Pixel 7"];
  test.use({
    viewport: { width: 390, height: 844 },
    userAgent: phone.userAgent,
    deviceScaleFactor: phone.deviceScaleFactor,
    isMobile: phone.isMobile,
    hasTouch: phone.hasTouch,
  });
  test.slow();

  test("the sheet applies only on Show results; a chip widens results; reload keeps them", async ({
    page,
  }) => {
    await page.goto("/discover");
    await page.getByRole("button", { name: /^Filters/ }).tap();
    const sheet = page.getByRole("dialog");
    await sheet.getByRole("button", { name: "Comedy" }).tap();
    await expect(page).toHaveURL(/\/discover$/);
    await sheet.getByRole("button", { name: "2023" }).tap();
    await sheet.getByRole("button", { name: "Show results" }).tap();
    await expect(page).toHaveURL(/genre=comedy&year=2023/);
    await expect(results(page)).toBeVisible();
    await expect(page.getByRole("button", { name: /^Filters/ })).toContainText(
      "2",
    );

    await page.reload();
    await expect(
      page.getByRole("button", { name: "Remove filter: Comedy" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Remove filter: 2023" }).tap();
    await expect(page).toHaveURL(/genre=comedy$/);
  });

  test("closing the sheet discards changes; no results recovers", async ({
    page,
  }) => {
    await page.goto("/discover");
    await page.getByRole("button", { name: /^Filters/ }).tap();
    const sheet = page.getByRole("dialog");
    await sheet.getByRole("button", { name: "Comedy" }).tap();
    await sheet.getByRole("button", { name: "Close filters" }).tap();
    await expect(sheet).toBeHidden();
    await expect(page).toHaveURL(/\/discover$/);
    await expect(
      page.getByRole("button", { name: "Remove filter: Comedy" }),
    ).toHaveCount(0);

    await page.goto("/discover?q=cowboy%20bebop&type=special&genre=josei");
    await expect(
      page.getByText("No anime match these filters.").first(),
    ).toBeVisible();
    await page.getByRole("button", { name: "Clear filters" }).last().tap();
    await expect(page).toHaveURL(/\/discover\?q=cowboy%20bebop$/);
    await expect(
      page
        .getByRole("button", { name: "More for Cowboy Bebop", exact: true })
        .or(page.getByRole("button", { name: "Cowboy Bebop", exact: true }))
        .first(),
    ).toBeVisible();
  });

  test("signed in: a query plus a filter, watchlist a result and undo", async ({
    page,
  }) => {
    await signUp(page);
    await page.goto("/discover?q=cowboy%20bebop&type=tv");
    await page
      .getByRole("button", { name: "More for Cowboy Bebop", exact: true })
      .tap();
    const sheet = page.getByRole("dialog");
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

  test("removing a chip widens results", async ({ page }) => {
    await page.goto("/discover?genre=josei&year=2023");
    await expect(results(page)).toBeVisible();
    const narrow = await results(page).innerText();
    await page.getByRole("button", { name: "Remove filter: 2023" }).tap();
    await expect(results(page)).not.toHaveText(narrow);
  });
});
