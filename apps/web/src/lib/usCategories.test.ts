import { afterEach, describe, expect, it, vi } from "vitest";
import { marketPostCategoryGroups } from "@bhavano/types/postCategories";
import { intentCategories, INTENT_CATEGORIES } from "@bhavano/types/requirementQuestions";
import { MARKETS, isMarketCategory } from "@bhavano/types/market";
import { CATEGORY_FIELD_CONFIG, fieldIsVisible } from "@bhavano/types/categoryFields";
import { POSTABLE_TRANSACTION_TYPES } from "@bhavano/types/postingRules";

// Condo, townhouse and room for rent are US-only (docs/plans/us-categories-condo-townhouse-room.md). These pin that India sees none of them and the US sees all three.
const NEW = ["condo", "townhouse", "room"] as const;
const INDIA_CATEGORIES = ["house", "apartment", "villa", "pg", "storage", "coworking", "furniture", "interiors", "plot", "commercial"];

async function loadWith<T>(path: string, marketEnv: string): Promise<T> {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_MARKET", marketEnv);
  return (await import(path)) as T;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("market category lists", () => {
  it("leaves India's ten categories exactly as they were", () => {
    expect(MARKETS.in.categories).toEqual(INDIA_CATEGORIES);
    for (const c of NEW) expect(isMarketCategory("in", c)).toBe(false);
  });

  it("gives the US the three new categories", () => {
    for (const c of NEW) expect(isMarketCategory("us", c)).toBe(true);
  });

  it("offers them in the US posting picker and never in India's", () => {
    const us = marketPostCategoryGroups("us").flatMap((g) => g.options.map((o) => o.value));
    for (const c of NEW) expect(us).toContain(c);
    const india = marketPostCategoryGroups("in").flatMap((g) => g.options.map((o) => o.value));
    for (const c of NEW) expect(india).not.toContain(c);
    expect(india).toEqual(["house", "apartment", "villa", "plot", "pg", "commercial", "coworking", "storage"]);
  });

  it("keeps India's requirement intents as the same lists, and gives the US its own", () => {
    for (const intent of Object.keys(INTENT_CATEGORIES) as (keyof typeof INTENT_CATEGORIES)[]) {
      expect(intentCategories(intent, "in")).toBe(INTENT_CATEGORIES[intent]);
    }
    expect(INTENT_CATEGORIES.buy).toEqual(["house", "apartment", "villa", "plot", "commercial"]);
    expect(INTENT_CATEGORIES.rentLease).toEqual(["house", "apartment", "villa", "commercial", "storage"]);
    expect(intentCategories("buy", "us")).toEqual(["house", "condo", "townhouse", "manufactured", "multifamily", "plot", "commercial"]);
    expect(intentCategories("rentLease", "us")).toEqual(["house", "apartment", "condo", "townhouse", "manufactured", "room", "commercial", "storage"]);
    expect(intentCategories("pg", "us")).toEqual([]);
  });
});

describe("posting rules and fields", () => {
  it("lets condo and townhouse be sold, rented and leased, and a room only rented", () => {
    expect(POSTABLE_TRANSACTION_TYPES.condo).toEqual(["sell", "rent", "lease"]);
    expect(POSTABLE_TRANSACTION_TYPES.townhouse).toEqual(["sell", "rent", "lease"]);
    expect(POSTABLE_TRANSACTION_TYPES.room).toEqual(["rent"]);
  });

  it("gives condo and townhouse the residential fields", () => {
    expect(CATEGORY_FIELD_CONFIG.condo).toBe(CATEGORY_FIELD_CONFIG.apartment);
    expect(CATEGORY_FIELD_CONFIG.townhouse).toBe(CATEGORY_FIELD_CONFIG.house);
  });

  it("does not make a US poster pick the Vastu 'entrance facing' (a required field), while India still asks for it", () => {
    for (const category of ["house", "apartment", "villa", "condo", "townhouse"] as const) {
      const field = CATEGORY_FIELD_CONFIG[category].find((f) => f.key === "entranceFacing");
      expect(field?.required, category).toBe(true);
      expect(fieldIsVisible(field!, "rent", {}, "us"), `${category} US`).toBe(false);
      expect(fieldIsVisible(field!, "rent", {}, "in"), `${category} India`).toBe(true);
    }
  });

  it("gives the room a short set with no field about who may rent (Fair Housing)", () => {
    const keys = CATEGORY_FIELD_CONFIG.room.map((f) => f.key);
    expect(keys).toEqual(["roomType", "bathroom", "furnished", "utilitiesIncluded", "availableFrom", "petsAllowed"]);
    for (const hidden of MARKETS.us.hiddenFieldKeys) expect(keys).not.toContain(hidden);
    expect(CATEGORY_FIELD_CONFIG.room.filter((f) => f.required).map((f) => f.key)).toEqual(["roomType", "bathroom", "furnished"]);
  });
});

describe("search words", () => {
  type Parse = typeof import("./parseSearchQuery");

  it("does not turn an Indian search into a US category (condo and room words are US-only)", async () => {
    const { parseSearchQuery } = await loadWith<Parse>("./parseSearchQuery", "");
    expect(parseSearchQuery("condo for rent in Pune").category).toBeUndefined();
    expect(parseSearchQuery("room for rent in Pune").category).toBeUndefined();
    // Unchanged from before: "townhouse" has no word boundary inside it, so it never matched "house" in India's parser.
    expect(parseSearchQuery("townhouse for sale").category).toBeUndefined();
    expect(parseSearchQuery("2 bhk apartment for rent").category).toBe("apartment");
    expect(parseSearchQuery("PG in HSR Layout").category).toBe("pg");
    expect(parseSearchQuery("plot for sale").category).toBe("plot");
  });

  it("reads the US words as the new categories", async () => {
    const { parseSearchQuery } = await loadWith<Parse>("./parseSearchQuery", "us");
    expect(parseSearchQuery("Condos for rent in Austin")).toMatchObject({ category: "condo", transactionGroup: "rent-lease" });
    expect(parseSearchQuery("2 bed condo")).toMatchObject({ category: "condo", bedrooms: 2 });
    expect(parseSearchQuery("Townhouses for sale in Denver")).toMatchObject({ category: "townhouse", transactionGroup: "buy" });
    expect(parseSearchQuery("town house for sale")).toMatchObject({ category: "townhouse" });
    expect(parseSearchQuery("Rooms for rent in Seattle")).toMatchObject({ category: "room", transactionGroup: "rent-lease" });
    expect(parseSearchQuery("private room available")).toMatchObject({ category: "room" });
    expect(parseSearchQuery("roommate wanted")).toMatchObject({ category: "room" });
  });

  it("never mistakes a bedroom count for a room, and still finds houses and apartments", async () => {
    const { parseSearchQuery } = await loadWith<Parse>("./parseSearchQuery", "us");
    expect(parseSearchQuery("2 bedroom apartment")).toMatchObject({ category: "apartment", bedrooms: 2 });
    expect(parseSearchQuery("3 bed house for rent")).toMatchObject({ category: "house", bedrooms: 3 });
    expect(parseSearchQuery("pg in Austin").category).toBeUndefined();
  });
});

describe("menus", () => {
  type Home = typeof import("./homeCategories");
  const values = (tabs: ReturnType<() => Home["HOME_TABS"]>, tab: string) => tabs.find((t) => t.value === tab)!.column1.map((c) => c.value);

  it("keeps India's Buy and Rent & Lease menus exactly as they were, with BHK wording", async () => {
    const { HOME_TABS } = await loadWith<Home>("./homeCategories", "");
    expect(values(HOME_TABS, "buy")).toEqual(["house", "apartment", "villa", "plot", "commercial"]);
    expect(values(HOME_TABS, "rentLease")).toEqual(["house", "apartment", "villa", "storage", "commercial"]);
    const house = HOME_TABS.find((t) => t.value === "buy")!.column1[0];
    expect(house.links("Pune")[1].label).toBe("Buy 2 BHK House in Pune");
  });

  it("adds condo, townhouse and room to the US menus, with bed wording", async () => {
    const { HOME_TABS } = await loadWith<Home>("./homeCategories", "us");
    expect(values(HOME_TABS, "buy")).toEqual(["house", "condo", "townhouse", "manufactured", "multifamily", "plot", "commercial"]);
    expect(values(HOME_TABS, "rentLease")).toEqual(["house", "apartment", "condo", "townhouse", "manufactured", "room", "storage", "commercial"]);
    expect(HOME_TABS.find((t) => t.value === "rentLease")!.label).toBe("Rent");
    const condo = HOME_TABS.find((t) => t.value === "buy")!.column1.find((c) => c.value === "condo")!;
    expect(condo.links("Austin")[1].label).toBe("Buy 2 bed Condo in Austin");
    expect(condo.href!("Austin")).toBe("/austin-tx/buy/condo");
  });

  it("offers no PG or Coworking in the US, and still offers them in India", async () => {
    const us = (await loadWith<Home>("./homeCategories", "us")).HOME_TABS.map((t) => t.value);
    expect(us).toEqual(["all", "buy", "rentLease"]);
    const india = (await loadWith<Home>("./homeCategories", "")).HOME_TABS.map((t) => t.value);
    expect(india).toEqual(["all", "buy", "rentLease", "pg", "coworking"]);
  });
});

describe("US addresses", () => {
  type Seo = typeof import("./seoRoute");
  type Paths = typeof import("./listingPath");

  it("sends villas to houses and apartments for sale to condos, and leaves every India address alone", async () => {
    const { retiredPathSegments } = await loadWith<Seo>("./seoRoute", "us");
    expect(retiredPathSegments(["austin-tx", "buy", "apartment", "2bhk"])).toEqual(["austin-tx", "buy", "condo", "2bhk"]);
    expect(retiredPathSegments(["buy", "apartment"])).toEqual(["buy", "condo"]);
    expect(retiredPathSegments(["austin-tx", "downtown", "rent-lease", "villa"])).toEqual(["austin-tx", "downtown", "rent-lease", "house"]);
    expect(retiredPathSegments(["austin-tx", "rent-lease", "apartment"])).toBeNull();
    expect(retiredPathSegments(["austin-tx", "buy", "house"])).toBeNull();
    const india = await loadWith<Seo>("./seoRoute", "");
    expect(india.retiredPathSegments(["pune", "buy", "apartment"])).toBeNull();
    expect(india.retiredPathSegments(["pune", "buy", "villa"])).toBeNull();
  });

  it("keeps the US apartment rental address as it was, and does not turn a purchase search into rentals", async () => {
    const { buildBrowsePath } = await loadWith<Paths>("./listingPath", "us");
    expect(buildBrowsePath({ cityName: "Austin", transactionGroup: "rent-lease", category: "apartment" })).toMatch(/\/rent-lease\/apartment$/);
    expect(buildBrowsePath({ cityName: "Austin", category: "apartment" })).toMatch(/\/rent-lease\/apartment$/);
    expect(buildBrowsePath({ cityName: "Austin", transactionGroup: "buy", category: "apartment" })).toMatch(/\/buy\/apartment$/);
    const india = await loadWith<Paths>("./listingPath", "");
    expect(india.buildBrowsePath({ cityName: "Pune", category: "apartment" })).toBe("/pune/apartment");
  });
});

describe("multi-family and land", () => {
  type Seo = typeof import("./seoRoute");
  type Paths = typeof import("./listingPath");
  type Parse = typeof import("./parseSearchQuery");

  it("calls a plot Land in the US only", async () => {
    expect((await loadWith<Seo>("./seoRoute", "us")).CATEGORY_LABELS.plot).toBe("Land");
    expect((await loadWith<Seo>("./seoRoute", "")).CATEGORY_LABELS.plot).toBe("Plots");
  });

  it("gives each a browse address", async () => {
    const { buildBrowsePath } = await loadWith<Paths>("./listingPath", "us");
    expect(buildBrowsePath({ cityName: "Austin", transactionGroup: "buy", category: "multifamily" })).toMatch(/\/multifamily$/);
    expect(buildBrowsePath({ cityName: "Austin", transactionGroup: "buy", category: "plot" })).toMatch(/\/plot$/);
  });

  it("reads the US words, and not in India", async () => {
    const us = (await loadWith<Parse>("./parseSearchQuery", "us")).parseSearchQuery;
    for (const words of ["duplex for sale in Austin", "multi family in Austin", "apartment building for sale"])
      expect(us(words).category, words).toBe("multifamily");
    expect(us("land for sale in Austin").category).toBe("plot");
    expect(us("2 bed apartment").category).toBe("apartment");
    const india = (await loadWith<Parse>("./parseSearchQuery", "")).parseSearchQuery;
    expect(india("duplex in Pune").category).toBeUndefined();
    expect(india("apartment complex in Pune").category).toBe("apartment");
  });
});

describe("US search filters", () => {
  type Filters = typeof import("./assetFilters");
  type Apply = typeof import("./filterApply");
  type Parse = typeof import("./parseSearchQuery");

  it("appear for the US form's answers, and never in India", async () => {
    const us = (await loadWith<Filters>("./assetFilters", "us")).assetFiltersFor;
    expect(us("apartment").map((f) => f.key)).toEqual(expect.arrayContaining(["furnished", "laundry", "parkingType", "petPolicy"]));
    expect(us("commercial").map((f) => f.key)).toContain("purpose");
    expect(us("plot").map((f) => f.key)).toEqual(["plotType"]);
    const india = (await loadWith<Filters>("./assetFilters", "")).assetFiltersFor;
    for (const category of ["apartment", "commercial", "plot", "storage"] as const)
      for (const key of ["laundry", "purpose", "plotType", "storageType"]) expect(india(category).map((f) => f.key)).not.toContain(key);
  });

  it("are cleared by Reset and counted on the Filters button", async () => {
    const { buildResetUrl, activeFilterCount } = await loadWith<Apply>("./filterApply", "us");
    const base = {
      urlMode: "path",
      intent: "rentLease",
      cityName: "Austin",
      category: "apartment",
      areas: [],
      search: "laundry=in-unit&petPolicy=dogs",
    } as unknown as Parameters<Apply["buildResetUrl"]>[0];
    expect(buildResetUrl(base)).not.toMatch(/laundry|petPolicy/);
    expect(activeFilterCount(base)).toBeGreaterThanOrEqual(2);
  });

  it("reads a mobile home as a manufactured home", async () => {
    const us = (await loadWith<Parse>("./parseSearchQuery", "us")).parseSearchQuery;
    for (const words of ["mobile home for sale", "manufactured homes in Austin"]) expect(us(words).category, words).toBe("manufactured");
  });
});

describe("US money and bedroom wording", () => {
  type Seo = typeof import("./seoRoute");
  type Price = typeof import("./priceInput");
  type Filters = typeof import("./assetFilters");
  type Apply = typeof import("./filterApply");

  it("writes dollars in the US and rupees in India", async () => {
    const us = await loadWith<Seo>("./seoRoute", "us");
    expect([900, 25_000, 1_500_000].map(us.formatINR)).toEqual(["$900", "$25k", "$1.5M"]);
    const usPrice = await loadWith<Price>("./priceInput", "us");
    expect(usPrice.customPriceLabel(1_000, 25_000)).toBe("$1k – $25k");
    const india = await loadWith<Seo>("./seoRoute", "");
    expect([900, 25_000, 1_500_000].map(india.formatINR)).toEqual(["₹900", "₹25k", "₹15L"]);
  });

  it("reads millions in the US and lakh and crore in India", async () => {
    const us = (await loadWith<Price>("./priceInput", "us")).parseAmount;
    expect([us("1.5M"), us("$20k"), us("2,000"), us("2L")]).toEqual([1_500_000, 20_000, 2_000, undefined]);
    const india = (await loadWith<Price>("./priceInput", "")).parseAmount;
    expect([india("2L"), india("1.5Cr"), india("₹20k"), india("1.5M")]).toEqual([200_000, 15_000_000, 20_000, undefined]);
  });

  it("says beds, not BHK", async () => {
    const us = await loadWith<Seo>("./seoRoute", "us");
    expect(us.buildHeading({ fallbackLabel: "Properties", cityName: "Austin", propertyType: "apartment", bedrooms: 2 })).toContain("2 bed Apartments");
    const filters = await loadWith<Filters>("./assetFilters", "us");
    expect(filters.assetFiltersFor("apartment").find((f) => f.key === "bedrooms")?.label).toBe("Bedrooms");
    const apply = await loadWith<Apply>("./filterApply", "us");
    expect(apply.draftIssue({ bhk: [] })).toBe("Pick at least one bedroom count");
    const india = await loadWith<Seo>("./seoRoute", "");
    expect(india.buildHeading({ fallbackLabel: "Properties", cityName: "Pune", propertyType: "apartment", bedrooms: 2 })).toContain("2 BHK Apartments");
  });
});

