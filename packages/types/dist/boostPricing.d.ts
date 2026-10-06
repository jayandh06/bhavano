import type { BoostPricingOptionDto, BoostPricingPreviewDto, ListingCategory, TransactionType } from "./index";
export type BoostDurationDays = 7 | 15 | 30;
/** Every duration a seller can buy, shortest first — the one list the pickers render from. */
export declare const BOOST_DURATIONS: readonly BoostDurationDays[];
/** Admin-editable boost pricing — same singleton-row convention as RateLimitSettingsDto. Column
 * groups mirror the three category value-tiers this pricing has always used: a flat fee across
 * categories this different in value (a ₹50 furniture listing vs. a multi-crore apartment) would
 * be either exploitative for cheap categories or too cheap to matter for expensive ones. See
 * docs/plans/admin-manage-plans-pricing.md and docs/plans/monetization-boosted-listings-premium-
 * tiers.md. */
export interface BoostPriceSettings {
    propertyBoostPrice7d: number;
    propertyBoostPrice15d: number;
    propertyBoostPrice30d: number;
    coworkingPgStorageBoostPrice7d: number;
    coworkingPgStorageBoostPrice15d: number;
    coworkingPgStorageBoostPrice30d: number;
    furnitureInteriorsBoostPrice7d: number;
    furnitureInteriorsBoostPrice15d: number;
    furnitureInteriorsBoostPrice30d: number;
    /** Where the Boost picker appears: `false` (default) is today's behavior — only
     * as an upsell after the ad is posted. `true` moves it onto the ad-preview step instead, before
     * posting — the two placements are mutually exclusive, never both at once. See
     * docs/plans/boost-instant-alerts-preview-selector.md. */
    showSelectorOnPreview: boolean;
    /** Whether each duration is offered in the boost pickers (and accepted at checkout). At least
     * one stays on. See `enabledBoostDurations`. */
    boost7dEnabled: boolean;
    boost15dEnabled: boolean;
    boost30dEnabled: boolean;
    /** Whether the Boost card's "Skip — post without boosting" link appears at all, on both the
     * ad-preview step and the publish-checkout recovery screen. `false` makes Boost mandatory
     * wherever the card is shown — a standalone switch, not derived from `showSelectorOnPreview` or
     * whether a platform fee applies to the category. */
    allowSkippingBoost: boolean;
    /** Optional price-by-listing-value overrides — see
     * docs/plans/boost-proof-stat-and-value-bands.md. Purely additive on top of the flat per-tier
     * prices above: when `boostPriceFor` is given the listing's `transactionType` + value and a
     * rule here matches both, that rule's band price is used instead of the flat tier price; a
     * segment with no matching rule (or no value supplied at all) keeps the flat price unchanged.
     * This is what lets an existing settings row with no rules configured yet behave identically to
     * today with zero migration risk. */
    valueBandRules?: BoostPricingRule[];
}
/** One rule's price-by-value tiers for a (category, transactionType) pair — e.g. "Property,
 * sell/buy, by sale price" or "PG, by monthly rent" (PG/coworking/rent listings don't have a
 * one-time sale price at all, so the rule matching on `transactionTypes` is what picks the right
 * value signal, not just the right price). */
export interface BoostPricingRule {
    categories: ListingCategory[];
    transactionTypes: TransactionType[];
    /** Ascending by `maxValue`; the last entry's `maxValue` must be `null` (the open-ended top
     * band) — `boostPriceFor` falls back to it if nothing else matches. */
    bands: BoostPriceBand[];
}
export interface BoostPriceBand {
    /** The band's upper cutoff — a sale price for a sell/buy rule, a monthly rent/fee for a
     * rent/lease rule. `null` means this is the top, open-ended band. */
    maxValue: number | null;
    price7d: number;
    price15d: number;
    price30d: number;
}
/** Starting placeholder bands — explicitly not real percentile data (none was reachable from the
 * dev environment this was written in; the production DB is only reachable from inside Bhavano's
 * own infrastructure). Each rule's middle band matches today's existing flat tier price, so a
 * typical listing's price doesn't move on rollout — only genuinely cheap or genuinely expensive
 * listings do. See docs/plans/boost-proof-stat-and-value-bands.md for the full reasoning and the
 * table these come from. Replace with real cutoffs/prices via the admin settings once production
 * listing-price/rent percentiles can be pulled. */
export declare const DEFAULT_VALUE_BAND_RULES: BoostPricingRule[];
/** Bundled into this shared package (not just the BFF) since `boostPriceFor` below is also
 * called client-side, purely for display, before any live-settings fetch resolves — see
 * BoostProvider.tsx (web) / BoostModal.tsx (mobile). The BFF's own DB-row fallback (when no
 * settings have ever been saved) reuses this exact same constant rather than redefining it. */
export declare const DEFAULT_BOOST_PRICE_SETTINGS: BoostPriceSettings;
/** The durations admin has switched on, shortest first. A flag missing from a response sent by a
 * server older than these toggles counts as on. */
export declare function enabledBoostDurations(settings: Partial<Pick<BoostPriceSettings, "boost7dEnabled" | "boost15dEnabled" | "boost30dEnabled">>): BoostDurationDays[];
/** What a picker shows. A response from before `enabledDurations` existed offers all three. */
export declare function offeredBoostDurations(pricing: Pick<BoostPricingPreviewDto, "enabledDurations"> | null | undefined): readonly BoostDurationDays[];
/** The pre-selected duration: 15 days (cheaper per day than 7, see
 * docs/plans/boost-30-day-and-included-alerts.md) when offered, else the first one offered. */
export declare function defaultBoostDuration(offered: readonly BoostDurationDays[]): BoostDurationDays;
/** The listing's transaction type + the right value signal for it (sale price for sell/buy,
 * monthly rent/fee for rent/lease) — a sale price and a monthly rent are different scales, so a
 * rule only ever matches on its own `transactionTypes`, never across both. Omit entirely when
 * there's no listing yet to read a value from (the ad-preview step, before posting) or when
 * band pricing shouldn't apply — `boostPriceFor` falls back to the flat tier price either way. */
export interface BoostPriceContext {
    transactionType: TransactionType;
    value: number;
}
export declare function boostPriceFor(category: ListingCategory, days: BoostDurationDays, settings?: BoostPriceSettings, context?: BoostPriceContext): number;
/** The option for one duration — so a picker can index by the duration it is showing instead of
 * spelling out `boost7` / `boost15` / `boost30` at every use. */
export declare function boostOptionFor(pricing: Pick<BoostPricingPreviewDto, "boost7" | "boost15" | "boost30">, days: BoostDurationDays): BoostPricingOptionDto;
/** What a longer boost saves against the 7-day price, for the badge under each option. Computed
 * from the *charged* amounts (any promo already applied), so the figure on screen matches the
 * price next to it: the promo takes the same percentage off every duration, so the saving is the
 * same shape with or without it.
 *
 * "Save ₹125" means: 30 days bought at the 7-day rate would cost ₹424; this costs ₹299.
 * Null when there is nothing honest to say — a free option (Agent Pro credit), a missing price, or
 * a longer option that is not actually cheaper per day. */
export declare function boostSavings(pricing: Pick<BoostPricingPreviewDto, "boost7" | "boost15" | "boost30">, days: 15 | 30): {
    perDay: number;
    rupees: number;
    percent: number;
} | null;
/** Display pricing built from the public, no-login-required settings + active-promo endpoint
 * (`GET /plans/pricing`, `activeDiscountPercent`) — for the ad-preview step's `BoostPlanSelector`,
 * which has to be usable before the advertiser has necessarily logged in (posting an ad only asks
 * for an account at the final "Post ad" tap). `PaymentsService.previewBoostPricing` is the
 * authenticated, personalized equivalent (also resolves per-user redemption caps and the Agent
 * Pro free-credit case) used everywhere else a price is shown post-login — this is deliberately
 * never used to decide what a checkout actually charges, only what the selector displays before
 * that fetch is even possible. `discountPercent` omitted/`null` shows undiscounted prices, same
 * as `previewBoostPricing` would once the code turns out invalid/expired/exhausted. */
export declare function buildDisplayBoostPricing(category: ListingCategory, boostSettings: BoostPriceSettings, discountPercent?: number | null, 
/** The in-progress wizard's own transactionType + price/rent field, when the advertiser has
 * already entered it by the time this renders (the ad-preview step collects price before
 * review) — lets the preview-step selector show the real band price too, not just the flat
 * tier price. Omit while the value isn't known yet; falls back to the flat tier price. */
context?: BoostPriceContext): BoostPricingPreviewDto;
