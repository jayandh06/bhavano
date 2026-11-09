import { test, expect } from "./support/fixtures";

// Bengaluru's seeded apartment listing (apps/bff/prisma/seed.ts): "3 BHK Apartment in
// Koramangala", 3 bedrooms, semi-furnished, ₹85,00,000 onwards — used below as the one listing
// every filter combination in this file should still turn up.
const LISTING_TITLE = "3 BHK Apartment in Koramangala";
const BROWSE_PATH = "/bengaluru/buy/apartment";

// Public page: run as a guest. The demo user owns every seeded listing, so a logged-in view hides the Contact buttons.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("browse filters", () => {
  // Every filter dropdown only changes a draft; the filter section's own Apply searches once and its Reset clears them all (FilterSection.tsx).
  const apply = (page: import("@playwright/test").Page) => page.getByRole("button", { name: "Apply", exact: true });

  test("area filter narrows via ?areas= query param, on Apply", async ({ page }) => {
    await page.goto(BROWSE_PATH);
    await expect(page.getByText(LISTING_TITLE).first()).toBeVisible();
    await expect(apply(page)).toBeDisabled(); // nothing changed yet

    await page.getByRole("button", { name: "All areas" }).click();
    // Uncheck a different area than the listing's own (Koramangala) — leaves >1 area selected,
    // so this should produce `?areas=` rather than collapsing to a single-area clean path.
    await page.getByLabel("Whitefield", { exact: true }).click();
    await expect(page).not.toHaveURL(/[?&]areas=/);
    await expect(apply(page)).toBeEnabled();
    await apply(page).click();

    await expect(page).toHaveURL(/[?&]areas=/);
    await expect(page.getByText(LISTING_TITLE).first()).toBeVisible();
  });

  test("area filter after Clear all: picks stay in one dropdown, the label counts them, at least one is needed, one search on Apply", async ({ page }) => {
    await page.goto(BROWSE_PATH);
    await page.getByRole("button", { name: "All areas" }).click();
    // Every area is picked, so the button says "Clear all"; once some are not, it shows how many are.
    await page.getByRole("button", { name: "Clear all" }).click();
    await expect(apply(page)).toBeDisabled(); // none picked: not allowed
    await expect(page.getByText("Pick at least one area").first()).toBeVisible();

    await page.getByLabel("Koramangala", { exact: true }).click();
    await page.getByLabel("Whitefield", { exact: true }).click();
    await expect(page.getByRole("button", { name: "Clear (2)" })).toBeVisible();
    await expect(page.getByLabel("Koramangala", { exact: true })).toBeChecked();
    await expect(page.getByLabel("Whitefield", { exact: true })).toBeChecked();
    await expect(page).not.toHaveURL(/[?&]areas=/);

    await apply(page).click();
    await expect(page).toHaveURL(/[?&]areas=/);
    await expect(page.getByRole("button", { name: "2 areas" })).toBeVisible();
    await expect(page.getByText(LISTING_TITLE).first()).toBeVisible();
  });

  test("closing a dropdown keeps the pending picks; Reset clears every filter", async ({ page }) => {
    await page.goto(BROWSE_PATH);
    await page.getByRole("button", { name: "All areas" }).click();
    await page.getByLabel("Whitefield", { exact: true }).click();
    await page.keyboard.press("Escape");
    await page.getByRole("heading", { level: 1 }).click();
    // Nothing was searched, and the pick is still pending (the pill says so, Apply is on).
    await expect(page).not.toHaveURL(/[?&]areas=/);
    await expect(page.getByRole("button", { name: /^\d+ areas$/ })).toBeVisible();
    await expect(apply(page)).toBeEnabled();

    await apply(page).click();
    await expect(page).toHaveURL(/[?&]areas=/);

    await page.getByRole("button", { name: "Reset", exact: true }).click();
    await expect(page).not.toHaveURL(/[?&]areas=/);
    await expect(page.getByRole("button", { name: "All areas" })).toBeVisible();
  });

  test("area, BHK and furnishing together change the URL once, on a single Apply", async ({ page }) => {
    await page.goto(BROWSE_PATH);

    await page.getByRole("button", { name: "All areas" }).click();
    await page.getByLabel("Whitefield", { exact: true }).click();
    await page.getByRole("button", { name: "All BHK" }).click();
    for (const label of ["1 BHK", "2 BHK", "4 BHK", "5+ BHK"]) await page.getByLabel(label, { exact: true }).click();
    await page.getByRole("button", { name: "Furnishing" }).click();
    await page.getByText("Semi-furnished", { exact: true }).click();
    await expect(page).not.toHaveURL(/furnished=|areas=/);

    await apply(page).click();
    // One navigation: several areas (query), one BHK bucket (clean /3bhk path), furnishing (query).
    await expect(page).toHaveURL(/\/3bhk\?/);
    await expect(page).toHaveURL(/[?&]areas=/);
    await expect(page).toHaveURL(/[?&]furnished=semi/);
    await expect(page.getByText(LISTING_TITLE).first()).toBeVisible();
  });

  test("BHK filter collapses a single selection onto the clean facet path", async ({ page }) => {
    await page.goto(BROWSE_PATH);

    await page.getByRole("button", { name: "All BHK" }).click();
    // Unchecking every bucket except "3 BHK" (the listing's own) leaves exactly one selected,
    // which collapses onto the clean /3bhk facet path once applied.
    for (const label of ["1 BHK", "2 BHK", "4 BHK", "5+ BHK"]) await page.getByLabel(label, { exact: true }).click();
    await expect(page).not.toHaveURL(/3bhk/);
    await apply(page).click();
    await expect(page).toHaveURL(/\/3bhk(\?|$)/);
    await expect(page.getByText(LISTING_TITLE).first()).toBeVisible();
  });

  test("price range filter narrows via ?minPrice=/?maxPrice=", async ({ page }) => {
    await page.goto(BROWSE_PATH);

    await page.getByRole("button", { name: "Price" }).click();
    // The listing is ₹85L — the range ₹20L–₹2Cr should include it. The filter takes typed bounds ("20L", "2Cr").
    await page.getByRole("textbox", { name: "Minimum price" }).fill("20L");
    await page.getByRole("textbox", { name: "Maximum price" }).fill("2Cr");
    await apply(page).click();

    await expect(page).toHaveURL(/[?&]minPrice=\d+/);
    await expect(page).toHaveURL(/[?&]maxPrice=\d+/);
    await expect(page.getByText(LISTING_TITLE).first()).toBeVisible();
  });

  test("furnishing filter narrows via ?furnished=", async ({ page }) => {
    await page.goto(BROWSE_PATH);

    await page.getByRole("button", { name: "Furnishing" }).click();
    await page.getByText("Semi-furnished", { exact: true }).click();
    await apply(page).click();

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
