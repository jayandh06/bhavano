import { test, expect, type Page } from "@playwright/test";

const LISTING_TITLE = "3 BHK Apartment in Koramangala";

/** The listing's card: the innermost block holding both its title link and its favourite button (the cards carry no test ids, and
 * the heart is an icon button named by its aria-label, "Save to favourites" / "Remove from favourites"). */
function listingCard(page: Page) {
  // From the title link, the nearest ancestor block that also holds a favourite button.
  return page
    .getByRole("link", { name: new RegExp(LISTING_TITLE) })
    .first()
    .locator("xpath=ancestor::div[.//button[contains(@aria-label, 'favourites')]][1]");
}

test.describe("favourites flow", () => {
  test("favouriting a listing from the grid makes it appear on /favourites", async ({ page }) => {
    await page.goto("/bengaluru/buy/apartment");
    const card = listingCard(page);
    await expect(card).toBeVisible();

    // A failed earlier run can leave it favourited; start from a known state.
    if (await card.getByRole("button", { name: "Remove from favourites" }).isVisible()) {
      await card.getByRole("button", { name: "Remove from favourites" }).click();
      await expect(card.getByRole("button", { name: "Save to favourites" })).toBeVisible();
    }

    await card.getByRole("button", { name: "Save to favourites" }).click();
    await expect(card.getByRole("button", { name: "Remove from favourites" })).toBeVisible();

    await page.goto("/favourites");
    await expect(page.getByText(LISTING_TITLE).first()).toBeVisible();

    // Clean up — unfavourite so this test is repeatable against the same seeded data. The list may drop the card in place or only on
    // the next server render, so assert on a fresh load rather than on what happens right after the click.
    await page.waitForLoadState("networkidle");
    await listingCard(page).getByRole("button", { name: "Remove from favourites" }).click();
    // Wait for the removal to take effect (the card drops, or the heart flips back) before reloading.
    await expect(page.getByRole("button", { name: "Remove from favourites" })).toHaveCount(0, { timeout: 15_000 });

    await page.reload();
    await expect(page.getByText(LISTING_TITLE)).toHaveCount(0);
  });
});
