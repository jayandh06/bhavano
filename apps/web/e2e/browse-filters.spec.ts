import { test, expect } from "@playwright/test";

// Bengaluru's seeded apartment listing (apps/bff/prisma/seed.ts): "3 BHK Apartment in
// Koramangala", 3 bedrooms, semi-furnished, ₹85,00,000 onwards — used below as the one listing
// every filter combination in this file should still turn up.
const LISTING_TITLE = "3 BHK Apartment in Koramangala";
const BROWSE_PATH = "/bengaluru/buy/apartment";

// Public page: run as a guest. The demo user owns every seeded listing, so a logged-in view hides the Contact buttons.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("browse filters", () => {
  test("area filter narrows via ?areas= query param", async ({ page }) => {
    await page.goto(BROWSE_PATH);
    await expect(page.getByText(LISTING_TITLE).first()).toBeVisible();

    await page.getByRole("button", { name: "All areas" }).click();
    // Uncheck a different area than the listing's own (Koramangala) — leaves >1 area selected,
    // so this should produce `?areas=` rather than collapsing to a single-area clean path.
    await page.getByLabel("Whitefield", { exact: true }).click();

    await expect(page).toHaveURL(/[?&]areas=/);
    await expect(page.getByText(LISTING_TITLE).first()).toBeVisible();
  });

  test("BHK filter collapses a single selection onto the clean facet path", async ({ page }) => {
    await page.goto(BROWSE_PATH);

    await page.getByRole("button", { name: "All BHK" }).click();
    // Unchecking every bucket except "3 BHK" (the listing's own) leaves exactly one selected,
    // which should collapse onto the clean /3bhk facet path. Each uncheck triggers its own
    // client-side navigation, so wait for the URL to actually update before the next click —
    // otherwise the checkbox's `checked` state (derived from the URL) hasn't caught up yet.
    await Promise.all([page.waitForURL(/bedrooms=2%2C3%2C4%2C5/), page.getByLabel("1 BHK", { exact: true }).click()]);
    await Promise.all([page.waitForURL(/bedrooms=3%2C4%2C5/), page.getByLabel("2 BHK", { exact: true }).click()]);
    await Promise.all([page.waitForURL(/bedrooms=3%2C5/), page.getByLabel("4 BHK", { exact: true }).click()]);
    await Promise.all([page.waitForURL(/\/3bhk(\?|$)/), page.getByLabel("5+ BHK", { exact: true }).click()]);
    await expect(page.getByText(LISTING_TITLE).first()).toBeVisible();
  });

  test("price range filter narrows via ?minPrice=/?maxPrice=", async ({ page }) => {
    await page.goto(BROWSE_PATH);

    await page.getByRole("button", { name: "Price" }).click();
    // The listing is ₹85L — the range ₹20L–₹2Cr should include it. The filter takes typed bounds
    // ("20L", "2Cr") and an Apply button; the old preset brackets are gone.
    await page.getByRole("textbox", { name: "Minimum price" }).fill("20L");
    await page.getByRole("textbox", { name: "Maximum price" }).fill("2Cr");
    await page.getByRole("button", { name: "Apply" }).click();

    await expect(page).toHaveURL(/[?&]minPrice=\d+/);
    await expect(page).toHaveURL(/[?&]maxPrice=\d+/);
    await expect(page.getByText(LISTING_TITLE).first()).toBeVisible();
  });

  test("furnishing filter narrows via ?furnished=", async ({ page }) => {
    await page.goto(BROWSE_PATH);

    await page.getByRole("button", { name: "Furnishing" }).click();
    await page.getByText("Semi-furnished", { exact: true }).click();

    await expect(page).toHaveURL(/[?&]furnished=semi/);
    await expect(page.getByText(LISTING_TITLE).first()).toBeVisible();
  });

  test("sort by narrows/reorders via ?sort=", async ({ page }) => {
    await page.goto(BROWSE_PATH);

    // The sort control reads "Auto" until a choice is made.
    await page.getByRole("button", { name: /^Auto/ }).click();
    await page.getByText("Price: Low to High", { exact: true }).click();

    await expect(page).toHaveURL(/[?&]sort=price_asc/);
    await expect(page.getByText(LISTING_TITLE).first()).toBeVisible();
  });
});
