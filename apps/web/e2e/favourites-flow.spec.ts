import { test, expect } from "@playwright/test";

const LISTING_TITLE = "3 BHK Apartment in Koramangala";

test.describe("favourites flow", () => {
  test("favouriting a listing from the grid makes it appear on /favourites", async ({ page }) => {
    await page.goto("/bengaluru/buy/apartment");
    // This page has several apartment listings — scope to the ListingCard containing the known
    // one, since the ♡/♥ toggle button carries no other identifying text/label.
    const card = page.locator("div.bg-surface.border.border-border.rounded-2xl", { hasText: LISTING_TITLE });
    await expect(card).toBeVisible();

    await card.getByRole("button", { name: "♡" }).click();
    await expect(card.getByRole("button", { name: "♥" })).toBeVisible();

    await page.goto("/favourites");
    await expect(page.getByText(LISTING_TITLE)).toBeVisible();

    // Clean up — unfavourite so this test is repeatable against the same seeded data. The
    // toggle is local client state (see ListingCard's onToggleFavourite), so the /favourites
    // list itself only drops the item on a fresh server render, not immediately in-place.
    const favCard = page.locator("div.bg-surface.border.border-border.rounded-2xl", { hasText: LISTING_TITLE });
    await favCard.getByRole("button", { name: "♥" }).click();
    await expect(favCard.getByRole("button", { name: "♡" })).toBeVisible();

    await page.reload();
    await expect(page.getByText(LISTING_TITLE)).not.toBeVisible();
  });
});
