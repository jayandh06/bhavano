import { test, expect } from "./support/fixtures";
import { selectCity } from "./support/selectCity";

/** Regression test for the bug fixed today: the posting wizard's city `<select>` defaulted to
 * an arbitrary alphabetical city instead of whichever city the user actually had selected,
 * because none of the header's nav links (HeaderAuthButtons) carried the selected city forward
 * as `/post?city=<slug>`, and `/post/page.tsx` had nothing to resolve a default city from.
 * `PostAdWizard` is additionally keyed on the resolved city id (belt-and-suspenders against
 * React reusing a mounted instance's stale state across a same-route navigation), though in
 * this app's current Next.js version a plain re-navigation already correctly re-resolves the
 * default on its own — verified by temporarily reverting the `?city=` link-threading fix and
 * confirming both tests below go red. */

async function openPostAdFromHeader(page: import("@playwright/test").Page, citySlug: string) {
  await page.getByRole("link", { name: "+ Post ad" }).first().click();
  // The header link carries the selected city (and a `from=` marker before it), as /post?...&city=<slug>.
  await expect(page).toHaveURL(new RegExp(`/post\?(?:.*&)?city=${citySlug}(?:&|$)`));
}

async function expectCityChip(page: import("@playwright/test").Page, cityName: string) {
  await expect(page.getByRole("button", { name: "Change city" }).getByText(cityName, { exact: true })).toBeVisible();
}

/** The wizard no longer has its own city `<select>` on the first details screen: city and area now come from the map pin, so what is left
 * to protect is the part that broke originally — the selected city has to be carried into /post, and a second visit with a different
 * city has to follow the new one instead of keeping the first. */
test.describe("post-ad city default", () => {
  test("the post-ad link and page follow the city selected on the homepage", async ({ page }) => {
    await page.goto("/");
    await selectCity(page, "Pune");
    await openPostAdFromHeader(page, "pune");
    await expectCityChip(page, "Pune");
  });

  test("revisiting /post a second time with a different city doesn't keep the first visit's city (repeat-visit regression)", async ({
    page,
  }) => {
    await page.goto("/");
    await selectCity(page, "Mumbai");
    await openPostAdFromHeader(page, "mumbai");
    await expectCityChip(page, "Mumbai");

    // Back to the homepage via an in-app link (not page.goto — a hard reload would remount everything regardless, defeating the point of
    // this test), switch city, and revisit /post: same route, only ?city= differs, which is the client-side-nav case.
    await page.getByRole("link", { name: "← Back to listings" }).click();
    await selectCity(page, "Hyderabad");
    await openPostAdFromHeader(page, "hyderabad");
    await expectCityChip(page, "Hyderabad");
    await expect(page).not.toHaveURL(/city=mumbai/);
  });
});
