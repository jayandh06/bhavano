import { test, expect } from "./support/fixtures";

async function openResidentialDetails(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByRole("link", { name: "+ Post ad" }).click();
  // One screen now: what you want to do (Sell / Rent out / Lease out) and what you are listing.
  await page.getByRole("button", { name: "Sell", exact: true }).click();
  await page.getByRole("button", { name: "House", exact: true }).click();
  await expect(page.getByText("Amenities")).toBeVisible();
}

/** Furnishing is a radio group (Unfurnished / Semi-furnished / Furnished). */
async function chooseFurnishing(page: import("@playwright/test").Page, label: "Unfurnished" | "Semi-furnished" | "Furnished") {
  await page.getByRole("radio", { name: label, exact: true }).click();
}

test.describe("residential listing details", () => {
  test("shows amenities and hides furnishing inventory until furnished", async ({
    page,
  }) => {
    await openResidentialDetails(page);

    await expect(page.getByText("CCTV")).toBeVisible();
    await expect(page.getByText("Furnishing details")).toHaveCount(0);
    await expect(page.getByText("Sofas")).toHaveCount(0);

    await chooseFurnishing(page, "Furnished");
    await expect(page.getByText("Furnishing details")).toBeVisible();
    await expect(page.getByText("Sofas")).toBeVisible();
    await expect(page.getByText("Washing machines")).toBeVisible();

    await chooseFurnishing(page, "Semi-furnished");
    await expect(page.getByText("Furnishing details")).toHaveCount(0);
    await expect(page.getByText("Sofas")).toHaveCount(0);
  });
});
