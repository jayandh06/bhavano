import { test, expect } from "./support/fixtures";

// Public page: run as a guest.
test.use({ storageState: { cookies: [], origins: [] } });

// /premium is a server page that renders PlanComparisonTable. A client-only hook (useMarket) called from it threw "Attempted to call useMarket() from the
// server" and the page answered 500 in both markets; unit tests cannot see that (in plain Node a client hook is just a function), so load the real page.
test.describe("premium plans page", () => {
  test("loads and shows the plan comparison", async ({ page }) => {
    const response = await page.goto("/premium");
    expect(response?.status()).toBeLessThan(400);
    await expect(page.getByRole("heading", { name: /Selling — compare plans/ })).toBeVisible();
  });
});
