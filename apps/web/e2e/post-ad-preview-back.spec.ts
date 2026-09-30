import path from "node:path";
import { test, expect, type Page } from "@playwright/test";

/** The browser Back button on the post-ad preview returns to the form, not to the page before
 * `/post`. The wizard's steps are component state, so before PostAdWizard gave the preview its own
 * history entry, Back on the preview left `/post` entirely — an ad visitor who had filled in the
 * whole form landed back on the home page with nothing posted (29 Sept 2026). */

const PHOTO = path.join(__dirname, "../../../marketing/google-ads/images/source/generic-phone-at-window.png");

function fieldInput(page: Page, label: string) {
  return page.locator("label").filter({ hasText: label }).first().locator("..").locator("input").first();
}

async function fillStorageDetails(page: Page) {
  await page.getByRole("button", { name: "Storage space" }).click();
  await page.getByRole("button", { name: "Rent out" }).click();
  await fieldInput(page, "Title").fill("Dry storage room near metro");
  await page.getByPlaceholder("Start typing a locality…").fill("Indiranagar");
  await fieldInput(page, "Price (₹)").fill("5000");
  await fieldInput(page, "Size (sqft)").fill("120");
  await page.locator('input[type="file"][accept^="image/"]').setInputFiles(PHOTO);
  await expect(page.getByRole("button", { name: "Preview Ad" })).toBeEnabled({ timeout: 20_000 });
}

test.describe("post-ad preview back button", () => {
  test("browser Back on the preview returns to the details step with the form intact", async ({ page }) => {
    // The seeded demo user has no email, so the "Add your email" nudge can open over the form.
    await page.addLocatorHandler(page.getByRole("button", { name: "Not now" }), (button) => button.click());
    await page.goto("/");
    // Retried: the email nudge can open mid-click and swallow it.
    await expect(async () => {
      await page.getByRole("link", { name: "+ Post ad" }).click();
      await expect(page).toHaveURL(/\/post/, { timeout: 10_000 });
    }).toPass({ timeout: 60_000 });
    await fillStorageDetails(page);

    await page.getByRole("button", { name: "Preview Ad" }).click();
    await expect(page.getByRole("button", { name: "Post ad" })).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL(/\/post/);
    await expect(page.getByRole("button", { name: "Preview Ad" })).toBeVisible();
    await expect(fieldInput(page, "Title")).toHaveValue("Dry storage room near metro");

    // Previewing again and using the in-page Back keeps history consistent: one more browser Back
    // then leaves the form for the home page, rather than needing a dead extra press.
    await page.getByRole("button", { name: "Preview Ad" }).click();
    await expect(page.getByRole("button", { name: "Post ad" })).toBeVisible();
    await page.getByRole("button", { name: "← Back" }).click();
    await expect(page.getByRole("button", { name: "Preview Ad" })).toBeVisible();
    await page.goBack();
    await expect(page).not.toHaveURL(/\/post/);
  });
});
