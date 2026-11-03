import { test, expect } from "./support/fixtures";
import { DRAFT_TITLE, fieldInput, seedPostAdDraft } from "./support/postAd";

/** A draft from an earlier visit is offered on the category step instead of being resumed
 * unasked; a reload in the same tab still resumes it (post-ad-draft-photo-restore.spec.ts).
 * The draft is seeded in localStorage (support/postAd.ts) without the same-tab marker, which is what a visit from a new tab looks like. */

test.describe("post-ad draft offer", () => {
  test("a new visit offers the draft and continues it on request", async ({ page }) => {
    await seedPostAdDraft(page);
    await page.goto("/post");

    const offer = page.getByRole("region", { name: "Unfinished ad" });
    await expect(offer).toBeVisible();
    await expect(offer).toContainText(`Storage space · Rent out · “${DRAFT_TITLE}”`);
    // Still on the category step, not resumed unasked.
    await expect(page.getByRole("button", { name: "Storage space" })).toBeVisible();
    await expect(page.getByText("We restored the ad you were writing on this device")).toHaveCount(0);

    await offer.getByRole("button", { name: "Continue this ad" }).click();
    await expect(fieldInput(page, "Title")).toHaveValue(DRAFT_TITLE);
  });

  test("starting a new ad discards the draft", async ({ page, context }) => {
    await seedPostAdDraft(page);
    await page.goto("/post");
    await page.getByRole("region", { name: "Unfinished ad" }).getByRole("button", { name: "Start a new ad" }).click();
    await expect(page.getByRole("region", { name: "Unfinished ad" })).toHaveCount(0);

    // A page without the seeding script: the draft really is gone from the browser's storage.
    const again = await context.newPage();
    await again.goto("/post");
    await expect(again.getByRole("button", { name: "Storage space" })).toBeVisible();
    await expect(again.getByRole("region", { name: "Unfinished ad" })).toHaveCount(0);
  });
});
