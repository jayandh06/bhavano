import { describe, expect, it } from "vitest";
import type { ListingSitemapEntry } from "@bhavano/types";
import { buildBrowseInventory } from "./linkInventory";
import { buildBrowsePath } from "./listingPath";

const entry = (over: Partial<ListingSitemapEntry>): ListingSitemapEntry => ({
  id: "1",
  slug: "x",
  category: "apartment",
  transactionType: "rent",
  cityName: "Pune",
  area: "Wakad",
  updatedAt: "2026-10-01T00:00:00Z",
  bedrooms: 2,
  ...over,
});

describe("buildBrowseInventory", () => {
  it("lists the city, group, category, area+category and bedroom pages that have a listing", () => {
    const inv = buildBrowseInventory([entry({})]);
    expect(inv.has(buildBrowsePath({ cityName: "Pune" }))).toBe(true);
    expect(inv.has(buildBrowsePath({ cityName: "Pune", transactionGroup: "rent-lease", category: "apartment" }))).toBe(true);
    expect(inv.has(buildBrowsePath({ cityName: "Pune", areaName: "Wakad", transactionGroup: "rent-lease", category: "apartment" }))).toBe(true);
    expect(inv.has(buildBrowsePath({ cityName: "Pune", transactionGroup: "rent-lease", category: "apartment", facetValue: 2 }))).toBe(true);
  });

  it("does not list a bedroom count or area nobody has, nor a thin plain area page", () => {
    const inv = buildBrowseInventory([entry({})]);
    expect(inv.has(buildBrowsePath({ cityName: "Pune", transactionGroup: "rent-lease", category: "apartment", facetValue: 4 }))).toBe(false);
    expect(inv.has(buildBrowsePath({ cityName: "Pune", areaName: "Aundh", transactionGroup: "rent-lease", category: "apartment" }))).toBe(false);
    // one listing in the area: the plain area page is thin (noindex), so it is not linked
    expect(inv.has(buildBrowsePath({ cityName: "Pune", areaName: "Wakad" }))).toBe(false);
  });

  it("lists a plain area page once it has the minimum number of listings, and caps bedrooms at the top facet", () => {
    const inv = buildBrowseInventory([entry({ id: "1" }), entry({ id: "2", bedrooms: 7 })]);
    expect(inv.has(buildBrowsePath({ cityName: "Pune", areaName: "Wakad" }))).toBe(true);
    expect(inv.has(buildBrowsePath({ cityName: "Pune", transactionGroup: "rent-lease", category: "apartment", facetValue: 5 }))).toBe(true);
  });
});
