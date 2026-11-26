import { afterEach, describe, expect, it, vi } from "vitest";
import { marketPostCategoryGroups } from "@bhavano/types/postCategories";
import { intentCategories, INTENT_CATEGORIES } from "@bhavano/types/requirementQuestions";
import { MARKETS, isMarketCategory } from "@bhavano/types/market";
import { CATEGORY_FIELD_CONFIG } from "@bhavano/types/categoryFields";
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
    expect(intentCategories("buy", "us")).toEqual(["house", "apartment", "condo", "townhouse", "villa", "commercial"]);
    expect(intentCategories("rentLease", "us")).toEqual(["house", "apartment", "condo", "townhouse", "room", "villa", "commercial", "storage"]);
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
    expect(values(HOME_TABS, "buy")).toEqual(["house", "apartment", "condo", "townhouse", "villa", "plot", "commercial"]);
    expect(values(HOME_TABS, "rentLease")).toEqual(["house", "apartment", "condo", "townhouse", "room", "villa", "storage", "commercial"]);
    const condo = HOME_TABS.find((t) => t.value === "buy")!.column1.find((c) => c.value === "condo")!;
    expect(condo.links("Austin")[1].label).toBe("Buy 2 bed Condo in Austin");
    expect(condo.href!("Austin")).toBe("/austin/buy/condo");
  });
});
