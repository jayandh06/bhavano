import type { ListingCategory, TransactionType } from "@bhavano/types";

/**
 * The posting-first card shown above the homepage grid to a visitor who has just landed from a
 * Google Ads click. See docs/plans/google-ads-performance-analysis-2026-09.md, "Why ~60% of ad
 * clicks leave from the home page": 40% of paid visitors loaded "All Listings in India" and did
 * nothing, because the only way to act on an ad that promised "post your property free" was
 * the small header button.
 *
 * Keyed by ad group, from the `adgroupid` the account's Final URL suffix appends to every click
 * (the same param middleware.ts records on the Visit). A category preset is set only where the
 * ad group names one asset unambiguously — "House/Apartment" or "Villa/Independent House" would
 * send half their clickers into the wrong form, so those open at the category step instead.
 */
export type AdLandingIntentKey =
  | "generic"
  | "sell_property"
  | "sell_apartment"
  | "sell_villa"
  | "sell_plot"
  | "sell_commercial"
  | "rent_home"
  | "rent_pg"
  | "rent_commercial"
  | "rent_furniture"
  | "lease_commercial"
  | "lease_home";

export interface AdLandingIntent {
  headline: string;
  button: string;
  category?: ListingCategory;
  transactionType?: TransactionType;
}

export const AD_LANDING_INTENTS: Record<AdLandingIntentKey, AdLandingIntent> = {
  generic: { headline: "Post your property — no brokerage", button: "Post ad" },
  sell_property: { headline: "Sell your property — no brokerage", button: "Post my property" },
  sell_apartment: {
    headline: "Sell your flat — post it in 2 minutes",
    button: "Post my flat",
    category: "apartment",
    transactionType: "sell",
  },
  sell_villa: {
    headline: "Sell your villa — post it in 2 minutes",
    button: "Post my villa",
    category: "villa",
    transactionType: "sell",
  },
  sell_plot: {
    headline: "Sell your plot or land directly",
    button: "Post my plot",
    category: "plot",
    transactionType: "sell",
  },
  sell_commercial: {
    headline: "Sell your shop or office directly",
    button: "Post my property",
    category: "commercial",
    transactionType: "sell",
  },
  rent_home: { headline: "Rent out your home — tenants contact you", button: "Post for rent" },
  rent_pg: { headline: "Fill your PG beds faster", button: "Post my PG", category: "pg", transactionType: "rent" },
  rent_commercial: {
    headline: "Rent out your shop or office",
    button: "Post my space",
    category: "commercial",
    transactionType: "rent",
  },
  rent_furniture: {
    headline: "Rent out your furniture",
    button: "Post my furniture",
    category: "furniture",
    transactionType: "rent",
  },
  lease_commercial: {
    headline: "Lease out your shop or office",
    button: "Post my space",
    category: "commercial",
    transactionType: "lease",
  },
  lease_home: { headline: "Lease out your home long-term", button: "Post for lease" },
};

/** Ad group id → card. Ids from apps/bff/src/ads/campaign-names.ts; an ad group missing here
 * (a new one, or Generic Post Ad Intent) gets the generic card, never no card. */
const AD_GROUP_INTENTS: Record<string, AdLandingIntentKey> = {
  // Metro
  "200702632978": "sell_property",
  "205333958048": "sell_apartment",
  "202583649071": "sell_villa",
  "201190284913": "sell_plot",
  "196651916541": "sell_commercial",
  "199595834373": "rent_home",
  "201241143962": "rent_pg",
  "201241519122": "rent_home",
  "199363402229": "rent_commercial",
  "201629875084": "rent_furniture",
  "198411059486": "lease_commercial",
  "202586212471": "lease_home",
  // Other-Metro
  "200422013973": "sell_property",
  "200422014173": "sell_apartment",
  "200422013933": "sell_villa",
  "200422013893": "sell_plot",
  "200422014133": "sell_commercial",
  "198875640405": "rent_home",
  "198875640685": "rent_pg",
  "198875640445": "rent_home",
  "198875640645": "rent_commercial",
  "198875640605": "rent_furniture",
  "203420143351": "lease_commercial",
  "203420143191": "lease_home",
};

/** `?adcard=<intent>` shows the card without an ad click — for checking the copy. Kept apart
 * from `gclid`/`utm_*` so a preview never writes a paid Visit or a Google Ads attribution. */
export const AD_CARD_PREVIEW_PARAM = "adcard";

function param(sp: Record<string, string | string[] | undefined>, name: string): string | undefined {
  const value = sp[name];
  return typeof value === "string" ? value : undefined;
}

function isIntentKey(value: string): value is AdLandingIntentKey {
  return Object.hasOwn(AD_LANDING_INTENTS, value);
}

export function resolveAdLandingIntent(
  sp: Record<string, string | string[] | undefined>,
): { intent: AdLandingIntentKey; preview: boolean } | null {
  const preview = param(sp, AD_CARD_PREVIEW_PARAM);
  if (preview !== undefined) return { intent: isIntentKey(preview) ? preview : "generic", preview: true };

  const paid = param(sp, "gclid") !== undefined || param(sp, "utm_medium") === "cpc";
  if (!paid) return null;
  const adGroupId = param(sp, "adgroupid");
  return { intent: (adGroupId && AD_GROUP_INTENTS[adGroupId]) || "generic", preview: false };
}

export function adLandingPostHref(intent: AdLandingIntentKey): string {
  const card = AD_LANDING_INTENTS[intent];
  const params = new URLSearchParams({ from: "ad_landing_card" });
  if (card.category) params.set("category", card.category);
  if (card.transactionType) params.set("transactionType", card.transactionType);
  return `/post?${params.toString()}`;
}
