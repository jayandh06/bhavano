import { test, expect } from "./support/fixtures";
import type { Page } from "@playwright/test";
import { DRAFT_TITLE, PHOTOS, fieldInput, seedPostAdDraft } from "./support/postAd";

/** The step-by-step Details form (version v3, `/post?form=v3`; docs/plans/post-ad-simpler-form.md): one page whose sections appear one after
 * another, each once the one above it is complete. The form is started from a seeded draft that has only a category and a pin (no Google Maps
 * on a local server), so every later section has to earn its place on screen. Storage is used because its form is short: one required field
 * (size) plus the price, then a pricing and a space-details section of optional fields. */

async function openBlankStepByStep(page: Page) {
  await seedPostAdDraft(page, { blank: "details", resumeInThisTab: true });
  await page.goto("/post?form=v3");
  await expect(page.getByText("We restored the ad you were writing on this device")).toBeVisible();
}

/** Looks for a horizontal scrollbar: the page must not be wider than the screen on a phone. */
async function expectNoSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, "page is wider than the viewport").toBeLessThanOrEqual(1);
}

/** Walks the whole form, checking each section is absent until the one above it is complete. */
async function walkThroughSections(page: Page) {
  // Location is set (seeded), so the photos and video card is showing. Nothing below it is.
  await expect(page.getByText("Where is the property?")).toBeVisible();
  await expect(page.getByText("Show your property")).toBeVisible();
  await expect(page.getByText("The essentials", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Let AI write your title and description")).toHaveCount(0);
  await expect(page.getByText("More details (optional)")).toHaveCount(0);
  // The chip names the first thing missing, and that is the photos, even though the size and price are also missing: problems are listed in
  // the order the sections appear.
  await expect(page.getByText("Next: Add at least 3 photos")).toBeVisible();

  // Photos in: the essentials (every required field) appear. The title is still not asked for.
  await page.locator('input[type="file"][accept^="image/"]').setInputFiles(PHOTOS);
  await expect(page.getByText("The essentials", { exact: true })).toBeVisible();
  await expect(page.getByText("Let AI write your title and description")).toHaveCount(0);

  // The essentials done (size and price): title and description appear, the optional sections do not yet.
  await fieldInput(page, "Size (sqft)").fill("120");
  await fieldInput(page, "Price (₹)").fill("15000");
  await expect(page.getByText("Let AI write your title and description")).toBeVisible();
  await expect(fieldInput(page, "Title")).toBeVisible();
  await expect(page.getByText("More details (optional)")).toHaveCount(0);

  // Title and description done: the first optional section appears, and only that one.
  await fieldInput(page, "Title").fill(DRAFT_TITLE);
  await page.getByPlaceholder(/Describe the place/).fill("A clean, dry storage room on the ground floor with a wide door, close to the metro station and the main road.");
  const owner = page.getByRole("button", { name: "Owner", exact: true });
  if (await owner.isVisible()) await owner.click();
  await expect(page.getByText("More details (optional)")).toBeVisible();
  await expect(page.getByText("Pricing & fees (optional)")).toBeVisible();
  await expect(page.getByText("Space details (optional)")).toHaveCount(0);

  // Answering it brings the next one. Nothing here stopped the Preview button from being ready.
  await expect(page.getByRole("button", { name: "Preview Ad" })).toBeEnabled();
  await fieldInput(page, "Security deposit").fill("30000");
  await expect(page.getByText("Space details (optional)")).toBeVisible();
}

test.describe("step-by-step post-ad form (v3)", () => {
  test("sections appear one after another as the one above is completed", async ({ page }) => {
    await openBlankStepByStep(page);
    await walkThroughSections(page);
  });

  test("a section that has appeared stays when an earlier answer is cleared", async ({ page }) => {
    await openBlankStepByStep(page);
    await walkThroughSections(page);
    await fieldInput(page, "Size (sqft)").fill("");
    await expect(page.getByText("Space details (optional)")).toBeVisible();
    await expect(fieldInput(page, "Title")).toBeVisible();
    // The missing size is now the first problem, and it is in a section that is showing.
    await expect(page.getByText("Next: Size (sqft) is required")).toBeVisible();
  });

  test.describe("on a phone", () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test("works at phone width: sections appear in order and nothing scrolls sideways", async ({ page }) => {
      await openBlankStepByStep(page);
      await expectNoSidewaysScroll(page);
      await walkThroughSections(page);
      await expectNoSidewaysScroll(page);
    });
  });
});

test.describe("the other post-ad forms are unchanged", () => {
  test("v1 (the original) shows everything at once, with its own wording", async ({ page }) => {
    await seedPostAdDraft(page, { resumeInThisTab: true });
    await page.goto("/post?form=v1");
    await expect(page.getByText("We restored the ad you were writing on this device")).toBeVisible();
    await expect(page.getByText("Pin your exact location")).toBeVisible();
    await expect(page.getByText("Show your property")).toHaveCount(0);
    await expect(page.getByText("Let AI write your title and description")).toBeVisible();
    await expect(page.getByText("More details (optional)")).toHaveCount(0);
  });

  test("v2 shows everything at once, with the photos and video in one card", async ({ page }) => {
    await seedPostAdDraft(page, { resumeInThisTab: true });
    await page.goto("/post?form=v2");
    await expect(page.getByText("We restored the ad you were writing on this device")).toBeVisible();
    await expect(page.getByText("Where is the property?")).toBeVisible();
    await expect(page.getByText("Show your property")).toBeVisible();
    await expect(page.getByText("Let AI write your title and description")).toBeVisible();
    await expect(page.getByText("More details (optional)")).toHaveCount(0);
  });
});
