import { REQUIREMENT_INTENTS, budgetPresetsFor, formatCompactInr } from "@bhavano/types/requirementQuestions";
import { MARKETS } from "@bhavano/types/market";
import { HOME_TABS, homeTabs } from "../components/home/categories";
import { bedroomListText, bedroomText, budgetChoices, compactMoney, requirementCategoriesFor, requirementIntentsFor, savedSearchMoney, spell } from "./marketText";

describe("India is exactly as before", () => {
  it("keeps its menus, wording and choices", () => {
    expect(homeTabs("in")).toBe(HOME_TABS);
    expect(requirementIntentsFor("in")).toBe(REQUIREMENT_INTENTS);
    expect(bedroomText(2, "in")).toBe("2 BHK");
    expect(bedroomListText([1, 2], " or ", "in")).toBe("1 or 2 BHK");
    expect(spell("Favourites", "in")).toBe("Favourites");
    for (const amount of [900, 25_000, 150_000, 20_000_000]) expect(compactMoney(amount, "in")).toBe(formatCompactInr(amount));
    expect(savedSearchMoney(4_500_000, "in")).toBe("₹45L");
    expect(savedSearchMoney(1_500, "in")).toBe("₹1.5K");
    expect(budgetChoices("apartment", "rent", "in")).toEqual(budgetPresetsFor("apartment", "rent"));
  });

  it("keeps payments, phone codes, India content and the ticked consent box", () => {
    expect(MARKETS.in).toMatchObject({ paymentsEnabled: true, phoneOtpAvailable: true, indiaContent: true, contactConsentPreTicked: true });
  });
});

describe("the US", () => {
  it("has no payments, phone codes, India content or ticked consent box", () => {
    expect(MARKETS.us).toMatchObject({ paymentsEnabled: false, phoneOtpAvailable: false, indiaContent: false, contactConsentPreTicked: false });
  });

  it("offers its own categories: no PG, coworking or plots, with condo, townhouse and room", () => {
    const tabs = homeTabs("us");
    expect(tabs.map((t) => t.value)).toEqual(["all", "buy", "rentLease"]);
    const offered = tabs.flatMap((t) => t.subFilter.options.map((o) => o.value));
    expect(offered).toEqual(expect.arrayContaining(["condo", "townhouse", "room"]));
    expect(offered).not.toContain("plot");
    // Every category offered is one the market can post.
    for (const value of offered) expect(MARKETS.us.categories).toContain(value);
  });

  it("asks about requirements only for what it can post", () => {
    expect(requirementIntentsFor("us").map((i) => i.value)).toEqual(["buy", "rentLease"]);
    for (const intent of requirementIntentsFor("us")) {
      for (const category of requirementCategoriesFor(intent.value, "us")) expect(MARKETS.us.categories).toContain(category);
    }
  });

  it("writes beds, dollars and American spelling, and offers no rupee budget bands", () => {
    expect(bedroomText(5, "us")).toBe("5+ bed");
    expect(spell("Favourites", "us")).toBe("Favorites");
    expect([compactMoney(900, "us"), compactMoney(2_500, "us"), compactMoney(1_250_000, "us")]).toEqual(["$900", "$2.5k", "$1.25M"]);
    expect(savedSearchMoney(450_000, "us")).toBe("$450k");
    expect(budgetChoices("apartment", "rent", "us")).toEqual({ unit: budgetPresetsFor("apartment", "rent").unit, presets: [] });
  });
});
