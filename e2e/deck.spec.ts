import { randomUUID } from "node:crypto";

import { type Page, devices, expect, test } from "@playwright/test";

// Spec 05: the swipe-to-rate deck. Each test signs up a fresh user, so the
// deck starts at the same best-known titles every time.

function suffix() {
  return randomUUID().replaceAll("-", "").slice(0, 10);
}

async function signUpToDeck(page: Page) {
  await page.goto("/auth/sign-up");
  await page
    .getByLabel("Email")
    .filter({ visible: true })
    .fill(`e2e-${suffix()}@anikansou.test`);
  await page
    .getByLabel("Password")
    .filter({ visible: true })
    .fill(`pw-${suffix()}`);
  await page
    .getByRole("button", { name: "Create account" })
    .filter({ visible: true })
    .click();
  await expect(page).toHaveURL(/\/auth\/username/);
  await page
    .getByLabel("Username")
    .filter({ visible: true })
    .fill(`deck_${suffix()}`);
  await page.getByRole("button", { name: "Save username" }).click();
  // New users land on the deck (0009, spec 05 #8).
  await expect(page).toHaveURL(/\/rate$/);
}

/** The current card's title. */
function title(page: Page) {
  return page.locator("main section h2").first();
}

async function titleText(page: Page): Promise<string> {
  await expect(title(page)).toBeVisible();
  return (await title(page).textContent())?.trim() ?? "";
}

test.describe("web model (mouse and keyboard)", () => {
  test.slow();

  test("watch and rate, un-watch, like, watchlist, pass, go back, undo, reload", async ({
    page,
  }) => {
    await signUpToDeck(page);
    await expect(
      page.getByRole("link", { name: "Rate" }).filter({ visible: true }),
    ).toHaveAttribute("aria-current", "page");

    const t1 = await titleText(page);
    // 0015: Watched is the deck's only status, and the stars need it.
    for (const name of ["Watching", "On hold", "Dropped"]) {
      await expect(page.getByRole("button", { name, exact: true })).toHaveCount(
        0,
      );
    }
    await expect(
      page.getByRole("button", { name: "4.5 stars" }),
    ).toBeDisabled();
    await expect(page.getByText("Mark it watched to rate it.")).toBeVisible();
    await page.getByRole("button", { name: "Mark watched" }).click();
    await expect(
      page.getByRole("button", { name: "Watched", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "4.5 stars" }).click();
    await expect(
      page.getByRole("button", { name: "4.5 stars" }),
    ).toHaveAttribute("aria-pressed", "true");

    // Un-watching removes the rating too, and one undo brings both back.
    await page.getByRole("button", { name: "Next anime" }).click();
    const t2 = await titleText(page);
    expect(t2).not.toBe(t1);
    await page.getByRole("button", { name: "Mark watched" }).click();
    await page.getByRole("button", { name: "2 stars" }).click();
    await expect(page.getByRole("button", { name: "2 stars" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await page.getByRole("button", { name: "Watched", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Mark watched" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "2 stars" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "2 stars" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    await page.keyboard.press("Control+z");
    await expect(
      page.getByRole("button", { name: "Watched", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: "2 stars" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await page.getByRole("button", { name: "Next anime" }).click();
    const t3 = await titleText(page);
    await page.getByRole("button", { name: "Like", exact: true }).click();
    await expect(page.getByRole("button", { name: "Liked" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await page.getByRole("button", { name: "Next anime" }).click();
    const t4 = await titleText(page);
    await page.getByRole("button", { name: "Watchlist", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "On watchlist" }),
    ).toHaveAttribute("aria-pressed", "true");

    // Move past one untouched (a "pass"), then come back and rate it.
    await page.getByRole("button", { name: "Next anime" }).click();
    const t5 = await titleText(page);
    await page.getByRole("button", { name: "Next anime" }).click();
    const t6 = await titleText(page);
    await page.getByRole("button", { name: "Previous anime" }).click();
    await expect(title(page)).toHaveText(t5);
    await page.getByRole("button", { name: "Mark watched" }).click();
    await page.getByRole("button", { name: "3 stars" }).click();
    await expect(page.getByRole("button", { name: "3 stars" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    // Earlier cards keep their saved state.
    for (let i = 0; i < 4; i++) {
      await page.getByRole("button", { name: "Previous anime" }).click();
    }
    await expect(title(page)).toHaveText(t1);
    await expect(
      page.getByRole("button", { name: "4.5 stars" }),
    ).toHaveAttribute("aria-pressed", "true");

    // Undo the last two changes (the rating, then Watched, on t5): back to
    // it, untouched.
    await page.keyboard.press("Control+z");
    await expect(title(page)).toHaveText(t5);
    await expect(page.getByRole("button", { name: "3 stars" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    await page.keyboard.press("Control+z");
    await expect(
      page.getByRole("button", { name: "Mark watched" }),
    ).toBeVisible();

    // Move past t6 untouched: that records a pass.
    await page.getByRole("button", { name: "Next anime" }).click();
    await expect(title(page)).toHaveText(t6);
    // Moving on saves the pass in the background: wait for it to land.
    const passSaved = page.waitForResponse(
      // Every server action posts to /rate; the pass is the one sent with
      // "passed" (the deck prefetch posts there too).
      (r) =>
        r.request().method() === "POST" &&
        r.url().endsWith("/rate") &&
        (r.request().postData() ?? "").includes('"passed"'),
    );
    await page.getByRole("button", { name: "Next anime" }).click();
    await expect(title(page)).not.toHaveText(t6);
    await passSaved;

    // After a reload: watched or watchlisted anime are gone, and so is the
    // passed one (t6); the liked-only one (t3) stays with its heart; t5 is
    // back (its pass was cleared by acting on it, then both actions undone).
    await page.reload();
    await expect(title(page)).toHaveText(t3);
    await expect(page.getByRole("button", { name: "Liked" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    const seen = [await titleText(page)];
    for (let i = 0; i < 3; i++) {
      await page.getByRole("button", { name: "Next anime" }).click();
      seen.push(await titleText(page));
    }
    expect(seen).toContain(t5);
    for (const gone of [t1, t2, t4, t6]) expect(seen).not.toContain(gone);
  });

  test("works with the keyboard only", async ({ page }) => {
    await signUpToDeck(page);
    await titleText(page);
    // Rating keys wait for Watched (0015) and say so.
    await page.keyboard.press("9");
    await expect(page.locator("[aria-live=polite]")).toContainText(
      "Mark it watched first",
    );
    // W then 9 straight away: when the Watched save lands, the rating that's
    // still saving must stay on screen (regression: it used to blink off).
    await page.keyboard.press("w");
    await page.keyboard.press("9"); // 4.5 stars
    await expect(page.getByText("Marked watched").first()).toBeVisible();
    expect(
      await page
        .getByRole("button", { name: "4.5 stars" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    await expect(
      page.getByRole("button", { name: "Watched", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("Rated 4.5 stars").first()).toBeVisible();
    await expect(
      page.getByRole("button", { name: "4.5 stars" }),
    ).toHaveAttribute("aria-pressed", "true");

    const t1 = await titleText(page);
    await page.keyboard.press("ArrowRight");
    await expect(title(page)).not.toHaveText(t1);
    await page.keyboard.press("w");
    await expect(
      page.getByRole("button", { name: "Watched", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");

    await page.keyboard.press("j");
    await page.keyboard.press("l");
    await expect(page.getByRole("button", { name: "Liked" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await page.keyboard.press("a");
    await expect(
      page.getByRole("button", { name: "On watchlist" }),
    ).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("Control+z");
    await expect(
      page.getByRole("button", { name: "Watchlist", exact: true }),
    ).toHaveAttribute("aria-pressed", "false");
    // The result is announced for screen readers.
    await expect(page.locator("[aria-live=polite]")).toContainText("Undone");

    // Move past one untouched, come back with the keyboard, rate it.
    await page.keyboard.press("ArrowRight");
    const passedTitle = await titleText(page);
    await page.keyboard.press("ArrowRight");
    await expect(title(page)).not.toHaveText(passedTitle);
    await page.keyboard.press("ArrowLeft");
    await expect(title(page)).toHaveText(passedTitle);
    await page.keyboard.press("w");
    await page.keyboard.press("6"); // 3 stars
    await expect(page.getByRole("button", { name: "3 stars" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});

test.describe("touch model", () => {
  // The phone's size and touch input, in the configured Chromium.
  const phone = devices["Pixel 7"];
  test.use({
    // Spec 05: 390 px.
    viewport: { width: 390, height: 844 },
    userAgent: phone.userAgent,
    deviceScaleFactor: phone.deviceScaleFactor,
    isMobile: phone.isMobile,
    hasTouch: phone.hasTouch,
  });
  test.slow();

  async function swipe(page: Page, dx: number, dy: number) {
    const card = page.locator("main section [data-slot=poster]").last();
    const box = await card.boundingBox();
    if (!box) throw new Error("No card to swipe");
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 12 });
    await page.mouse.up();
  }

  test("swipe right and rate, swipe left, swipe up, undo", async ({ page }) => {
    await signUpToDeck(page);
    const t1 = await titleText(page);
    await expect(page.getByRole("button", { name: "Seen it" })).toBeVisible();

    // Right: "Seen it", then one tap to rate and move on.
    await swipe(page, 260, 0);
    const step = page.getByRole("group", { name: `Rate ${t1}` });
    await expect(step).toBeVisible();
    // 0015: no status row; "Seen it" always means Watched.
    await expect(step.getByRole("group", { name: "Status" })).toHaveCount(0);
    await page.getByRole("button", { name: "4.5 stars" }).click();
    await expect(title(page)).not.toHaveText(t1);

    // Left: "Not seen".
    const t2 = await titleText(page);
    await swipe(page, -260, 0);
    await expect(title(page)).not.toHaveText(t2);

    // Up: "Want to watch".
    const t3 = await titleText(page);
    await swipe(page, 0, -320);
    await expect(title(page)).not.toHaveText(t3);

    // Undo brings the last card back.
    await page
      .getByRole("button", { name: "Undo" })
      .filter({ visible: true })
      .first()
      .click();
    await expect(title(page)).toHaveText(t3);

    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });

  test("every gesture has a button", async ({ page }) => {
    await signUpToDeck(page);
    const t1 = await titleText(page);
    await page.getByRole("button", { name: "Not seen" }).click();
    await expect(title(page)).not.toHaveText(t1);
    const t2 = await titleText(page);
    await page.getByRole("button", { name: "Want to watch" }).click();
    await expect(title(page)).not.toHaveText(t2);
    const t3 = await titleText(page);
    await page.getByRole("button", { name: "Seen it" }).click();
    await page.getByRole("button", { name: "Save without rating" }).click();
    await expect(title(page)).not.toHaveText(t3);
  });
});

// Spec 08: AniList covers, looked up by the server only.
test("shows AniList covers without the browser ever calling AniList's API", async ({
  page,
}) => {
  test.slow();
  const apiCalls: string[] = [];
  const errors: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).hostname === "graphql.anilist.co") {
      apiCalls.push(request.url());
    }
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await signUpToDeck(page);
  await expect(title(page)).toBeVisible();

  const covers = page.locator(
    '[data-testid="poster-image"][src^="https://s4.anilist.co/"]',
  );
  // A fresh user's deck opens on well-known titles, which AniList has covers
  // for. Where AniList can't be reached from the test machine, run with
  // E2E_ANILIST_UNREACHABLE=1 to check the generated poster instead: without
  // it, a missing cover fails the test rather than passing as a fallback.
  if (process.env.E2E_ANILIST_UNREACHABLE === "1") {
    await expect(page.getByTestId("poster-fallback").first()).toBeAttached();
  } else {
    await expect(covers.first()).toBeAttached({ timeout: 20_000 });
    await expect
      .poll(() =>
        covers.first().evaluate((img: HTMLImageElement) => img.naturalWidth),
      )
      .toBeGreaterThan(0);
  }

  // Covers load from AniList's image host only; the lookup stays on the server.
  expect(apiCalls).toEqual([]);
  expect(errors).toEqual([]);
});

test("signed-out visitors are sent to log in", async ({ request }) => {
  const response = await request.get("/rate", { maxRedirects: 0 });
  expect(response.status()).toBe(307);
  expect(response.headers().location).toMatch(/\/auth\/login\?next=%2Frate$/);
});
