import { test, expect } from "./support/fixtures";

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
    // Ticking only edits a draft: nothing is searched until Apply.
    await expect(page).not.toHaveURL(/[?&]areas=/);
    await page.getByRole("button", { name: /^Apply/ }).click();

    await expect(page).toHaveURL(/[?&]areas=/);
    await expect(page.getByText(LISTING_TITLE).first()).toBeVisible();
  });

  test("area filter after Clear all: several picks stay in one open dropdown and search once, on Apply", async ({ page }) => {
    await page.goto(BROWSE_PATH);
    await page.getByRole("button", { name: "All areas" }).click();
    await page.getByRole("button", { name: "Clear all" }).click();
    await page.getByLabel("Koramangala", { exact: true }).click();
    await page.getByLabel("Whitefield", { exact: true }).click();

    // Still open, still on the same page, with both ticks shown.
    await expect(page.getByLabel("Koramangala", { exact: true })).toBeChecked();
    await expect(page.getByLabel("Whitefield", { exact: true })).toBeChecked();
    await expect(page).not.toHaveURL(/[?&]areas=/);

    await page.getByRole("button", { name: "Apply · 2 areas" }).click();
    await expect(page).toHaveURL(/[?&]areas=/);
    await expect(page.getByRole("button", { name: "2 areas" })).toBeVisible();
    await expect(page.getByText(LISTING_TITLE).first()).toBeVisible();
  });

  test("area filter: Cancel, Escape and a click outside drop the draft without searching", async ({ page }) => {
    await page.goto(BROWSE_PATH);
    const panelButton = page.getByRole("button", { name: "All areas" });

    await panelButton.click();
    await page.getByLabel("Whitefield", { exact: true }).click();
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page).not.toHaveURL(/[?&]areas=/);
    await expect(panelButton).toBeVisible();

    await panelButton.click();
    await page.getByLabel("Whitefield", { exact: true }).click();
    await page.keyboard.press("Escape");
    await expect(page).not.toHaveURL(/[?&]areas=/);

    await panelButton.click();
    await page.getByLabel("Whitefield", { exact: true }).click();
    await page.getByRole("heading", { level: 1 }).click();
    await expect(page).not.toHaveURL(/[?&]areas=/);
    // The draft is gone: reopening shows Whitefield ticked again.
    await panelButton.click();
    await expect(page.getByLabel("Whitefield", { exact: true })).toBeChecked();
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
