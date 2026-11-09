import { describe, expect, it } from "vitest";
import type { Area } from "@bhavano/types";
import { activeFilterCount, buildAppliedUrl, buildResetUrl, currentAreaIds, draftIssue, type FilterBase } from "./filterApply";

const area = (id: string, name: string) => ({ id, name }) as Area;
const AREAS = [area("a1", "Koramangala"), area("a2", "Whitefield"), area("a3", "Indiranagar")];

const browse = (over: Partial<FilterBase> = {}): FilterBase => ({
  urlMode: "path",
  cityName: "Bengaluru",
  areas: AREAS,
  segments: { transactionGroup: "buy", category: "apartment" },
  intent: "buy",
  category: "apartment",
  search: "",
  ...over,
});

describe("buildAppliedUrl on a browse page", () => {
  it("an empty draft leaves the page as it is", () => {
    expect(buildAppliedUrl(browse(), {})).toBe("/bengaluru/buy/apartment");
    expect(buildAppliedUrl(browse({ search: "furnished=semi&sort=price_asc" }), {})).toBe("/bengaluru/buy/apartment?furnished=semi&sort=price_asc");
  });

  it("writes area, BHK and price changes together in one URL", () => {
    const url = buildAppliedUrl(browse(), { areas: ["a1", "a2"], bhk: [2, 3], price: { min: "20k", max: "" } });
    expect(url).toBe("/bengaluru/buy/apartment?minPrice=20000&areas=a1%2Ca2&bedrooms=2%2C3");
  });

  it("a single area and a single BHK become path segments", () => {
    expect(buildAppliedUrl(browse(), { areas: ["a2"], bhk: [3] })).toBe("/bengaluru/whitefield/buy/apartment/3bhk");
  });

  it("all areas and all BHK drop back to the plain path", () => {
    const base = browse({ search: "areas=a1%2Ca2&bedrooms=2%2C3" });
    expect(buildAppliedUrl(base, { areas: ["a1", "a2", "a3"], bhk: [1, 2, 3, 4, 5] })).toBe("/bengaluru/buy/apartment");
  });

  it("changing the asset rebuilds the path and drops a BHK choice the new asset cannot hold", () => {
    const base = browse({ search: "bedrooms=2%2C3", segments: { transactionGroup: "buy", category: "apartment" } });
    expect(buildAppliedUrl(base, { asset: { asset: "plot" } })).toBe("/bengaluru/plot");
  });

  it("clears a query filter with an undefined value, and returns to page 1", () => {
    expect(buildAppliedUrl(browse({ search: "furnished=semi&page=3" }), { query: { furnished: undefined } })).toBe("/bengaluru/buy/apartment");
  });

  it("reads the single area from the path", () => {
    const base = browse({ segments: { transactionGroup: "buy", category: "apartment", areaSlug: "whitefield" } });
    expect(currentAreaIds(base)).toEqual(["a2"]);
    expect(buildAppliedUrl(base, { bhk: [3] })).toBe("/bengaluru/whitefield/buy/apartment/3bhk");
  });
});

describe("buildAppliedUrl on the homepage", () => {
  const home = (over: Partial<FilterBase> = {}): FilterBase => ({ urlMode: "query", cityName: "Bengaluru", areas: AREAS, intent: "buy", search: "", ...over });

  it("keeps everything in the query string", () => {
    expect(buildAppliedUrl(home(), { areas: ["a1"] })).toBe("/?areas=a1");
    expect(buildAppliedUrl(home({ category: "apartment" }), { bhk: [2] })).toBe("/?bedrooms=2");
  });

  it("changing the asset goes to its browse path", () => {
    expect(buildAppliedUrl(home(), { asset: { asset: "apartment" } })).toBe("/bengaluru/buy/apartment");
  });
});

describe("draftIssue", () => {
  it("needs at least one area and one BHK, and a sensible price", () => {
    expect(draftIssue({ areas: [] })).toBe("Pick at least one area");
    expect(draftIssue({ bhk: [] })).toBe("Pick at least one BHK");
    expect(draftIssue({ price: { min: "abc", max: "" } })).toMatch(/price/i);
    expect(draftIssue({ price: { min: "30k", max: "20k" } })).toMatch(/less than/);
    expect(draftIssue({ areas: ["a1"], bhk: [2], price: { min: "20k", max: "30k" } })).toBeNull();
    expect(draftIssue({})).toBeNull();
  });
});

describe("buildResetUrl", () => {
  it("clears every filter but keeps the city, the tab and the search text", () => {
    const base = browse({ search: "q=garden&areas=a1&bedrooms=2&minPrice=20000&furnished=semi&sort=price_asc&page=2" });
    expect(buildResetUrl(base)).toBe("/bengaluru/buy?q=garden&sort=price_asc");
  });
});

describe("activeFilterCount", () => {
  it("counts each narrowing once and ignores defaults", () => {
    expect(activeFilterCount(browse({ segments: { transactionGroup: "buy" }, category: undefined }))).toBe(0);
    // asset chosen (1) + one BHK bucket (1) + price (1) + furnishing (1) + owners only (1) + two of the three areas (1)
    const base = browse({ segments: { transactionGroup: "buy", category: "apartment", facetValue: 3 }, search: "areas=a1%2Ca2&minPrice=20000&furnished=semi&postedBy=owner" });
    expect(activeFilterCount(base)).toBe(6);
  });
});
