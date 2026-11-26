import { afterEach, describe, expect, it, vi } from "vitest";
import { homeFaqs, homeSteps, HOME_STEPS } from "@bhavano/types/homeContent";
import { marketCopy, spell, type MarketCopy } from "./marketCopy";

// Words that must not appear anywhere in the US copy: India, its units and categories, its festival, and the rupee.
const INDIA_ONLY = /India|Indian|BHK|₹|lakh|crore|\bPG\b|\bplots?\b|coworking|Diwali|rupee|favourite|bachelor|\bveg\b/i;

function allStrings(copy: MarketCopy): string[] {
  const out: string[] = [];
  for (const value of Object.values(copy)) {
    if (typeof value === "string") out.push(value);
  }
  out.push(copy.citiesIntro("12"), copy.searchPlaceholder("Austin"), copy.searchPlaceholder("Austin", "Hyde Park"), ...copy.searchExampleChips("Austin", "Hyde Park"));
  return out;
}

describe("marketCopy: India is exactly what the components hardcoded", () => {
  const c = marketCopy("in");

  it("keeps the site title, description and social wording", () => {
    expect(c.siteTitle).toBe("Bhavano — Buy, Rent, Plots, Coworking, PG & More");
    expect(c.siteDescription).toBe(
      "India's home for Buy, Rent, Villas, Plots, Commercial Spaces, Coworking and PG listings — browse without login. Every listing is checked before it goes live.",
    );
    expect(c.ogLocale).toBe("en_IN");
    expect(c.htmlLang).toBe("en");
    expect(c.areaServed).toBe("India");
    expect(c.ogTagline).toBe("Buy · Rent · Villas · Plots · Coworking · PG · Commercial");
    expect(c.headerTagline).toBe("India's home for Buy · Rent · Villas · Plots · Coworking · PG · Commercial");
  });

  it("keeps the home page wording", () => {
    expect(c.homeHeading).toBe("Buy, rent and list property across India");
    expect(c.anywhere).toBe("India");
    expect(c.homeIntro).toBe(
      "Bhavano is India's classifieds marketplace for buying, selling, renting and leasing homes, plots, commercial space, coworking desks, PG stays and furniture. Sign in with Google or your phone number only when you want to post a listing, save a favourite, or message a seller — we use your account solely to power those features.",
    );
    expect(c.homeIntroShort).toBe("Buy, rent, sell & lease — free, no brokerage, message sellers directly.");
    expect(c.footerBlurb).toBe(
      "Verified listings to buy, rent or lease houses, apartments, villas, plots, coworking desks, commercial spaces and PG accommodation across India — no login needed to browse.",
    );
    expect(c.ownerBlurb).toBe(
      "List a house, flat, plot, PG, coworking desk or commercial space and reach people searching in your city. You deal directly with seekers.",
    );
  });

  it("keeps the search hints, Cities, Help and 404 wording", () => {
    expect(c.searchPlaceholder("Bengaluru")).toBe('Search "2BHK in Bengaluru", "PG near IT park", "plot for sale"…');
    expect(c.searchPlaceholder("Bengaluru", "Koramangala")).toBe('Search "2BHK in Koramangala, Bengaluru", "villa for rent"…');
    expect(c.searchExampleChips("Bengaluru", "Koramangala")).toEqual([
      "2 BHK in Koramangala",
      "Villas for rent in Bengaluru",
      "PG in Bengaluru",
      "Coworking in Bengaluru",
    ]);
    expect(c.citiesDescription).toBe("Every city Bhavano covers for buying, renting, and leasing property across India.");
    expect(c.citiesIntro("37")).toBe(
      "37 cities across India — pick one to browse houses, apartments, villas, plots, PG accommodation, coworking desks and commercial spaces there.",
    );
    expect(c.notFoundBrowse).toBe("Browse homes, rentals, villas, plots, PG, coworking, commercial spaces");
    expect(c.notFoundExampleCities).toBe(true);
    expect(c.helpAbout).toBe(
      "Bhavano is a property marketplace for homes, plots, PG accommodation, coworking desks, storage space and commercial space across India, so a move or a small-business setup can be handled in one place.",
    );
  });

  it("keeps India-only content, the listings-checked claim and the India organization markup on", () => {
    expect(c.indiaContent).toBe(true);
    expect(c.listingsCheckedClaim).toBe(true);
    expect(c.indiaOrganization).toBe(true);
    expect(c.phoneOtpLogin).toBe(true);
  });
});

describe("marketCopy: the US names nothing India-only", () => {
  const c = marketCopy("us");

  it("has no India, rupee, BHK, PG, plot, coworking or festival wording in any string", () => {
    for (const text of allStrings(c)) expect(text, text).not.toMatch(INDIA_ONLY);
  });

  it("says what the US site is, and turns the India-only parts off", () => {
    expect(c.siteTitle).toBe("Bhavano — Homes for Rent and Sale");
    expect(c.ogLocale).toBe("en_US");
    expect(c.htmlLang).toBe("en-US");
    expect(c.areaServed).toBe("United States");
    expect(c.indiaContent).toBe(false);
    expect(c.listingsCheckedClaim).toBe(false);
    expect(c.indiaOrganization).toBe(false);
    expect(c.notFoundExampleCities).toBe(false);
    expect(c.phoneOtpLogin).toBe(false);
  });

  it("makes no claim about moderation, paid boosts or phone sign-in", () => {
    for (const text of allStrings(c)) expect(text, text).not.toMatch(/checked before|verified|boost|phone number/i);
  });
});

describe("marketCopy: choosing the market", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is India when nothing is set or the value is unknown, so a missing variable never changes India", () => {
    vi.stubEnv("NEXT_PUBLIC_MARKET", "");
    vi.stubEnv("MARKET", "");
    expect(marketCopy().siteTitle).toBe(marketCopy("in").siteTitle);
    expect(marketCopy("zz").siteTitle).toBe(marketCopy("in").siteTitle);
  });

  it("follows the build's market when none is passed", () => {
    vi.stubEnv("NEXT_PUBLIC_MARKET", "us");
    expect(marketCopy().siteTitle).toBe("Bhavano — Homes for Rent and Sale");
  });
});

describe("spell", () => {
  it("leaves India's text exactly as written", () => {
    expect(spell("Favourites", "in")).toBe("Favourites");
    expect(spell("Log in to see the listings you've favourited.", "in")).toBe("Log in to see the listings you've favourited.");
    expect(spell("No favourites yet", "zz")).toBe("No favourites yet");
  });

  it("gives the US spelling, keeping capitals and endings", () => {
    expect(spell("Favourites", "us")).toBe("Favorites");
    expect(spell("Your favourites", "us")).toBe("Your favorites");
    expect(spell("you've favourited", "us")).toBe("you've favorited");
    expect(spell("saved favourite(s)", "us")).toBe("saved favorite(s)");
    expect(spell("Favourite", "us")).toBe("Favorite");
  });
});

describe("home content (shared with the mobile app)", () => {
  it("is unchanged for India, including the default", () => {
    expect(homeSteps("in")).toEqual(HOME_STEPS);
    expect(homeSteps()).toEqual(HOME_STEPS);
    expect(HOME_STEPS[2].text).toBe("Message the owner or agent on Bhavano. Log in with Google or your phone number only when you post, save or message.");
    const india = homeFaqs(["Bengaluru", "Mumbai"]);
    expect(india).toEqual(homeFaqs(["Bengaluru", "Mumbai"], "in"));
    expect(india[0].answer).toBe(
      "Bhavano is an online marketplace in India where you can buy, sell, rent or lease homes, plots, PG rooms, coworking desks, storage and commercial space. Browsing is free and needs no login.",
    );
    expect(india[4].answer).toBe("Bhavano has listings in cities across India, including Bengaluru and Mumbai. Use the city picker to browse a city.");
    expect(homeFaqs([])[4].answer).toBe("Bhavano has listings in cities across India, across India. Use the city picker to browse a city.");
    expect(india).toHaveLength(6);
  });

  it("names nothing India-only for the US, and is honest that the US is starting small", () => {
    const texts = [...homeSteps("us").flatMap((s) => [s.title, s.text]), ...homeFaqs([], "us").flatMap((f) => [f.question, f.answer]), ...homeFaqs(["Austin", "Denver"], "us").flatMap((f) => [f.answer])];
    for (const text of texts) expect(text, text).not.toMatch(INDIA_ONLY);
    for (const text of texts) expect(text, text).not.toMatch(/checked listings before|checks listings before|boosting|phone number/i);
    expect(homeFaqs([], "us")[4].answer).toBe("Bhavano is starting with a small number of US cities. Use the city picker to browse a city.");
    expect(homeFaqs(["Austin", "Denver"], "us")[4].answer).toBe("Bhavano has listings in cities including Austin and Denver. Use the city picker to browse a city.");
    expect(homeFaqs([], "us")).toHaveLength(6);
  });
});
