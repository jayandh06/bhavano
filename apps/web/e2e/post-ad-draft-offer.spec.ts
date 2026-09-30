import { test, expect, type Page } from "@playwright/test";

/** A draft from an earlier visit is offered on the category step instead of being resumed
 * unasked; a reload in the same tab still resumes it (post-ad-draft-photo-restore.spec.ts).
 * A second page in the same context shares localStorage but not sessionStorage, like a new tab. */

function fieldInput(page: Page, label: string) {
  return page.locator("label").filter({ hasText: label }).first().locator("..").locator("input").first();
}

async function startDraft(page: Page) {
  await page.addLocatorHandler(page.getByRole("button", { name: "Not now" }), (button) => button.click());
  await page.goto("/post");
  await page.getByRole("button", { name: "Storage space" }).click();
  await page.getByRole("button", { name: "Rent out" }).click();
  await fieldInput(page, "Title").fill("Dry storage room near metro");
  // Let the debounced field save land.
  await page.waitForTimeout(1_500);
}

test.describe("post-ad draft offer", () => {
  test("a new visit offers the draft and continues it on request", async ({ page, context }) => {
    await startDraft(page);

    const later = await context.newPage();
    await later.goto("/post");
    const offer = later.getByRole("region", { name: "Unfinished ad" });
    await expect(offer).toBeVisible();
    await expect(offer).toContainText("Storage space · Rent out · “Dry storage room near metro”");
    await expect(later.getByRole("button", { name: "Storage space" })).toBeVisible();
    await expect(later.getByText("We restored the ad you were writing on this device")).toHaveCount(0);

    await offer.getByRole("button", { name: "Continue this ad" }).click();
    await expect(fieldInput(later, "Title")).toHaveValue("Dry storage room near metro");
  });

  test("starting a new ad discards the draft", async ({ page, context }) => {
    await startDraft(page);

    const later = await context.newPage();
    await later.goto("/post");
    await later.getByRole("region", { name: "Unfinished ad" }).getByRole("button", { name: "Start a new ad" }).click();
    await expect(later.getByRole("region", { name: "Unfinished ad" })).toHaveCount(0);

    const again = await context.newPage();
    await again.goto("/post");
    await expect(again.getByRole("button", { name: "Storage space" })).toBeVisible();
    await expect(again.getByRole("region", { name: "Unfinished ad" })).toHaveCount(0);
  });
});
