import { createHmac } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ReferralSettingsDto } from '@bhavano/types';
import { PrismaService } from '../prisma/prisma.service';
import {
  DEFAULT_REFERRAL_SETTINGS,
  REFERRAL_SETTINGS_ID,
  type ReferralRewardSkipReason,
} from './referrals.constants';

const DAY_MS = 24 * 60 * 60 * 1000;
const IST_OFFSET_MS = 330 * 60 * 1000;

/** Start of the current calendar month in India time — BR-6's "per calendar month" is the
 * month the poster sees, not UTC's. */
export function istMonthStart(now = new Date()): Date {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), 1) - IST_OFFSET_MS);
}

/** Phases 1-4 of docs/plans/bhavano-referral-program-implementation.md: records anonymous clicks,
 * attributes a new signup back to whoever shared the link (flagging, not blocking, a same-device
 * self-referral — BR-3), grants/redeems the resulting boost credit once the referred user's first
 * ad is genuinely approved — subject to the referrer having an approved ad of their own (BR-7),
 * the monthly cap (BR-6), not being frozen (BR-9), and the referred phone never having earned a
 * reward before even under a deleted account (BR-2) — and revokes an unused credit if that ad is
 * taken down within the revocation window (BR-5). The admin/funnel views and the freeze/reverse
 * actions (Phase 5) and the 3/5-referral bonus tiers are not built yet. */
@Injectable()
export class ReferralsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async getSettings(): Promise<ReferralSettingsDto> {
    const row = await this.prisma.referralSetting.findUnique({ where: { id: REFERRAL_SETTINGS_ID } });
    return row ?? DEFAULT_REFERRAL_SETTINGS;
  }

  /** One-way fingerprint for BR-2's phone ledger — never the raw phone. Salted with the same
   * secret that signs auth JWTs: this hash exists purely to detect "has this exact phone number
   * already earned a referral reward," not to protect a high-value secret, so reusing an existing
   * server secret as the pepper avoids a second piece of required deploy config for a
   * fraud-detection fingerprint. Unsalted SHA-256 alone would be reversible by brute force — the
   * entire 10-digit Indian mobile number space is seconds of hashing on commodity hardware.
   * Rotating AUTH_JWT_SECRET orphans existing ledger rows, so rotate it together with a rehash. */
  hashPhone(phone: string): string {
    const secret = this.config.get<string>('AUTH_JWT_SECRET') ?? 'dev-only-change-me';
    return createHmac('sha256', secret).update(phone).digest('hex');
  }

  private async phoneAlreadyRewarded(phoneHash: string): Promise<boolean> {
    const entry = await this.prisma.referralPhoneLedger.findUnique({ where: { phoneHash }, select: { id: true } });
    return entry !== null;
  }

  /** Public, unauthenticated call site (see ReferralsController) — a click on a shared link,
   * before any signup exists. `referrerId` is taken as-is from the link's `?ref=` value with no
   * stronger proof than "a User row with this id exists"; anything else (malformed, deleted
   * account, someone guessing ids) just means a click that attributes to nothing, matching the
   * requirements doc's "the program must never get in the way" stance rather than raising an
   * error back to an anonymous visitor's browser. */
  async recordClick(referrerId: string, sessionId: string, landingListingId?: string): Promise<void> {
    const referrer = await this.prisma.user.findUnique({ where: { id: referrerId }, select: { id: true } });
    if (!referrer) return;
    await this.prisma.referralClick.create({ data: { referrerId, sessionId, landingListingId } });
  }

  /** Called once, fire-and-forget, from AuthService at the moment a brand-new user is created
   * (verifyOtp/loginWithGoogle/loginWithApple) — mirrors linkVisitToUser/linkListingViewsToUser's
   * own fire-and-forget convention there, so a failure here never blocks or slows down signup.
   *
   * Self-referral (`referralCode === newUserId`) and an already-attributed user (the `@unique` on
   * `Referral.referredUserId` means this user already has a referrer) are both silently no-ops —
   * once set, a referrer is fixed for life per the source doc's "latest link wins before signup,
   * fixed after" rule, and this method only ever runs once per user in practice (at creation), but
   * stays idempotent against a retried call. An unknown `referralCode` (bad link, deleted account)
   * is the same "attributes to nothing" stance as recordClick above.
   *
   * `viewerKey` is the new user's own device key (`User.firstSeenViewerKey`, just set at creation
   * by the same signup call this runs from) — BR-3: if it matches the *referrer's* own
   * `firstSeenViewerKey`, this looks like the same person signing up twice on one device to farm
   * a reward. Flagged (`status: 'blocked'`), not refused outright — the referral is still created
   * and visible to admin (Phase 5), it just never auto-rewards (see grantReward's own check). A
   * resettable per-install key is not real device fingerprinting, so this stays a soft signal.
   * Referrers who signed up before this column existed have no key, so they are never matched.
   *
   * BR-2: a phone-OTP signup whose number already earned a referral reward is not attributed at
   * all. Google/Apple signups have no phone yet; recordFirstApprovedAdIfReferred re-checks at
   * reward time, when publishing has guaranteed a verified phone. */
  async attributeSignupIfReferred(
    newUserId: string,
    referralCode: string | undefined,
    sessionId: string | undefined,
    viewerKey?: string,
  ): Promise<void> {
    if (!referralCode || referralCode === newUserId) return;

    const alreadyAttributed = await this.prisma.referral.findUnique({
      where: { referredUserId: newUserId },
      select: { id: true },
    });
    if (alreadyAttributed) return;

    const referrer = await this.prisma.user.findUnique({
      where: { id: referralCode },
      select: { id: true, firstSeenViewerKey: true },
    });
    if (!referrer) return;

    // Best-effort: if this session clicked the referrer's link before signing up, carry that
    // click's timestamp onto the Referral row for the funnel (clickedAt). A signup with no prior
    // recorded click (direct link open with cookies blocked, or an old client) still attributes —
    // the click timestamp is a nice-to-have for the funnel, not a requirement for attribution. See
    // the source doc's own last open question: "should a referral count if the referred user was
    // already a visitor but never signed up? (Assumed yes, within 30 days.)" — the window is only
    // enforced below when a click *was* found; both web (bhavano_ref's own cookie TTL) and mobile
    // (getReferralCodeIfFresh) already refuse to send a referralCode past their own 30-day window
    // in the common case, so this is defense-in-depth against a client that doesn't, not the only
    // place the window is enforced.
    const matchingClick = sessionId
      ? await this.prisma.referralClick.findFirst({
          where: { referrerId: referralCode, sessionId },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
        })
      : null;
    if (matchingClick) {
      const settings = await this.getSettings();
      const windowMs = settings.attributionWindowDays * DAY_MS;
      if (Date.now() - matchingClick.createdAt.getTime() > windowMs) return;
    }

    const newUser = await this.prisma.user.findUnique({ where: { id: newUserId }, select: { phone: true } });
    if (newUser?.phone && (await this.phoneAlreadyRewarded(this.hashPhone(newUser.phone)))) return;

    const sameDevice = Boolean(viewerKey) && viewerKey === referrer.firstSeenViewerKey;

    await this.prisma.referral.create({
      data: {
        referrerId: referralCode,
        referredUserId: newUserId,
        clickedAt: matchingClick?.createdAt,
        ...(sameDevice ? { status: 'blocked', rewardSkippedReason: 'same_device' } : {}),
      },
    });
  }

  /** Grants the referrer's boost credit for a successful referral — called from
   * recordFirstApprovedAdIfReferred below, the "first ad approved" hook. Idempotent:
   * `ReferralCreditBatch.referralId` is `@unique`, so a retried call for the same referral is a
   * silent no-op rather than a duplicate credit. Eligibility (BR-2/3/6/7/9) is decided by the
   * caller (rewardSkipReason); this method grants unconditionally once called. `phoneHash` is the
   * referred user's — written to the BR-2 ledger in the same transaction, so a concurrent second
   * reward for the same phone fails on the ledger's unique key instead of granting twice. */
  async grantReward(referralId: string, referrerId: string, phoneHash?: string): Promise<void> {
    const existing = await this.prisma.referralCreditBatch.findUnique({
      where: { referralId },
      select: { id: true },
    });
    if (existing) return;

    const settings = await this.getSettings();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + settings.creditExpiryDays * DAY_MS);

    await this.prisma.$transaction([
      this.prisma.referralCreditBatch.create({
        data: { userId: referrerId, referralId, daysGranted: settings.boostDays, expiresAt },
      }),
      this.prisma.referral.update({
        where: { id: referralId },
        data: { status: 'rewarded', rewardedAt: now, rewardSkippedReason: null },
      }),
      ...(phoneHash ? [this.prisma.referralPhoneLedger.create({ data: { phoneHash, referralId } })] : []),
    ]);
  }

  /** The first rule a referral fails, or null when it earns a credit. Order matters only for
   * which reason admin sees; any one failure means no credit. A frozen referrer keeps credits
   * already granted (BR-9 stops new grants, it isn't a clawback). */
  async rewardSkipReason(
    referral: { status: string; referrerId: string },
    referredPhone: string | null,
  ): Promise<ReferralRewardSkipReason | null> {
    if (referral.status === 'blocked') return 'same_device';
    if (!referredPhone) return 'phone_missing';
    if (await this.phoneAlreadyRewarded(this.hashPhone(referredPhone))) return 'phone_already_rewarded';

    const referrer = await this.prisma.user.findUnique({
      where: { id: referral.referrerId },
      select: { deletedAt: true, referralFrozenAt: true },
    });
    if (!referrer || referrer.deletedAt) return 'referrer_deleted';
    if (referrer.referralFrozenAt) return 'referrer_frozen';

    // BR-7: an ad that was ever approved and published counts, even if since sold or deactivated.
    const referrerApprovedAds = await this.prisma.listing.count({
      where: { ownerId: referral.referrerId, moderationState: 'approved', publishState: 'live' },
    });
    if (referrerApprovedAds === 0) return 'referrer_no_approved_ad';

    // BR-6: bonus-tier credits are extra, so they don't use up the monthly allowance.
    const settings = await this.getSettings();
    const grantedThisMonth = await this.prisma.referralCreditBatch.count({
      where: { userId: referral.referrerId, bonusTier: null, grantedAt: { gte: istMonthStart() } },
    });
    if (grantedThisMonth >= settings.monthlyCapPerReferrer) return 'monthly_cap';

    return null;
  }

  /** The credit batch `PaymentsService.createBoostOrder`'s `useReferralCredit` branch should
   * redeem, if any — the one nearest expiry among unredeemed, unrevoked, unexpired batches, same
   * "spend from the batch nearest expiry first" discipline as ContactRevealCreditBatch. Read-only;
   * the caller marks it redeemed itself via markCreditRedeemed once the boost actually activates,
   * same check-then-act-then-mark shape ProBoostCredit's own redemption already uses. */
  async findRedeemableCredit(userId: string): Promise<{ id: string; daysGranted: number } | null> {
    return this.prisma.referralCreditBatch.findFirst({
      where: { userId, redeemedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { expiresAt: 'asc' },
      select: { id: true, daysGranted: true },
    });
  }

  async markCreditRedeemed(batchId: string, listingId: string, paymentId: string): Promise<void> {
    await this.prisma.referralCreditBatch.update({
      where: { id: batchId },
      data: { redeemedAt: new Date(), redeemedListingId: listingId, redeemedPaymentId: paymentId },
    });
  }

  /** Called (fire-and-forget) from `ListingsService.runPostLiveSideEffects` and `.approve()` —
   * the two places a listing can first become genuinely public (`status:'active'`,
   * `publishState:'live'`, `moderationState:'approved'`) — see Phase 3 of
   * docs/plans/bhavano-referral-program-implementation.md and the context comment above both call
   * sites for why there are exactly two, not three.
   *
   * Deliberately asks "does this owner now have exactly one genuinely live listing" rather than
   * "was *this* listingId just approved" — that's the actual definition of "their first approved
   * ad" regardless of which of the two call sites triggered the check, and it's naturally safe to
   * call from a state-changing method that didn't itself make the listing live (e.g. `approve()`
   * on a listing that's still `pending_checkout`): the count simply won't be 1 yet, so nothing
   * fires early.
   *
   * Runs once per referral: `firstAdApprovedAt` marks it decided, so deleting the first ad and
   * posting another can't re-roll a skipped reward (BR-4 is about the *first* ad). A skipped
   * referral keeps its progress (`ad_approved`, or `blocked` for a same-device flag) with the
   * reason recorded, so it still counts on the dashboard per BR-6. */
  async recordFirstApprovedAdIfReferred(ownerId: string): Promise<void> {
    const referral = await this.prisma.referral.findUnique({
      where: { referredUserId: ownerId },
      select: { id: true, referrerId: true, status: true, rewardedAt: true, firstAdApprovedAt: true },
    });
    if (!referral || referral.rewardedAt || referral.firstAdApprovedAt) return;

    const approvedCount = await this.prisma.listing.count({
      where: { ownerId, status: 'active', publishState: 'live', moderationState: 'approved' },
    });
    if (approvedCount !== 1) return;

    const owner = await this.prisma.user.findUnique({ where: { id: ownerId }, select: { phone: true } });
    const phone = owner?.phone ?? null;
    const skipReason = await this.rewardSkipReason(referral, phone);

    const now = new Date();
    await this.prisma.referral.update({
      where: { id: referral.id },
      data: {
        status: referral.status === 'blocked' ? 'blocked' : 'ad_approved',
        firstAdPostedAt: now,
        firstAdApprovedAt: now,
        rewardSkippedReason: skipReason,
      },
    });
    if (skipReason || !phone) return;
    await this.grantReward(referral.id, referral.referrerId, this.hashPhone(phone));
  }

  /** BR-5: "if the referred user's ad is removed for policy violations within 14 days of
   * approval, the referrer's unused credit from that referral is revoked." Called (fire-and-
   * forget) from `ListingsService.flag()` and `.deleteCompletely()` — a flag is the de-facto
   * takedown here (a flagged listing fails every public-visibility query the same as a deleted
   * one), so those are the two real "removed" events. `setStatusAsAdmin`'s `deactivated` is
   * deliberately NOT a third trigger — that's an owner-support action (e.g. undoing an accidental
   * deactivation), not a policy-violation takedown; flagged in
   * docs/plans/bhavano-referral-program-implementation.md as worth confirming with product if
   * that scoping ever turns out wrong.
   *
   * No-op past the window, and no-op once the credit is already spent — BR-5 only revokes an
   * *unused* credit; a boost already applied to another ad is never clawed back. */
  async revokeIfTakenDown(ownerId: string, reason: string): Promise<void> {
    const referral = await this.prisma.referral.findUnique({
      where: { referredUserId: ownerId },
      select: { id: true, firstAdApprovedAt: true },
    });
    if (!referral?.firstAdApprovedAt) return;

    const settings = await this.getSettings();
    const windowMs = settings.takedownRevocationWindowDays * DAY_MS;
    if (Date.now() - referral.firstAdApprovedAt.getTime() > windowMs) return;

    await this.prisma.referralCreditBatch.updateMany({
      where: { referralId: referral.id, redeemedAt: null, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
  }

  /** For the Referrals page (Phase 6) — how many credits are spendable right now and when the
   * soonest one expires, both derived live from the ledger rather than a cached counter, same
   * convention as ContactRevealService.getBalanceForUser. */
  async getBalanceForUser(userId: string): Promise<{ availableCredits: number; nextExpiryAt: Date | null }> {
    const batches = await this.prisma.referralCreditBatch.findMany({
      where: { userId, redeemedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { expiresAt: 'asc' },
      select: { expiresAt: true },
    });
    return { availableCredits: batches.length, nextExpiryAt: batches[0]?.expiresAt ?? null };
  }
}
