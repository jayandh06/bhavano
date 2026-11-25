import type { MarketId } from "@bhavano/types/market";
import { buildMarket } from "@/lib/marketRobots";

/**
 * The website's market-specific wording: the title and description, the home page headline and intro, the header and footer taglines,
 * search hints, and which India-only content (calculators, blog, the moving guide, the Diwali banner) is offered. Everything that used to say
 * "India" or name an India-only category in a string lives here, so the US build can say its own thing while India reads exactly as before.
 *
 * India's values are the strings that were hardcoded in the components (marketCopy.test.ts pins them); the US values name no India-only category, unit
 * or festival and make no claim the US site cannot back yet (moderation, paid boosts, phone sign-in). The legal entity, Terms, Privacy, About and Trust
 * text are not here: they need US legal text (docs/plans/us-market-expansion.md).
 */
export interface MarketCopy {
  /** Site title and description (the root metadata, JSON-LD and social cards). */
  siteTitle: string;
  siteDescription: string;
  /** Open Graph locale and the `<html lang>`. */
  ogLocale: string;
  htmlLang: string;
  /** The country named in structured data. */
  areaServed: string;
  /** The line under the logo in the social card. */
  ogTagline: string;
  /** The line in the green bar above the header. */
  headerTagline: string;
  /** The home page H1 (plain home view) and the place named when no city is chosen ("Rent & Lease in India"). */
  homeHeading: string;
  anywhere: string;
  /** The home page intro (wide screens) and its one-line version (phones). */
  homeIntro: string;
  homeIntroShort: string;
  /** The footer blurb, the "own or manage a property" blurb, and the Help page's opening sentence. */
  footerBlurb: string;
  ownerBlurb: string;
  helpAbout: string;
  /** The Help page's "What can I list?" answer. */
  helpWhatCanIList: string;
  /** The Browse Cities page's description and intro; `count` is already formatted. */
  citiesDescription: string;
  citiesIntro: (count: string) => string;
  /** The 404 page's first suggestion, and whether to show the two example city links (the US has no cities seeded yet). */
  notFoundBrowse: string;
  notFoundExampleCities: boolean;
  /** The search box hints. */
  searchPlaceholder: (cityLabel: string, areaName?: string) => string;
  searchExampleChips: (cityLabel: string, place: string) => string[];
  /** The site says every listing is checked before it goes live (true of India's moderation; the US has no moderation set up yet, so it makes no such claim). */
  listingsCheckedClaim: boolean;
  /** India-only content is offered: the calculators, blog and guides, the moving guide, and the Diwali banner. Off in the US. */
  indiaContent: boolean;
  /** Link to the India app store listing in structured data (`sameAs`) and the legal-entity fields in the Organization markup. */
  indiaOrganization: boolean;
}

const COPY: Record<MarketId, MarketCopy> = {
  in: {
    siteTitle: "Bhavano — Buy, Rent, Plots, Coworking, PG & More",
    siteDescription:
      "India's home for Buy, Rent, Villas, Plots, Commercial Spaces, Coworking and PG listings — browse without login. Every listing is checked before it goes live.",
    ogLocale: "en_IN",
    htmlLang: "en",
    areaServed: "India",
    ogTagline: "Buy · Rent · Villas · Plots · Coworking · PG · Commercial",
    headerTagline: "India's home for Buy · Rent · Villas · Plots · Coworking · PG · Commercial",
    homeHeading: "Buy, rent and list property across India",
    anywhere: "India",
    homeIntro:
      "Bhavano is India's classifieds marketplace for buying, selling, renting and leasing homes, plots, commercial space, coworking desks, PG stays and furniture. Sign in with Google or your phone number only when you want to post a listing, save a favourite, or message a seller — we use your account solely to power those features.",
    homeIntroShort: "Buy, rent, sell & lease — free, no brokerage, message sellers directly.",
    footerBlurb:
      "Verified listings to buy, rent or lease houses, apartments, villas, plots, coworking desks, commercial spaces and PG accommodation across India — no login needed to browse.",
    ownerBlurb:
      "List a house, flat, plot, PG, coworking desk or commercial space and reach people searching in your city. You deal directly with seekers.",
    helpAbout:
      "Bhavano is a property marketplace for homes, plots, PG accommodation, coworking desks, storage space and commercial space across India, so a move or a small-business setup can be handled in one place.",
    helpWhatCanIList:
      "Houses, apartments, villas, plots, PG/hostel accommodation, storage space, coworking desks and commercial spaces — each with its own set of relevant fields (bedrooms, sharing type, seat type, and so on).",
    citiesDescription: "Every city Bhavano covers for buying, renting, and leasing property across India.",
    citiesIntro: (count) =>
      `${count} cities across India — pick one to browse houses, apartments, villas, plots, PG accommodation, coworking desks and commercial spaces there.`,
    notFoundBrowse: "Browse homes, rentals, villas, plots, PG, coworking, commercial spaces",
    notFoundExampleCities: true,
    searchPlaceholder: (cityLabel, areaName) =>
      areaName
        ? `Search "2BHK in ${areaName}, ${cityLabel}", "villa for rent"…`
        : `Search "2BHK in ${cityLabel}", "PG near IT park", "plot for sale"…`,
    searchExampleChips: (cityLabel, place) => [
      `2 BHK in ${place}`,
      `Villas for rent in ${cityLabel}`,
      `PG in ${cityLabel}`,
      `Coworking in ${cityLabel}`,
    ],
    listingsCheckedClaim: true,
    indiaContent: true,
    indiaOrganization: true,
  },
  us: {
    siteTitle: "Bhavano — Homes for Rent and Sale",
    siteDescription: "Find homes for rent and for sale, listed by owners and agents. Browse without logging in.",
    ogLocale: "en_US",
    htmlLang: "en-US",
    areaServed: "United States",
    ogTagline: "Homes for rent and sale",
    headerTagline: "Homes for rent and sale, listed by owners and agents",
    homeHeading: "Rent, buy and list homes across the United States",
    anywhere: "the United States",
    homeIntro:
      "Bhavano is a marketplace for renting, buying and selling homes, storage and commercial space, listed by owners and agents. Sign in only when you want to post a listing, save a favorite, or message the owner — we use your account solely to power those features.",
    homeIntroShort: "Rent, buy & sell — message owners directly.",
    footerBlurb:
      "Listings to rent or buy houses, apartments, villas, storage and commercial spaces across the United States — no login needed to browse.",
    ownerBlurb:
      "List a house, apartment, villa, storage space or commercial space and reach people searching in your city. You deal directly with renters and buyers.",
    helpAbout:
      "Bhavano is a property marketplace for homes, storage space and commercial space across the United States, so renting, buying or setting up a small business can be handled in one place.",
    helpWhatCanIList:
      "Houses, apartments, villas, storage space and commercial spaces — each with its own set of relevant fields (bedrooms, size, and so on).",
    citiesDescription: "Every city Bhavano covers for renting and buying homes across the United States.",
    citiesIntro: (count) =>
      `${count} cities across the United States — pick one to browse houses, apartments, villas, storage and commercial spaces there.`,
    notFoundBrowse: "Browse homes for rent and for sale, villas, storage and commercial spaces",
    notFoundExampleCities: false,
    searchPlaceholder: (cityLabel, areaName) =>
      areaName
        ? `Search "2 bed in ${areaName}, ${cityLabel}", "villa for rent"…`
        : `Search "2 bed in ${cityLabel}", "house for rent", "storage space"…`,
    searchExampleChips: (cityLabel, place) => [
      `2 bed in ${place}`,
      `Villas for rent in ${cityLabel}`,
      `Houses for rent in ${cityLabel}`,
      `Storage in ${cityLabel}`,
    ],
    listingsCheckedClaim: false,
    indiaContent: false,
    indiaOrganization: false,
  },
};

/** The wording for a market. With no argument it is the market this build serves (`NEXT_PUBLIC_MARKET`, else the runtime `MARKET`; India when neither is set). */
export function marketCopy(marketId?: MarketId | string): MarketCopy {
  return COPY[buildMarket(marketId).id];
}
