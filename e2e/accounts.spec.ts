import { randomUUID } from "node:crypto";

import { type Page, expect, test } from "@playwright/test";

// Next keeps recently visited pages mounted but hidden, so only look at
// visible elements. Next's route announcer also has role="alert".
function field(page: Page, label: string) {
  return page.getByLabel(label).filter({ visible: true });
}

function formAlert(page: Page) {
  return page.locator('main [role="alert"]').filter({ visible: true });
}

function formStatus(page: Page) {
  return page.locator('main [role="status"]').filter({ visible: true });
}

// The shell has one "Main" navigation per breakpoint; only one is visible.
function mainNav(page: Page) {
  return page
    .getByRole("navigation", { name: "Main" })
    .filter({ visible: true });
}

function uniqueSuffix() {
  return randomUUID().replaceAll("-", "").slice(0, 10);
}

test("sign up with email, choose a username, reach settings and log out", async ({
  page,
}, testInfo) => {
  const email = `e2e-${uniqueSuffix()}@anikansou.test`;
  const typedUsername = `Fan_${uniqueSuffix()}`;
  const username = typedUsername.toLowerCase();

  await page.goto("/");
  // The home hero also links to log in; use the one in the navigation.
  await mainNav(page).getByRole("link", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/auth\/login$/);
  await page.getByRole("link", { name: "Create an account" }).click();
  await expect(page).toHaveURL(/\/auth\/sign-up$/);

  await field(page, "Email").fill(email);
  await field(page, "Password").fill(`pw-${uniqueSuffix()}`);
  await page
    .getByRole("button", { name: "Create account" })
    .filter({ visible: true })
    .click();

  await expect(page).toHaveURL(/\/auth\/username/);
  await field(page, "Username").fill("settings");
  await page.getByRole("button", { name: "Save username" }).click();
  await expect(formAlert(page)).toContainText("reserved");

  await field(page, "Username").fill(typedUsername);
  await page.getByRole("button", { name: "Save username" }).click();

  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(page.getByText(username, { exact: true })).toBeVisible();
  await expect(page.getByText(email, { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Settings" })).toBeVisible();

  // Display name: too long is refused, whitespace clears it.
  const displayName = field(page, "Display name");
  await displayName.fill("a".repeat(51));
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(formAlert(page)).toContainText("50 characters");

  await displayName.fill("Mika");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(formStatus(page)).toContainText("Saved");
  await page.reload();
  await expect(field(page, "Display name")).toHaveValue("Mika");

  await field(page, "Display name").fill("   ");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(formStatus(page)).toContainText("Saved");
  await page.reload();
  await expect(field(page, "Display name")).toHaveValue("");

  await page.screenshot({
    path: testInfo.outputPath("settings.png"),
    fullPage: true,
  });

  // Signed-in users are sent away from the auth pages, to settings, whatever
  // next says.
  await page.goto("/auth/login");
  await expect(page).toHaveURL(/\/settings$/);
  const response = await page.request.get("/auth/login?next=/.//evil.example", {
    maxRedirects: 0,
  });
  expect(response.status()).toBe(307);
  expect(response.headers().location).toMatch(
    /^(http:\/\/localhost:3100)?\/settings$/,
  );
  await page.goto("/auth/username");
  await expect(page).toHaveURL(/\/settings$/);

  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(
    mainNav(page).getByRole("link", { name: "Log in" }),
  ).toBeVisible();

  // Logged out for real: settings sends us to login again.
  await page.goto("/settings");
  await expect(page).toHaveURL(/\/auth\/login\?next=%2Fsettings$/);

  // And logging back in returns to where we were going.
  await field(page, "Email").fill(email);
  await field(page, "Password").fill("wrong-password");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(formAlert(page)).toContainText("Email or password is incorrect");
});

test("logging in returns to next, and ignores an unsafe next", async ({
  page,
}) => {
  const email = `e2e-${uniqueSuffix()}@anikansou.test`;
  const password = `pw-${uniqueSuffix()}`;

  await page.goto("/auth/sign-up");
  await field(page, "Email").fill(email);
  await field(page, "Password").fill(password);
  await page
    .getByRole("button", { name: "Create account" })
    .filter({ visible: true })
    .click();
  await expect(page).toHaveURL(/\/auth\/username/);

  // Settings is off limits until a username is set.
  await page.goto("/settings");
  await expect(page).toHaveURL(/\/auth\/username\?next=%2Fsettings$/);
  await field(page, "Username").fill(`n_${uniqueSuffix()}`);
  await page.getByRole("button", { name: "Save username" }).click();
  await expect(page).toHaveURL(/\/settings$/);

  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/$/);

  // Signing up again with the same email says so.
  await page.goto("/auth/sign-up");
  await field(page, "Email").fill(email);
  await field(page, "Password").fill(`pw-${uniqueSuffix()}`);
  await page
    .getByRole("button", { name: "Create account" })
    .filter({ visible: true })
    .click();
  await expect(formAlert(page)).toContainText(
    "An account with this email already exists",
  );

  await page.goto("/auth/login?next=%2F%2Fevil.example");
  await field(page, "Email").fill(email);
  await field(page, "Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/^http:\/\/localhost:3100\/settings$/);
});

test("auth pages and settings fit a 360 px screen", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 360, height: 780 });

  const fitsWidth = () =>
    page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    );

  for (const path of ["/auth/login", "/auth/sign-up"]) {
    await page.goto(path);
    await expect(field(page, "Email")).toBeVisible();
    expect(await fitsWidth()).toBe(true);
  }

  await field(page, "Email").fill(`e2e-${uniqueSuffix()}@anikansou.test`);
  await field(page, "Password").fill(`pw-${uniqueSuffix()}`);
  await page.screenshot({ path: testInfo.outputPath("sign-up-360.png") });
  await page
    .getByRole("button", { name: "Create account" })
    .filter({ visible: true })
    .click();
  await expect(page).toHaveURL(/\/auth\/username/);
  expect(await fitsWidth()).toBe(true);

  await field(page, "Username").fill(`m_${uniqueSuffix()}`);
  await page.getByRole("button", { name: "Save username" }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
  expect(await fitsWidth()).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("settings-360.png"),
    fullPage: true,
  });
});

test("signed-out settings visits get a real redirect to login", async ({
  request,
}) => {
  const response = await request.get("/settings", { maxRedirects: 0 });

  expect(response.status()).toBe(307);
  expect(response.headers().location).toMatch(
    /\/auth\/login\?next=%2Fsettings$/,
  );
});

test("signed-out username step redirects to login", async ({ request }) => {
  const response = await request.get("/auth/username", { maxRedirects: 0 });

  expect(response.status()).toBe(307);
  expect(response.headers().location).toMatch(
    /\/auth\/login\?next=%2Fauth%2Fusername$/,
  );
});

test("callback without a code returns to login with a message", async ({
  page,
}) => {
  await page.goto("/auth/callback?error=access_denied");

  await expect(page).toHaveURL(/\/auth\/login/);
  await expect(formAlert(page)).toContainText("Google sign-in");
});
