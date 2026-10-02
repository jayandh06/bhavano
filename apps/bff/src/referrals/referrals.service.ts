import { Injectable } from '@nestjs/common';
import type { ReferralSettingsDto } from '@bhavano/types';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_REFERRAL_SETTINGS, REFERRAL_SETTINGS_ID } from './referrals.constants';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Phases 1-3 of docs/plans/bhavano-referral-program-implementation.md: records anonymous clicks,
 * attributes a new signup back to whoever shared the link, grants/redeems the resulting boost
 * credit once the referred user's first ad is genuinely approved, and revokes an unused credit if
 * that ad is taken down within the revocation window (BR-5). Anti-abuse (Phase 4) and the
 * admin/funnel views (Phase 5) are not built yet. */
@Injectable()
export class ReferralsService {
  constructor(private readonly prisma: PrismaService) {}

  private async getSettings(): Promise<ReferralSettingsDto> {
    const row = await this.prisma.referralSetting.findUnique({ where: { id: REFERRAL_SETTINGS_ID } });
    return row ?? DEFAULT_REFERRAL_SETTINGS;
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
 */
  async attributeSignupIfReferred(
    newUserId: string,
    referralCode: string | undefined,
    sessionId: string | undefined,
  ): Promise<void> {
    if (!referralCode || referralCode === newUserId) return;

    const alreadyAttributed = await this.prisma.referral.findUnique({
      where: { referredUserId: newUserId },
      select: { id: true },
    });
    if (alreadyAttributed) return;

    const referrer = await this.prisma.user.findUnique({
      where: { id: referralCode },
      select: { id: true },
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

    await this.prisma.referral.create({
      data: {
        referrerId: referralCode,
        referredUserId: newUserId,
        clickedAt: matchingClick?.createdAt,
      },
    });
  }

  /** Grants the referrer's boost credit for a successful referral — called from
   * recordFirstApprovedAdIfReferred below, the "first ad approved" hook. Idempotent:
   * `ReferralCreditBatch.referralId` is `@unique`, so a retried call for the same referral is a
   * silent no-op rather than a duplicate credit. BR-6 (monthly cap)/BR-7 (referrer needs an
   * approved ad)/BR-9 (frozen referrer) are Phase 4 — this method grants unconditionally once
   * called. */
  async grantReward(referralId: string, referrerId: string): Promise<void> {
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
        data: { status: 'rewarded', rewardedAt: now },
      }),
    ]);
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
   * fires early. */
  async recordFirstApprovedAdIfReferred(ownerId: string): Promise<void> {
    const referral = await this.prisma.referral.findUnique({
      where: { referredUserId: ownerId },
      select: { id: true, referrerId: true, rewardedAt: true },
    });
    if (!referral || referral.rewardedAt) return;

    const approvedCount = await this.prisma.listing.count({
      where: { ownerId, status: 'active', publishState: 'live', moderationState: 'approved' },
    });
    if (approvedCount !== 1) return;

    const now = new Date();
    await this.prisma.referral.update({
      where: { id: referral.id },
      data: { status: 'ad_approved', firstAdPostedAt: now, firstAdApprovedAt: now },
    });
    await this.grantReward(referral.id, referral.referrerId);
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
