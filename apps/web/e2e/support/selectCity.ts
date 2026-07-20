import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

/** Selects a city via the header's `LocationPicker` ("Showing ads near" chip) and waits for the
 * resulting navigation — shared by every spec that needs a specific city selected first. */
export async function selectCity(page: Page, cityName: string) {
  // If this follows a just-completed client-side navigation (e.g. a Link click elsewhere on
  // the page), the header can still be mid-hydration for a moment — clicking too early makes
  // the LocationPicker button unstable (Playwright retries "element detached from DOM" as React
  // finishes settling in). Cheap and reliable in practice; `networkidle` alone isn't quite
  // enough since it only tracks network activity, not React hydration.
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(500);

  await page.getByText("Showing ads near").click();
  await expect(page.getByText("Choose your location")).toBeVisible();
  // LocationPicker's `CityRow` is the only <button> anywhere on the page named after a city
  // (footer/mega-menu city links are <a> elements, a different accessible role).
  await page.getByRole("button", { name: cityName, exact: false }).click();

  // The click triggers a client-side (soft) navigation — wait for the header chip to actually
  // reflect the new city before returning, so callers don't race the in-flight re-render (e.g.
  // clicking a "?city=" link built from the *old* props a moment too early).
  await expect(page.getByText("Showing ads near").locator("..").getByText(cityName, { exact: true })).toBeVisible();

  // The text updating doesn't guarantee every Link on the page has finished re-hydrating its
  // click handler yet — without this, a caller that immediately clicks a nav link right after
  // this returns can have the click silently fall through (no navigation at all) often enough
  // to make callers flaky.
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(300);
}
