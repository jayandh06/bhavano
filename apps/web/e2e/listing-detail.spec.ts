import { test, expect } from "@playwright/test";

const LISTING_TITLE = "3 BHK Apartment in Koramangala";

test.describe("listing detail", () => {
  test("opens from the grid (new tab) and renders title/specs/breadcrumbs/JSON-LD", async ({ page, context }) => {
    await page.goto("/bengaluru/buy/apartment");

    // ListingCard opens the detail page in a new tab (target="_blank").
    const [detailPage] = await Promise.all([context.waitForEvent("page"), page.getByText(LISTING_TITLE).click()]);
    await detailPage.waitForLoadState();

    await expect(detailPage.getByRole("heading", { name: LISTING_TITLE })).toBeVisible();
    await expect(detailPage.getByText("Koramangala", { exact: false }).first()).toBeVisible();
    await expect(detailPage.getByText("Bengaluru", { exact: false }).first()).toBeVisible();

    const jsonLdBlocks = await detailPage.locator('script[type="application/ld+json"]').allTextContents();
    expect(jsonLdBlocks.length).toBeGreaterThan(0);
    const parsed = jsonLdBlocks.map((json) => JSON.parse(json));
    expect(parsed.some((d) => d["@type"] === "BreadcrumbList")).toBe(true);
    expect(parsed.some((d) => d["@type"] === "Product")).toBe(true);
  });
});
