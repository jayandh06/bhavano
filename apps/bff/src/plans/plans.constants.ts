import { defaultBoostPriceSettings } from '@bhavano/types/boostPricing';
import { defaultSubscriptionPlanSettings } from '@bhavano/types/subscriptionPricing';
import { MARKET } from '../market/market-config';
import { defaultInstantAlertsPriceSettings } from '@bhavano/types/instantAlertsPricing';
import { DEFAULT_PLATFORM_FEE_SETTINGS } from '@bhavano/types/platformFeePricing';

/** Fixed ids of the three singleton settings rows — same convention as RateLimitService's
 * SETTINGS_ID / ContactRevealService's CONTACT_REVEAL_SETTINGS_ID. */
export const BOOST_PRICE_SETTINGS_ID = 'singleton';
export const BOOST_EFFECTIVENESS_STAT_ID = 'singleton';
export const SUBSCRIPTION_PLAN_SETTINGS_ID = 'singleton';
export const INSTANT_ALERTS_PRICE_SETTINGS_ID = 'singleton';
export const PLATFORM_FEE_SETTINGS_ID = 'singleton';

/** The platform fee is zero in every market until someone sets it. */
export { DEFAULT_PLATFORM_FEE_SETTINGS };

/** This deployment's market defaults for what a fresh database starts with: India's numbers on the India stack (unchanged), US dollar tiers on the
 * US stack. The client display fallbacks in @bhavano/types stay India's; clients show the live settings. */
export const DEFAULT_BOOST_PRICE_SETTINGS = defaultBoostPriceSettings(MARKET.id);
export const DEFAULT_INSTANT_ALERTS_PRICE_SETTINGS = defaultInstantAlertsPriceSettings(MARKET.id);

/** The subscription defaults for this deployment's market: India's numbers on the India stack (unchanged), US dollar tiers on the US stack. Same name
 * as before, so every BFF consumer picks it up. The client display fallback in @bhavano/types stays India's; clients show the live settings. */
export const DEFAULT_SUBSCRIPTION_PLAN_SETTINGS = defaultSubscriptionPlanSettings(MARKET.id);
