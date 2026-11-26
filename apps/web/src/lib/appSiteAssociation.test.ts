import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const file = resolve(__dirname, "../../public/.well-known/apple-app-site-association");
const { applinks } = JSON.parse(readFileSync(file, "utf8")) as { applinks: { details: { appID: string; paths: string[] }[] } };

/** Apple's rule for `paths`: the first pattern that matches decides, a leading "NOT " excludes, and `*` is any run of characters. */
function opensInApp(path: string): boolean {
  for (const entry of applinks.details[0].paths) {
    const excluded = entry.startsWith("NOT ");
    const pattern = (excluded ? entry.slice(4) : entry).replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
    if (new RegExp(`^${pattern}$`).test(path)) return !excluded;
  }
  return false;
}

describe("apple-app-site-association", () => {
  it("claims links for the one app", () => {
    expect(applinks.details.map((d) => d.appID)).toEqual(["L6RKCXT9K4.com.finfolia.bhavano"]);
  });

  // The app only talks to India, so a US link opened in it shows India's home screen or a missing listing.
  it.each(["/us", "/us/", "/us/help", "/us/austin-tx", "/us/austin-tx/downtown/rent/apartments/a-listing-abc"])(
    "leaves the US page %s in the browser",
    (path) => expect(opensInApp(path)).toBe(false),
  );

  it.each(["/", "/bengaluru", "/bengaluru/hsr-layout/rent/apartments/a-listing-abc", "/listings/abc", "/messages", "/usha-nagar"])(
    "still opens the India page %s in the app",
    (path) => expect(opensInApp(path)).toBe(true),
  );
});
