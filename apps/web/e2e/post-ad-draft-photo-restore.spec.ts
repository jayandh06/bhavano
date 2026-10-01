import path from "node:path";
import { test, expect, type Page } from "@playwright/test";

/** A post-ad draft restored after a reload still publishes, photo included. Photos are kept in
 * IndexedDB as bytes, and each one is read into memory before upload; on 29 Sept 2026 an iPhone
 * seller's restored photos uploaded as truncated bodies and the button stuck on "Posting…". */

const PHOTO = path.join(__dirname, "../../../marketing/google-ads/images/source/generic-phone-at-window.png");

function fieldInput(page: Page, label: string) {
  return page.locator("label").filter({ hasText: label }).first().locator("..").locator("input").first();
}

test.describe("post-ad draft photo restore", () => {
  test("a reloaded draft keeps its photo and posts", async ({ page }) => {
    test.setTimeout(120_000);
    await page.addLocatorHandler(page.getByRole("button", { name: "Not now" }), (button) => button.click());
    await page.goto("/post");
    await page.getByRole("button", { name: "Storage space" }).click();
    await page.getByRole("button", { name: "Rent out" }).click();
    await fieldInput(page, "Title").fill("Dry storage room near metro");
    await page.getByPlaceholder("Start typing a locality…").fill("Indiranagar");
    await page
      .locator("label")
      .filter({ hasText: "Description" })
      .locator("..")
      .locator("textarea")
      .fill("Spacious, dry storage room a short walk from the metro station — ideal for boxes, luggage or seasonal items, with secure, easy access any time.");
    await fieldInput(page, "Price (₹)").fill("5000");
    await fieldInput(page, "Size (sqft)").fill("120");
    await page.locator('input[type="file"][accept^="image/"]').setInputFiles(PHOTO);
    await expect(page.getByRole("button", { name: "Preview Ad" })).toBeEnabled({ timeout: 20_000 });
    await expect(page.getByAltText(/photo/i).first()).toBeVisible();
    // Let the debounced field save and the async photo save land.
    await page.waitForTimeout(1_500);

    await page.reload();
    await expect(page.getByText("We restored the ad you were writing on this device")).toBeVisible();
    await expect(fieldInput(page, "Title")).toHaveValue("Dry storage room near metro");
    await expect(page.getByAltText(/photo/i).first()).toBeVisible();
    await expect(page.getByText(/couldn't be restored/)).toHaveCount(0);

    await page.getByRole("button", { name: "Preview Ad" }).click();
    const owner = page.getByRole("button", { name: "Owner", exact: true });
    if (await owner.isVisible()) await owner.click();
    await page.getByRole("button", { name: "Post ad" }).click();
    await expect(page.getByText("Your ad is live!")).toBeVisible({ timeout: 60_000 });
  });
});
