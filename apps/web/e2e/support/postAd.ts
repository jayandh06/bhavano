import path from "node:path";
import type { Page } from "@playwright/test";
import { BFF_URL } from "./constants";
import { scenarioAttributes, scenarioById, scenarioCopy, scenarioPrice, scenarioQualifier } from "../../src/lib/postAdScenarios";

/** Three different photos (the wizard needs at least three, and the server rejects duplicates). */
const SOURCE = path.join(__dirname, "../../../../marketing/google-ads/images/source");
export const PHOTOS = ["generic-phone-at-window.png", "generic-couple-photographing-room.png", "generic-owner-posting-phone.png"].map((file) =>
  path.join(SOURCE, file),
);

export const DRAFT_TITLE = "Dry storage room near metro";

interface CityRow {
  id: string;
  name: string;
  state: string;
  lat: number;
  lng: number;
  isPopular: boolean;
}

/** Puts a post-ad draft in the browser before the page loads, so a test starts on the details step with the form already filled and a pin
 * set, with no typing and no Google Maps (the pin step needs it, and it is not available on a local dev server). The draft has the shape
 * apps/web/src/lib/postAdDraft.ts saves; the field values come from the admin test scenarios (src/lib/postAdScenarios.ts), so they pass
 * the form's own validation.
 *
 * `resumeInThisTab` marks the draft as written in this tab, which makes /post resume it silently ("We restored the ad you were
 * writing"). Left false, a visit to /post is offered the draft instead ("You have an unfinished ad on this device"). Photos are not part
 * of the seeded draft (they live in IndexedDB); a test adds them through the file input. Seeds only when no draft exists yet, so a reload
 * keeps whatever the wizard has saved since. */
export async function seedPostAdDraft(
  page: Page,
  options: { scenarioId?: string; cityName?: string; title?: string; resumeInThisTab?: boolean } = {},
) {
  const { scenarioId = "storage-rent-standard", cityName = "Bengaluru", title = DRAFT_TITLE, resumeInThisTab = false } = options;
  const cities = (await (await fetch(`${BFF_URL}/locations/cities`)).json()) as CityRow[];
  const city = cities.find((c) => c.name === cityName);
  if (!city) throw new Error(`City ${cityName} is not in the seed data`);
  const scenario = scenarioById(scenarioId);
  if (!scenario) throw new Error(`Unknown scenario ${scenarioId}`);

  const price = scenarioPrice(scenario.category, scenario.transactionType, scenario.variant);
  const copy = scenarioCopy(scenario, "Indiranagar");
  const draft = {
    step: "details",
    category: scenario.category,
    transactionType: scenario.transactionType,
    price: String(price),
    priceQualifier: scenarioQualifier(scenario.category, scenario.transactionType),
    priceMode: "total",
    title,
    cityId: city.id,
    city,
    areaQuery: "Indiranagar",
    areaId: null,
    pin: { lat: city.lat, lng: city.lng },
    description: copy.description,
    attributes: scenarioAttributes(scenario.category, scenario.transactionType, scenario.variant, price),
    selectedBoostPlan: null,
  };

  await page.addInitScript(
    ({ value, resume }) => {
      if (localStorage.getItem("bhavano:post-ad-draft")) return;
      localStorage.setItem("bhavano:post-ad-draft", JSON.stringify({ savedAt: Date.now(), draft: value }));
      if (resume) sessionStorage.setItem("bhavano:post-ad-draft-tab", "1");
    },
    { value: draft, resume: resumeInThisTab },
  );
  return draft;
}

/** The text input inside the form field whose label contains `label` (the inputs have no accessible name of their own). */
export function fieldInput(page: Page, label: string) {
  return page.locator("label").filter({ hasText: label }).first().locator("..").locator("input").first();
}
