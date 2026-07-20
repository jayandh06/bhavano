import { test, expect } from "@playwright/test";

test.describe("homepage", () => {
  test("loads with a default city and renders seeded listings", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText("Showing ads near")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // Seeded demo listings (apps/bff/prisma/seed.ts) span multiple categories/cities — the
    // default (Buy) tab on the default city should render at least one card.
    await expect(page.getByRole("button", { name: "Contact owner" }).first()).toBeVisible();
  });

  test("category tabs switch and update the URL", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: /Rent & Lease/ }).first().click();
    await expect(page).toHaveURL(/category=rentLease/);

    await page.getByRole("button", { name: /Furniture/ }).first().click();
    await expect(page).toHaveURL(/category=furniture/);
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
