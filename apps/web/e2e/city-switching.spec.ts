import { test, expect } from "@playwright/test";
import { selectCity } from "./support/selectCity";

test.describe("city switching", () => {
  test("selecting a city on the homepage updates the header chip, footer areas, and browse-cities list together", async ({
    page,
  }) => {
    await page.goto("/");
    await selectCity(page, "Pune");

    await expect(page).toHaveURL(/city=/);
    await expect(page.getByRole("button", { name: "Change city" })).toBeVisible();
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

  // Regression test for a real bug: the Footer's "Browse Cities" list renders a plain `<Link
  // href="/{city}">` for every other city, and Next.js's client router prefetches every one of
  // those once they're in the DOM — a real request for each, through the same middleware that
  // treats visiting a bare `/{city}` route as a deliberate city choice. Before middleware learned
  // to ignore prefetch-only requests (the `next-router-prefetch` header), whichever background
  // prefetch happened to resolve last silently overwrote `bhavano_city` with a city the visitor
  // never actually clicked — reported as "the city selector randomly changes after browsing".
  test("background prefetching of other cities' pages never overwrites the one the visitor selected", async ({ page }) => {
    await page.goto("/");
    await selectCity(page, "Pune");

    // The homepage's own Footer already lists every other city — give the router time to
    // prefetch them all in the background, same as a real visitor idling on the page would.
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1500);

    // A full reload forces the header to re-resolve the remembered city from the cookie alone —
    // if a stray prefetch had won, this is where it would show up as something other than Pune.
    await page.reload();
    await expect(page.getByRole("button", { name: "Change city" }).getByText("Pune", { exact: true })).toBeVisible();
  });
});
