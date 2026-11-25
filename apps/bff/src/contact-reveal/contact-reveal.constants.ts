import type { ContactRevealSettingsDto } from '@bhavano/types';
import { MARKET } from '../market/market-config';

/** Fixed id of the singleton ContactRevealSetting row — same convention as
 * RateLimitService's SETTINGS_ID. Shared here (rather than duplicated) since both
 * ContactRevealService and PaymentsService read/write this row independently, matching
 * PaymentsService's existing direct-Prisma style rather than injecting a cross-module service. */
export const CONTACT_REVEAL_SETTINGS_ID = 'singleton';

const INDIA_CONTACT_REVEAL_SETTINGS: ContactRevealSettingsDto = {
  freeRevealsPerUser: 2,
  creditPackSize: 5,
  creditPackPriceRupees: 125,
  creditExpiryMonths: 6,
};

/** The credit-pack price for the US stack, in dollars (the field keeps its "Rupees" name): Rs 125 divided by 60, rounded up to the next $5 (see usdTierFromInr). */
const US_CREDIT_PACK_PRICE = 5;

/** This deployment's market defaults: India's numbers on the India stack (unchanged), dollars on the US stack. */
export const DEFAULT_CONTACT_REVEAL_SETTINGS: ContactRevealSettingsDto =
  MARKET.id === 'us' ? { ...INDIA_CONTACT_REVEAL_SETTINGS, creditPackPriceRupees: US_CREDIT_PACK_PRICE } : INDIA_CONTACT_REVEAL_SETTINGS;
