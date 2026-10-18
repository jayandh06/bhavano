import { describe, expect, it } from "vitest";
import { ALL_AREA_OVERVIEWS, getAreaOverview } from "./areaOverviews";

describe("area overviews", () => {
  it("show nothing until an overview has been reviewed", () => {
    expect(ALL_AREA_OVERVIEWS["bengaluru/koramangala"].reviewed).toBe(false);
    expect(getAreaOverview("Bengaluru", "Koramangala")).toBeUndefined();
  });

  it("return nothing for an area with no overview", () => {
    expect(getAreaOverview("Bengaluru", "Nowhere")).toBeUndefined();
  });

  it("make no numeric claims about prices, rents or percentages", () => {
    for (const [key, o] of Object.entries(ALL_AREA_OVERVIEWS)) {
      const all = [...o.about, ...o.gettingAround, ...o.faqs.flatMap((f) => [f.question, f.answer])].join(" ");
      expect(all, key).not.toMatch(/₹|\bRs\.?\s?\d|\d\s?%|\blakh|\bcrore/i);
    }
  });
});
