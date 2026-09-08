import type { ContactRevealSettingsDto } from '@bhavano/types';

/** Fixed id of the singleton ContactRevealSetting row — same convention as
 * RateLimitService's SETTINGS_ID. Shared here (rather than duplicated) since both
 * ContactRevealService and PaymentsService read/write this row independently, matching
 * PaymentsService's existing direct-Prisma style rather than injecting a cross-module service. */
export const CONTACT_REVEAL_SETTINGS_ID = 'singleton';

export const DEFAULT_CONTACT_REVEAL_SETTINGS: ContactRevealSettingsDto = {
  freeRevealsPerUser: 2,
  creditPackSize: 5,
  creditPackPriceRupees: 125,
  creditExpiryMonths: 6,
};
