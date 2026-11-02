import { test, expect } from "@playwright/test";

// Public page: run as a guest. The demo user owns every seeded listing, so a logged-in view hides the Contact buttons.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("homepage", () => {
  test("loads with a default city and renders seeded listings", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("button", { name: "Change city" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // Seeded demo listings (apps/bff/prisma/seed.ts) span multiple categories/cities — the
    // default (Buy) tab on the default city should render at least one card.
    await expect(page.getByRole("button", { name: "Contact", exact: true }).first()).toBeVisible();
  });

  test("category tabs switch and update the URL", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: /Rent & Lease/ }).first().click();
    // Category tabs are path URLs now (/rent-lease), not a ?category= query.
    await expect(page).toHaveURL(/\/rent-lease/);

    // Furniture is no longer a top-level tab; Coworking is.
    await page.getByRole("button", { name: /Coworking/ }).first().click();
    await expect(page).toHaveURL(/\/coworking/);
  });

  test("pagination advances to page 2 when more than one page exists", async ({ page }) => {
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Pagination" });

    if ((await nav.count()) === 0) {
      test.skip(true, "seeded data doesn't span more than one page for the default tab/city");
    }

    await nav.getByRole("link", { name: "2", exact: true }).click();
    await expect(page).toHaveURL(/page=2/);
  });
});
