import { randomUUID } from "node:crypto";

import { type Page, devices, expect, test } from "@playwright/test";
import { type SupabaseClient, createClient } from "@supabase/supabase-js";

// Spec 07: the Library. Each test signs up a fresh user. Most data is saved
// through the same tracking functions the app uses, signed in as that user,
// so "Show more" doesn't need 49 trips through the deck.

type Client = SupabaseClient;

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
    .fill(`lib_${suffix()}`);
  await page.getByRole("button", { name: "Save username" }).click();
  await expect(page).toHaveURL(/\/rate$/);
  return { email, password };
}

/** The same user, signed in through the API. */
async function apiAs(email: string, password: string): Promise<Client> {
  const client = createClient(
    process.env.TEST_SUPABASE_URL ?? "",
    process.env.TEST_SUPABASE_PUBLISHABLE_KEY ?? "",
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
}

/** The next `count` aired titles in this user's deck. */
async function deckIds(client: Client, count: number): Promise<number[]> {
  const ids: number[] = [];
  let after: number | null = null;
  while (ids.length < count) {
    const { data, error } = await client.rpc("deck_next", {
      ...(after === null ? {} : { p_after: after }),
      p_page_size: 20,
    });
    if (error) throw error;
    const rows = (data ?? []) as { anime_id: number; is_upcoming: boolean }[];
    if (rows.length === 0) break;
    for (const row of rows) {
      if (!row.is_upcoming && ids.length < count) ids.push(row.anime_id);
    }
    after = rows.at(-1)?.anime_id ?? null;
  }
  return ids;
}

/** Delays every server action (they POST with a Next-Action header). */
async function slowServerActions(page: Page, ms: number) {
  await page.route("**/*", async (route) => {
    const request = route.request();
    if (request.method() !== "POST" || !request.headers()["next-action"]) {
      return route.fallback();
    }
    await new Promise((resolve) => setTimeout(resolve, ms));
    await route.fallback();
  });
}

function shelfTab(page: Page, name: RegExp) {
  return page.getByRole("navigation", { name: "Shelves" }).getByRole("link", {
    name,
  });
}

function cards(page: Page) {
  return page.locator("main ul > li [data-card-id]");
}

test.describe("Library (mouse and keyboard)", () => {
  test.slow();

  test("deck ratings show up on the right shelves; sort, move, remove and undo", async ({
    page,
  }) => {
    await signUp(page);

    // Rate two titles and watchlist one in the deck (spec 05/06 controls).
    const title = page.locator("main section h2").first();
    const t1 = (await title.textContent())?.trim() ?? "";
    await page.getByRole("button", { name: "Mark watched" }).click();
    await page.getByRole("button", { name: "4.5 stars" }).click();
    await expect(
      page.getByRole("button", { name: "4.5 stars" }),
    ).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Next anime" }).click();
    await expect(title).not.toHaveText(t1);
    const t2 = (await title.textContent())?.trim() ?? "";
    await page.getByRole("button", { name: "Watchlist" }).click();
    await expect(
      page.getByRole("button", { name: "On watchlist" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Next anime" }).click();
    await expect(title).not.toHaveText(t2);
    const t3 = (await title.textContent())?.trim() ?? "";
    await page.getByRole("button", { name: "Mark watched" }).click();
    await page.getByRole("button", { name: "1.5 stars" }).click();
    await expect(
      page.getByRole("button", { name: "1.5 stars" }),
    ).toHaveAttribute("aria-pressed", "true");
    // The deck saves in order; let the rating land before leaving.
    await expect(page.getByText("Rated 1.5 stars").first()).toBeVisible();

    // Library is the second nav item.
    await page
      .getByRole("link", { name: "Library" })
      .filter({ visible: true })
      .click();
    await expect(page).toHaveURL(/\/library$/);
    await expect(
      page.getByRole("link", { name: "Library" }).filter({ visible: true }),
    ).toHaveAttribute("aria-current", "page");
    await expect(shelfTab(page, /^Watched, 2 titles$/)).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(shelfTab(page, /^Watchlist, 1 title$/)).toBeVisible();
    await expect(shelfTab(page, /^Liked, 0 titles$/)).toBeVisible();
    // Statuses with no titles stay hidden.
    await expect(shelfTab(page, /^Dropped/)).toHaveCount(0);
    await expect(cards(page)).toHaveCount(2);
    await expect(
      page.getByRole("button", { name: `${t1}, Watched, rated 4.5 stars` }),
    ).toBeVisible();

    // Sort by your rating: 4.5 stars first, and the choice goes in the URL.
    await page.getByLabel("Sort").selectOption("rating");
    await expect(page).toHaveURL(/sort=rating/);
    await expect(cards(page).first()).toHaveAccessibleName(
      `${t1}, Watched, rated 4.5 stars`,
    );
    await expect(cards(page).nth(1)).toHaveAccessibleName(
      `${t3}, Watched, rated 1.5 stars`,
    );

    // The sort is remembered for the next visit without ?sort=.
    await page.goto("/library");
    await expect(page).toHaveURL(/sort=rating/);

    // Move t3 to Dropped from the sheet: it dims, then leaves after its toast.
    await page
      .getByRole("button", { name: `${t3}, Watched, rated 1.5 stars` })
      .click();
    const sheet = page.getByRole("dialog");
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole("heading", { name: t3 })).toBeVisible();
    await sheet.getByRole("button", { name: "Dropped", exact: true }).click();
    await expect(
      page.getByText("Moved to Dropped, rating removed").first(),
    ).toBeVisible();
    // The stars need Watched (0015).
    await expect(sheet.getByRole("button", { name: "4 stars" })).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    // Focus goes back to the card.
    await expect(
      page.getByRole("button", { name: `${t3}, Dropped` }),
    ).toBeFocused();
    await expect(shelfTab(page, /^Watched, 1 title$/)).toBeVisible();
    await expect(shelfTab(page, /^Dropped, 1 title$/)).toBeVisible();
    await expect(cards(page)).toHaveCount(1, { timeout: 10_000 });
    await shelfTab(page, /^Dropped/).click();
    await expect(page).toHaveURL(/shelf=dropped/);
    await expect(
      page.getByRole("button", { name: `${t3}, Dropped` }),
    ).toBeVisible();

    // Remove t2 from the library, then undo.
    await shelfTab(page, /^Watchlist/).click();
    await page
      .getByRole("button", { name: `${t2}, on your watchlist` })
      .click();
    await page.getByRole("button", { name: "Remove from library" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(shelfTab(page, /^Watchlist, 0 titles$/)).toBeVisible();
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(
      page.getByText("Undone: removed from library").first(),
    ).toBeVisible();
    await expect(shelfTab(page, /^Watchlist, 1 title$/)).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("button", { name: `${t2}, on your watchlist` }),
    ).toBeVisible();
  });

  test("a rating made just before leaving the deck shows in the Library without a reload", async ({
    page,
  }) => {
    await signUp(page);
    const t1 =
      (await page.locator("main section h2").first().textContent())?.trim() ??
      "";
    // Slow the deck's saves down, so the Library is on screen before they
    // land: it must catch up, not keep showing the old state (spec 05 #15).
    await slowServerActions(page, 2500);
    await page.getByRole("button", { name: "Mark watched" }).click();
    await page.getByRole("button", { name: "4.5 stars" }).click();
    await page
      .getByRole("link", { name: "Library" })
      .filter({ visible: true })
      .click();
    await expect(page).toHaveURL(/\/library$/);
    await expect(shelfTab(page, /^Watched, 0 titles$/)).toBeVisible();
    await expect(shelfTab(page, /^Watched, 1 title$/)).toBeVisible({
      timeout: 20_000,
    });
    await expect(
      page.getByRole("button", { name: `${t1}, Watched, rated 4.5 stars` }),
    ).toBeVisible();
  });

  test("closing the tab while deck saves are unsent asks first, even from the Library", async ({
    page,
  }) => {
    await signUp(page);
    await slowServerActions(page, 4000);
    await page.getByRole("button", { name: "Mark watched" }).click();
    await page.getByRole("button", { name: "4.5 stars" }).click();
    await page
      .getByRole("link", { name: "Library" })
      .filter({ visible: true })
      .click();
    await expect(page).toHaveURL(/\/library$/);
    // The rating is still waiting behind Watched: closing would drop it.
    const dialog = page.waitForEvent("dialog");
    await page.close({ runBeforeUnload: true });
    const prompt = await dialog;
    expect(prompt.type()).toBe("beforeunload");
    await prompt.accept();
  });

  test("Show more loads the next 48 and moves focus to the first new card", async ({
    page,
  }) => {
    const { email, password } = await signUp(page);
    const client = await apiAs(email, password);
    const ids = await deckIds(client, 50);
    expect(ids).toHaveLength(50);
    for (const id of ids) {
      const { error } = await client.rpc("set_watchlist", {
        p_anime_id: id,
        p_on: true,
      });
      if (error) throw error;
    }

    await page.goto("/library?shelf=watchlist");
    await expect(shelfTab(page, /^Watchlist, 50 titles$/)).toBeVisible();
    await expect(cards(page)).toHaveCount(48);
    await page.getByRole("button", { name: "Show more" }).click();
    await expect(cards(page)).toHaveCount(50);
    await expect(cards(page).nth(48)).toBeFocused();
    await expect(page.getByRole("button", { name: "Show more" })).toHaveCount(
      0,
    );
  });

  test("a new user sees the empty state", async ({ page }) => {
    await signUp(page);
    await page.goto("/library");
    await expect(
      page.getByText(
        "Nothing here yet. Rate a few anime and they'll show up here.",
      ),
    ).toBeVisible();
    await page.getByRole("link", { name: "Start rating" }).click();
    await expect(page).toHaveURL(/\/rate$/);
  });

  test("signed-out visitors are sent to log in", async ({ page }) => {
    await page.goto("/library?shelf=liked");
    await expect(page).toHaveURL(/\/auth\/login\?next=%2Flibrary/);
  });
});

test.describe("Library on a phone (touch)", () => {
  const phone = devices["Pixel 7"];
  test.use({
    viewport: { width: 390, height: 844 },
    userAgent: phone.userAgent,
    deviceScaleFactor: phone.deviceScaleFactor,
    isMobile: phone.isMobile,
    hasTouch: phone.hasTouch,
  });
  test.slow();

  test("the ⋯ button opens a bottom sheet; a status change moves the title", async ({
    page,
  }) => {
    const { email, password } = await signUp(page);
    const client = await apiAs(email, password);
    const [id] = await deckIds(client, 1);
    if (!id) throw new Error("No anime in the deck");
    const { error } = await client.rpc("deck_seen", {
      p_anime_id: id,
      p_status: "watched",
      p_rating: 8,
    });
    if (error) throw error;

    await page.goto("/library");
    await expect(cards(page)).toHaveCount(1);
    // Touch: no hover bar, only ⋯.
    await expect(
      page.getByRole("group", { name: /^Quick actions/ }),
    ).toBeHidden();
    await page.getByRole("button", { name: /^More for / }).tap();
    const sheet = page.getByRole("dialog");
    await expect(sheet).toBeVisible();
    const box = await sheet.boundingBox();
    expect(box && box.y + box.height).toBeGreaterThan(800);
    await sheet.getByRole("button", { name: "Watching", exact: true }).tap();
    await expect(
      page.getByText("Moved to Watching, rating removed").first(),
    ).toBeVisible();
    await sheet.getByRole("button", { name: "Close" }).tap();
    await expect(shelfTab(page, /^Watching, 1 title$/)).toBeVisible();
    await expect(shelfTab(page, /^Watched, 0 titles$/)).toBeVisible();
    await expect(cards(page)).toHaveCount(0, { timeout: 10_000 });
    await expect(
      page.getByText("Nothing here yet.", { exact: false }),
    ).toBeVisible();
  });
});
