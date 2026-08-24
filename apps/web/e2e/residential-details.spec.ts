import { test, expect } from "@playwright/test";

async function openResidentialDetails(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByRole("link", { name: "+ Post free ad" }).click();
  await page.getByRole("button", { name: "House" }).click();
  await page.getByRole("button", { name: "Buy" }).click();
  await expect(page.getByText("Amenities")).toBeVisible();
}

function furnishingSelect(page: import("@playwright/test").Page) {
  return page
    .locator("label")
    .filter({ hasText: "Furnishing" })
    .locator("..")
    .locator("select");
}

test.describe("residential listing details", () => {
  test("shows amenities and hides furnishing inventory until furnished", async ({
    page,
  }) => {
    await openResidentialDetails(page);

    await expect(page.getByText("CCTV")).toBeVisible();
    await expect(page.getByText("Furnishing details")).toHaveCount(0);
    await expect(page.getByText("Sofas")).toHaveCount(0);

    await furnishingSelect(page).selectOption("furnished");
    await expect(page.getByText("Furnishing details")).toBeVisible();
    await expect(page.getByText("Sofas")).toBeVisible();
    await expect(page.getByText("Washing machines")).toBeVisible();

    await furnishingSelect(page).selectOption("semi");
    await expect(page.getByText("Furnishing details")).toHaveCount(0);
    await expect(page.getByText("Sofas")).toHaveCount(0);
  });
});
