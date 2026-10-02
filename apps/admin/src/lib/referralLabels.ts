import type { AdminReferralCreditDto, ReferralStatus } from "@bhavano/types";

export const REFERRAL_STATUS_LABELS: Record<ReferralStatus, string> = {
  signed_up: "Awaiting first ad",
  ad_approved: "Ad approved, no credit",
  rewarded: "Rewarded",
  blocked: "Flagged",
  reversed: "Reversed",
};

export const REFERRAL_STATUS_COLORS: Record<ReferralStatus, string> = {
  signed_up: "var(--muted)",
  ad_approved: "var(--gold)",
  rewarded: "var(--green)",
  blocked: "var(--danger)",
  reversed: "var(--muted)",
};

/** Mirrors the BFF's ReferralRewardSkipReason (apps/bff/src/referrals/referrals.constants.ts). */
export const SKIP_REASON_LABELS: Record<string, string> = {
  same_device: "Same device as referrer",
  phone_already_rewarded: "Phone already earned a referral",
  phone_missing: "Referred user has no phone",
  referrer_deleted: "Referrer account deleted",
  referrer_frozen: "Referrer frozen",
  referrer_no_approved_ad: "Referrer has no live approved ad",
  monthly_cap: "Referrer hit the monthly cap",
};

export function skipReasonLabel(reason: string | null): string | null {
  return reason ? (SKIP_REASON_LABELS[reason] ?? reason) : null;
}

export function creditStateLabel(credit: AdminReferralCreditDto | null, now: number): string {
  if (!credit) return "—";
  if (credit.redeemedAt) return "Used";
  if (credit.revokedAt) return "Revoked";
  if (new Date(credit.expiresAt).getTime() < now) return "Expired";
  return "Available";
}

export const ADMIN_ACTION_LABELS: Record<string, string> = {
  approve_flag: "Cleared flag",
  reverse: "Reversed referral",
  freeze: "Froze referrals",
  unfreeze: "Unfroze referrals",
};
