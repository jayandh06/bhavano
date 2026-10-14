import { describe, expect, it } from "vitest";
import type { City } from "@bhavano/types";
import { buildAudienceFilter, describeAudience, parseTags } from "./campaignAudience";

const cities = [{ id: "c1", name: "Bengaluru" }, { id: "c2", name: "Chennai" }] as City[];

describe("buildAudienceFilter", () => {
  it("omits anything not chosen", () => {
    expect(buildAudienceFilter(undefined, { tags: [], categories: [], cityIds: [] })).toEqual({});
    expect(buildAudienceFilter(undefined, { tags: ["a"], categories: [], cityIds: [] })).toEqual({ tags: ["a"] });
  });

  it("replaces the fields it edits and keeps the ones it doesn't", () => {
    const base = { tags: ["old"], businessCategories: ["pg"], cityIds: ["c9"], minRating: 4, statuses: ["new" as const] };
    const out = buildAudienceFilter(base, { tags: ["portal-agent"], categories: ["real_estate_agent"], cityIds: [] });
    expect(out).toEqual({ minRating: 4, statuses: ["new"], tags: ["portal-agent"], businessCategories: ["real_estate_agent"] });
  });

  it("clearing a field removes it", () => {
    expect(buildAudienceFilter({ tags: ["x"], cityIds: ["c1"] }, { tags: [], categories: [], cityIds: [] })).toEqual({});
  });
});

describe("describeAudience", () => {
  it("names categories, cities and tags", () => {
    expect(describeAudience({ businessCategories: ["real_estate_agent"], cityIds: ["c1", "c2"], tags: ["portal-agent"] }, cities))
      .toBe("categories real_estate_agent · cities Bengaluru, Chennai · tags portal-agent");
  });

  it("flags an empty audience and keeps unknown city ids", () => {
    expect(describeAudience({}, cities)).toBe("no audience set");
    expect(describeAudience(undefined, cities)).toBe("no audience set");
    expect(describeAudience({ cityIds: ["gone"] }, cities)).toBe("cities gone");
  });
});

describe("parseTags", () => {
  it("splits and trims", () => expect(parseTags(" a, b ,,c ")).toEqual(["a", "b", "c"]));
});
