import { DEFAULT_BOOST_PRICE_SETTINGS } from '@bhavano/types/boostPricing';
import { defaultSubscriptionPlanSettings } from '@bhavano/types/subscriptionPricing';
import { MARKET } from '../market/market-config';
import { DEFAULT_INSTANT_ALERTS_PRICE_SETTINGS } from '@bhavano/types/instantAlertsPricing';
import { DEFAULT_PLATFORM_FEE_SETTINGS } from '@bhavano/types/platformFeePricing';

/** Fixed ids of the three singleton settings rows — same convention as RateLimitService's
 * SETTINGS_ID / ContactRevealService's CONTACT_REVEAL_SETTINGS_ID. */
export const BOOST_PRICE_SETTINGS_ID = 'singleton';
export const BOOST_EFFECTIVENESS_STAT_ID = 'singleton';
export const SUBSCRIPTION_PLAN_SETTINGS_ID = 'singleton';
export const INSTANT_ALERTS_PRICE_SETTINGS_ID = 'singleton';
export const PLATFORM_FEE_SETTINGS_ID = 'singleton';

/** Re-exported from @bhavano/types rather than redefined here — those defaults are also the
 * fallback `boostPriceFor`/`subscriptionPriceFor`/`listingSlotAllowance` use client-side before
 * any live-settings fetch resolves, so this is the one place both the DB-row fallback and the
 * client display fallback agree on the numbers. */
export {
  DEFAULT_BOOST_PRICE_SETTINGS,
  DEFAULT_INSTANT_ALERTS_PRICE_SETTINGS,
  DEFAULT_PLATFORM_FEE_SETTINGS,
};

/** The subscription defaults for this deployment's market: India's numbers on the India stack (unchanged), US dollar tiers on the US stack. Same name
 * as before, so every BFF consumer picks it up. The client display fallback in @bhavano/types stays India's; clients show the live settings. */
export const DEFAULT_SUBSCRIPTION_PLAN_SETTINGS = defaultSubscriptionPlanSettings(MARKET.id);
