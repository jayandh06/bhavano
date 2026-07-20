import { test, expect } from "@playwright/test";
import { selectCity } from "./support/selectCity";

test.describe("city switching", () => {
  test("selecting a city on the homepage updates the header chip, footer areas, and browse-cities list together", async ({
    page,
  }) => {
    await page.goto("/");
    await selectCity(page, "Pune");

    await expect(page).toHaveURL(/city=/);
    await expect(page.getByText("Showing ads near")).toBeVisible();
    await expect(page.getByText("Areas in Pune", { exact: true })).toBeVisible();

    // "Browse Cities" excludes the currently-selected city (see Footer.tsx) — Pune itself
    // shouldn't appear as a link once it's the active city.
    await expect(page.getByText("Browse Cities", { exact: true }).locator("..").getByRole("link", { name: "Pune", exact: true })).toHaveCount(
      0,
    );
  });

  test("selecting a city on a /{city}/... browse page navigates to the new city's equivalent page", async ({ page }) => {
    await page.goto("/mumbai/buy");
    await selectCity(page, "Pune");

    await expect(page).toHaveURL(/\/pune\/buy/);
    await expect(page.getByText("Areas in Pune", { exact: true })).toBeVisible();
  });
});
