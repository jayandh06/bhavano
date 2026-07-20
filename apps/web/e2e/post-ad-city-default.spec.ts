import { test, expect } from "@playwright/test";
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

async function openPostAdWizardDetailsStep(page: import("@playwright/test").Page) {
  await page.getByRole("link", { name: "+ Post free ad" }).click();
  await expect(page).toHaveURL(/\/post\?city=/);
  // "PG / Hostel" is rent-only (see packages/types/src/postingRules.ts), so picking it skips
  // the transaction-type step and lands straight on "details", where the City <select> lives.
  await page.getByRole("button", { name: "PG / Hostel" }).click();
}

async function citySelectValue(page: import("@playwright/test").Page): Promise<string> {
  const select = page.locator("select").filter({ has: page.locator('option:has-text("Bengaluru")') });
  return select.locator("option:checked").innerText();
}

test.describe("post-ad city default", () => {
  test("the city select defaults to whatever city was selected on the homepage", async ({ page }) => {
    await page.goto("/");
    await selectCity(page, "Pune");
    await openPostAdWizardDetailsStep(page);

    expect(await citySelectValue(page)).toBe("Pune");
  });

  test("revisiting /post a second time with a different city doesn't keep the first visit's city (repeat-visit regression)", async ({
    page,
  }) => {
    await page.goto("/");
    await selectCity(page, "Mumbai");
    await openPostAdWizardDetailsStep(page);
    expect(await citySelectValue(page)).toBe("Mumbai");

    // Back to the homepage via an in-app link (not page.goto — a hard reload would remount
    // everything regardless, defeating the point of this test), switch city, and revisit /post:
    // same route, only ?city= differs, which is exactly the client-side-nav case that didn't
    // remount the wizard before the fix.
    await page.getByRole("link", { name: "← Back to listings" }).click();
    await selectCity(page, "Hyderabad");
    await openPostAdWizardDetailsStep(page);
    expect(await citySelectValue(page)).toBe("Hyderabad");
  });
});
