import { DEFAULT_BOOST_PRICE_SETTINGS } from '@bhavano/types/boostPricing';
import { DEFAULT_SUBSCRIPTION_PLAN_SETTINGS } from '@bhavano/types/subscriptionPricing';

/** Fixed ids of the two singleton settings rows — same convention as RateLimitService's
 * SETTINGS_ID / ContactRevealService's CONTACT_REVEAL_SETTINGS_ID. */
export const BOOST_PRICE_SETTINGS_ID = 'singleton';
export const SUBSCRIPTION_PLAN_SETTINGS_ID = 'singleton';

/** Re-exported from @bhavano/types rather than redefined here — those defaults are also the
 * fallback `boostPriceFor`/`subscriptionPriceFor`/`listingSlotAllowance` use client-side before
 * any live-settings fetch resolves, so this is the one place both the DB-row fallback and the
 * client display fallback agree on the numbers. */
export { DEFAULT_BOOST_PRICE_SETTINGS, DEFAULT_SUBSCRIPTION_PLAN_SETTINGS };
