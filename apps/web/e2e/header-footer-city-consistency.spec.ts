import { test, expect, type Page } from "@playwright/test";
import { selectCity } from "./support/selectCity";

/** Regression test for the bug fixed today: `PageHeader` always hardcoded its "Showing ads
 * near" chip to Bengaluru/first-popular, and `Footer` was rendered bare (no `cityAreas`/
 * `currentCityName`) on every account page — so navigating to Favourites/Messages/Profile/
 * My-listings after selecting a city looked like the city had "reset", even though nothing
 * else about the session had changed. Fixed by threading `?city=<slug>` through every nav link
 * in HeaderAuthButtons and having each of these pages resolve it via `resolvePageCityContext`. */

async function navigateViaLink(page: Page, linkName: string, urlPattern: RegExp) {
  // Plain `.click()` followed by a separate URL check can pass against the *previous* page if
  // the click doesn't actually trigger a navigation (seen intermittently right after a city
  // switch, presumably a hydration timing thing) — Promise.all pairs the click with the actual
  // navigation wait so a silently-failed click surfaces as a real failure instead of a false
  // pass against whatever page we were already on.
  await Promise.all([page.waitForURL(urlPattern), page.getByRole("link", { name: linkName }).click()]);
}

async function assertCityConsistent(page: Page, cityName: string) {
  await expect(page.getByText("Showing ads near").locator("..").getByText(cityName, { exact: true })).toBeVisible();
  await expect(page.getByText(`Areas in ${cityName}`, { exact: true })).toBeVisible();
}

test.describe("header/footer city consistency across account pages", () => {
  test("Favourites keeps the selected city", async ({ page }) => {
    await page.goto("/");
    await selectCity(page, "Pune");
    await navigateViaLink(page, "♡ Favourites", /\/favourites/);
    await assertCityConsistent(page, "Pune");
  });

  test("Messages keeps the selected city", async ({ page }) => {
    await page.goto("/");
    await selectCity(page, "Pune");
    await navigateViaLink(page, "💬 Messages", /\/messages/);
    await assertCityConsistent(page, "Pune");
  });

  test("Profile keeps the selected city", async ({ page }) => {
    await page.goto("/");
    await selectCity(page, "Pune");
    await page.getByRole("button", { name: "Seed Owner" }).click();
    await navigateViaLink(page, "Profile", /\/profile/);
    await assertCityConsistent(page, "Pune");
  });

  test("My listings keeps the selected city", async ({ page }) => {
    await page.goto("/");
    await selectCity(page, "Pune");
    await page.getByRole("button", { name: "Seed Owner" }).click();
    await navigateViaLink(page, "My listings", /\/my-listings/);
    await assertCityConsistent(page, "Pune");
  });
});
