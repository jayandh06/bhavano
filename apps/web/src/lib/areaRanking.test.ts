import { describe, expect, it } from "vitest";
import type { Area } from "@bhavano/types";
import { rankAreasForLinks } from "./areaRanking";

const area = (id: string, name: string): Area => ({ id, name, cityId: "c1", lat: null, lng: null });
const AREAS = [area("1", "1st Block"), area("2", "HSR Layout"), area("3", "Jayanagar"), area("4", "Whitefield"), area("5", "Indiranagar"), area("6", "Empty Area")];
const names = (list: Area[]) => list.map((a) => a.name);

describe("rankAreasForLinks", () => {
  it("puts the areas with the most listings first, not the alphabetical ones", () => {
    const counts = { "1": 2, "2": 11, "3": 8, "4": 7, "5": 5 };
    expect(names(rankAreasForLinks(AREAS, counts))).toEqual(["HSR Layout", "Jayanagar", "Whitefield", "Indiranagar", "1st Block"]);
  });

  it("drops areas with no listings and breaks ties alphabetically", () => {
    const counts = { "2": 3, "3": 3, "4": 3, "5": 3, "1": 3 };
    expect(names(rankAreasForLinks(AREAS, counts))).toEqual(["1st Block", "HSR Layout", "Indiranagar", "Jayanagar", "Whitefield"]);
  });

  it("keeps single-listing areas only when too few areas have enough listings to be indexable", () => {
    const sparse = { "2": 1, "3": 1, "4": 1 };
    expect(names(rankAreasForLinks(AREAS, sparse))).toEqual(["HSR Layout", "Jayanagar", "Whitefield"]);
    const mixed = { "2": 4, "3": 3, "4": 2, "5": 2, "1": 1 };
    expect(names(rankAreasForLinks(AREAS, mixed))).toEqual(["HSR Layout", "Jayanagar", "Indiranagar", "Whitefield"]);
  });

  it("falls back to the original list when there is no count data", () => {
    expect(rankAreasForLinks(AREAS, {})).toBe(AREAS);
  });
});
