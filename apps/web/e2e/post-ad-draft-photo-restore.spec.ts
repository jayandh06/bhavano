import { test, expect } from "./support/fixtures";
import type { Page } from "@playwright/test";
import { DRAFT_TITLE, PHOTOS, fieldInput, seedPostAdDraft } from "./support/postAd";

/** A post-ad draft restored after a reload still publishes, photo included. Photos are kept in
 * IndexedDB as bytes, and each one is read into memory before upload; on 29 Sept 2026 an iPhone
 * seller's restored photos uploaded as truncated bodies and the button stuck on "Posting…".
 * The form is filled by a seeded draft (support/postAd.ts); the photos are added through the file input and saved by the wizard itself.
 *
 * Publishing uploads the photos, which needs object storage (R2) on the BFF; a plain local dev setup has none (POST /uploads answers 500).
 * So the restore is always checked, and the publish only when `E2E_CAN_UPLOAD=1` says the BFF can store files. */

/** Opens the seeded draft, adds three photos, reloads, and checks everything came back. */
async function restoreDraftWithPhotos(page: Page) {
  await seedPostAdDraft(page, { resumeInThisTab: true });
  await page.goto("/post");
  await expect(page.getByText("We restored the ad you were writing on this device")).toBeVisible();

  await page.locator('input[type="file"][accept^="image/"]').setInputFiles(PHOTOS);
  const owner = page.getByRole("button", { name: "Owner", exact: true });
  if (await owner.isVisible()) await owner.click();
  await expect(page.getByRole("button", { name: "Preview Ad" })).toBeEnabled({ timeout: 20_000 });
  await expect(page.getByAltText(/photo/i).first()).toBeVisible();
  // Let the debounced field save and the async photo save land.
  await page.waitForTimeout(1_500);

  await page.reload();
  await expect(page.getByText("We restored the ad you were writing on this device")).toBeVisible();
  await expect(fieldInput(page, "Title")).toHaveValue(DRAFT_TITLE);
  await expect(page.getByAltText(/photo/i).first()).toBeVisible();
  await expect(page.getByText(/couldn't be restored/)).toHaveCount(0);
}

test.describe("post-ad draft photo restore", () => {
  test("a reloaded draft keeps its fields and photos and can be previewed", async ({ page }) => {
    await restoreDraftWithPhotos(page);

    // The owner/agent answer is not part of the draft, so the form asks again after the reload.
    const owner = page.getByRole("button", { name: "Owner", exact: true });
    if (await owner.isVisible()) await owner.click();
    await expect(page.getByRole("button", { name: "Preview Ad" })).toBeEnabled();
    await page.getByRole("button", { name: "Preview Ad" }).click();
    await expect(page.getByRole("button", { name: "← Back" })).toBeVisible();
  });

  test("a reloaded draft posts, photos included", async ({ page }) => {
    test.skip(!process.env.E2E_CAN_UPLOAD, "needs object storage on the BFF (set E2E_CAN_UPLOAD=1 where it is configured)");
    test.setTimeout(120_000);
    await restoreDraftWithPhotos(page);

    const owner = page.getByRole("button", { name: "Owner", exact: true });
    if (await owner.isVisible()) await owner.click();
    await page.getByRole("button", { name: "Preview Ad" }).click();
    // The preview asks how to alert the owner; "none of these" needs no email or app. Then the button reads "Reach more <audience>"
    // (disabled until a channel is chosen).
    await page.getByRole("checkbox", { name: /None of these can reach me/ }).check();
    await page.getByRole("button", { name: /^Reach more/ }).click();
    await expect(page.getByText("Your ad is live!")).toBeVisible({ timeout: 60_000 });
  });
});
