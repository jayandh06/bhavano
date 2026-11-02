import { test, expect } from "@playwright/test";
import { DRAFT_TITLE, PHOTOS, fieldInput, seedPostAdDraft } from "./support/postAd";

/** The browser Back button on the post-ad preview returns to the form, not to the page before
 * `/post`. The wizard's steps are component state, so before PostAdWizard gave the preview its own
 * history entry, Back on the preview left `/post` entirely — an ad visitor who had filled in the
 * whole form landed back on the home page with nothing posted (29 Sept 2026).
 *
 * The form is filled by a seeded draft (support/postAd.ts) instead of typing: the location step needs a Google Maps pin, which a local dev
 * server does not have. */

test.describe("post-ad preview back button", () => {
  test("browser Back on the preview returns to the details step with the form intact", async ({ page }) => {
    // The seeded demo user has no email, so the "Add your email" nudge can open over the form.
    await page.addLocatorHandler(page.getByRole("button", { name: "Not now" }), (button) => button.click());
    await seedPostAdDraft(page, { resumeInThisTab: true });

    await page.goto("/");
    // Retried: the email nudge can open mid-click and swallow it.
    await expect(async () => {
      await page.getByRole("link", { name: "+ Post ad" }).first().click();
      await expect(page).toHaveURL(/\/post/, { timeout: 10_000 });
    }).toPass({ timeout: 60_000 });

    await expect(page.getByText("We restored the ad you were writing on this device")).toBeVisible();
    await page.locator('input[type="file"][accept^="image/"]').setInputFiles(PHOTOS);
    // The seeded demo user has not said whether they are an owner or an agent, so the form asks.
    const owner = page.getByRole("button", { name: "Owner", exact: true });
    if (await owner.isVisible()) await owner.click();
    await expect(page.getByRole("button", { name: "Preview Ad" })).toBeEnabled({ timeout: 20_000 });

    await page.getByRole("button", { name: "Preview Ad" }).click();
    await expect(page.getByRole("button", { name: "← Back" })).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL(/\/post/);
    await expect(page.getByRole("button", { name: "Preview Ad" })).toBeVisible();
    await expect(fieldInput(page, "Title")).toHaveValue(DRAFT_TITLE);

    // Previewing again and using the in-page Back keeps history consistent: one more browser Back
    // then leaves the form for the home page, rather than needing a dead extra press.
    await page.getByRole("button", { name: "Preview Ad" }).click();
    await expect(page.getByRole("button", { name: "← Back" })).toBeVisible();
    await page.getByRole("button", { name: "← Back" }).click();
    await expect(page.getByRole("button", { name: "Preview Ad" })).toBeVisible();
    await page.goBack();
    await expect(page).not.toHaveURL(/\/post/);
  });
});
