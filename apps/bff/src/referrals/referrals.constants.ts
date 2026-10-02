import type { ReferralSettingsDto } from '@bhavano/types';

/** Fixed id of the singleton ReferralSetting row — same convention as
 * CONTACT_REVEAL_SETTINGS_ID/LoginNudgeSetting's own singleton id. */
export const REFERRAL_SETTINGS_ID = 'singleton';

/** Matches the Prisma model's own `@default(...)` values and
 * docs/plans/bhavano-referral-program.md's stated defaults — used whenever the settings row
 * hasn't been created/edited yet, same "DB row overrides this, this is just the fallback"
 * convention as DEFAULT_CONTACT_REVEAL_SETTINGS. */
export const DEFAULT_REFERRAL_SETTINGS: ReferralSettingsDto = {
  boostDays: 3,
  creditExpiryDays: 60,
  monthlyCapPerReferrer: 5,
  bonusExtraBoostAtReferrals: 3,
  topAgentBadgeAtReferrals: 5,
  welcomeRewardEnabled: false,
  welcomeRewardFeaturedDays: 1,
  attributionWindowDays: 30,
  takedownRevocationWindowDays: 14,
};
