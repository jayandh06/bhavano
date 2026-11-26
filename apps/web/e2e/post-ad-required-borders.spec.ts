import { test, expect } from "./support/fixtures";
import type { Locator, Page } from "@playwright/test";
import { DRAFT_TITLE, PHOTOS, seedPostAdDraft } from "./support/postAd";

/** Required fields on the redesigned form (`/post?form=v2`, docs/plans/post-ad-simpler-form.md): a soft red border while empty, solid red once the
 * field has a problem on screen, green once it is filled; optional fields stay neutral; the original form (v1) has none of it. Started from a
 * seeded draft that has a category and a pin only (no Google Maps on a local server), so every required field begins empty. Apartment for rent is
 * used because it has the most required fields. */

const field = (page: Page, key: string) => page.locator(`[id="post-field-attr:${key}"]`);

/** The top border colour as numbers, so a test can say "reddish" or "greenish" without caring about the exact shade. */
async function borderOf(locator: Locator) {
  const css = await locator.evaluate((el) => getComputedStyle(el).borderTopColor);
  const [r, g, b, a] = (css.match(/[\d.]+/g) ?? []).map(Number);
  return { r, g, b, a: a ?? 1, css };
}

async function openBlankApartment(page: Page, form = "v2") {
  await seedPostAdDraft(page, { scenarioId: "apartment-rent-standard", blank: "details", resumeInThisTab: true });
  await page.goto(`/post?form=${form}`);
  await expect(page.getByText("We restored the ad you were writing on this device")).toBeVisible();
}

test.describe("required-field borders (v2)", () => {
  test("every required field starts empty and soft red; optional ones carry no state", async ({ page }) => {
    await openBlankApartment(page);
    for (const key of ["bedrooms", "bathrooms", "floor", "totalFloors", "carpetAreaSqft", "furnished", "entranceFacing", "fromBroker"]) {
      await expect(field(page, key), key).toHaveAttribute("data-req", "empty");
    }
    await expect(page.locator("#post-field-photos")).toHaveAttribute("data-req", "empty");
    await expect(page.locator("#post-field-title")).toHaveAttribute("data-req", "empty");
    await expect(page.locator("#post-field-description")).toHaveAttribute("data-req", "empty");
    // The pin is seeded, so the map frame is already green.
    await expect(page.locator("[data-req-self]")).toHaveAttribute("data-req-self", "ok");
    // An optional field has no state at all.
    await expect(field(page, "balconyCount")).not.toHaveAttribute("data-req", /.+/);

    // Colours: the empty frame is reddish and see-through; the map frame is greenish.
    const empty = await borderOf(field(page, "bedrooms").locator("[data-req-frame]"));
    expect(empty.r, empty.css).toBeGreaterThan(empty.g + 40);
    expect(empty.a, "soft red is translucent").toBeLessThan(1);
    const ok = await borderOf(page.locator("[data-req-self]"));
    expect(ok.g, ok.css).toBeGreaterThan(ok.r);
    const optional = await borderOf(field(page, "balconyCount").locator("[data-req-frame]"));
    expect(Math.abs(optional.r - optional.g), `optional stays neutral: ${optional.css}`).toBeLessThan(40);
  });

  test("filling a field turns it green; leaving one empty turns it solid red with its message", async ({ page }) => {
    await openBlankApartment(page);

    await field(page, "bedrooms").locator("input").fill("2");
    await expect(field(page, "bedrooms")).toHaveAttribute("data-req", "ok");
    const green = await borderOf(field(page, "bedrooms").locator("[data-req-frame]"));
    expect(green.g, green.css).toBeGreaterThan(green.r);

    // Visit the carpet area and leave it empty: its message shows and the border goes solid red.
    await field(page, "carpetAreaSqft").locator("input").first().focus();
    await field(page, "bathrooms").locator("input").first().focus();
    await expect(field(page, "carpetAreaSqft")).toHaveAttribute("data-req", "error");
    await expect(field(page, "carpetAreaSqft").getByRole("alert")).toBeVisible();
    // The border colour animates, so read it until it settles; a single read can land mid-transition with a translucent alpha.
    const input = field(page, "carpetAreaSqft").locator("input").first();
    await expect.poll(async () => (await borderOf(input)).a, { message: "solid red is opaque" }).toBe(1);
    const solid = await borderOf(input);
    expect(solid.r, solid.css).toBeGreaterThan(solid.g + 40);

    // Filling it clears the error and turns it green.
    await field(page, "carpetAreaSqft").locator("input").first().fill("950");
    await expect(field(page, "carpetAreaSqft")).toHaveAttribute("data-req", "ok");
    await expect(field(page, "carpetAreaSqft").getByRole("alert")).toHaveCount(0);
  });

  test("photos, title and description go from empty to ok as they are filled", async ({ page }) => {
    await openBlankApartment(page);
    await page.locator('input[type="file"][accept^="image/"]').setInputFiles(PHOTOS);
    await expect(page.locator("#post-field-photos")).toHaveAttribute("data-req", "ok");
    const zone = await borderOf(page.locator("#post-field-photos [data-upload-zone]"));
    expect(zone.g, zone.css).toBeGreaterThan(zone.r);

    await page.locator("#post-field-title input").fill(DRAFT_TITLE);
    await expect(page.locator("#post-field-title")).toHaveAttribute("data-req", "ok");
    await page.locator("#post-field-description textarea").fill("A bright two bedroom apartment close to the metro station, with covered parking and a quiet society garden.");
    await expect(page.locator("#post-field-description")).toHaveAttribute("data-req", "ok");
  });

  test("a blocked Preview tap makes every missing required field solid red", async ({ page }) => {
    await openBlankApartment(page);
    // While things are missing the Preview button names the first one and how many more, e.g. "Add photos (+11 more)".
    await page.getByRole("button", { name: /\(\+\d+ more\)$/ }).click();
    await expect(field(page, "bedrooms")).toHaveAttribute("data-req", "error");
    await expect(page.locator("#post-field-title")).toHaveAttribute("data-req", "error");
  });

  test("works at phone width and does not scroll sideways", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openBlankApartment(page);
    await expect(field(page, "bedrooms")).toHaveAttribute("data-req", "empty");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
});

test.describe("the original form (v1) is unchanged", () => {
  test("has no required-field state anywhere", async ({ page }) => {
    await openBlankApartment(page, "v1");
    await expect(page.getByText("Pin your exact location")).toBeVisible();
    await expect(page.locator("[data-req], [data-req-self]")).toHaveCount(0);
  });
});
