import { ForbiddenException, Injectable } from '@nestjs/common';
import {
  listingSlotAllowance,
  listingSlotCapBody,
  type ListingSlotCapErrorBody,
  type ListingSlotEntitlementInput,
} from '@bhavano/types/listingSlots';
import type { SubscriptionPlanSettings } from '@bhavano/types/subscriptionPricing';
import { PrismaService } from '../prisma/prisma.service';
import { SUBSCRIPTION_PLAN_SETTINGS_ID, DEFAULT_SUBSCRIPTION_PLAN_SETTINGS } from '../plans/plans.constants';

@Injectable()
export class ListingSlotsService {
  constructor(private readonly prisma: PrismaService) {}

  private async getSlotSettings(): Promise<SubscriptionPlanSettings> {
    return (
      (await this.prisma.subscriptionPlanSetting.findUnique({ where: { id: SUBSCRIPTION_PLAN_SETTINGS_ID } })) ??
      DEFAULT_SUBSCRIPTION_PLAN_SETTINGS
    );
  }

  // No expiresAt gate — see docs/plans/explicit-close-not-auto-expire.md. A slot only frees up
  // when the owner/admin explicitly changes status away from 'active', never just from age.
  activeListingWhere(ownerId: string) {
    return {
      ownerId,
      status: 'active' as const,
    };
  }

  /** `excludeListingId` matters for renewal: a not-yet-expired listing being renewed early is
   * already counted here, so renewing it shouldn't be blocked by a cap it isn't adding to. */
  async countActiveListings(ownerId: string, excludeListingId?: string): Promise<number> {
    return this.prisma.listing.count({
      where: { ...this.activeListingWhere(ownerId), ...(excludeListingId ? { id: { not: excludeListingId } } : {}) },
    });
  }

  async getEntitlement(userId: string): Promise<ListingSlotEntitlementInput & { id: string }> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        sellerSlotPackUntil: true,
        agentProUntil: true,
        agentProUnits: true,
      },
    });
    return user;
  }

  async getSummary(userId: string): Promise<{ activeCount: number; allowance: number }> {
    const [user, settings] = await Promise.all([this.getEntitlement(userId), this.getSlotSettings()]);
    const [activeCount, allowance] = await Promise.all([
      this.countActiveListings(userId),
      Promise.resolve(listingSlotAllowance(user, settings)),
    ]);
    return { activeCount, allowance };
  }

  async assertCanPublish(ownerId: string): Promise<void> {
    const [user, settings] = await Promise.all([this.getEntitlement(ownerId), this.getSlotSettings()]);
    const allowance = listingSlotAllowance(user, settings);
    const activeCount = await this.countActiveListings(ownerId);
    if (activeCount < allowance) return;
    throw new ForbiddenException(this.capErrorBody(activeCount, allowance, settings));
  }

  /** Same cap as `assertCanPublish`, but excludes the listing being renewed from its own count —
   * renewing doesn't add a new slot, so it shouldn't be blocked by the cap it's already inside. */
  async assertCanRenew(ownerId: string, listingId: string): Promise<void> {
    const [user, settings] = await Promise.all([this.getEntitlement(ownerId), this.getSlotSettings()]);
    const allowance = listingSlotAllowance(user, settings);
    const activeCount = await this.countActiveListings(ownerId, listingId);
    if (activeCount < allowance) return;
    throw new ForbiddenException(this.capErrorBody(activeCount, allowance, settings));
  }

  private capErrorBody(
    activeCount: number,
    allowance: number,
    settings: SubscriptionPlanSettings,
  ): ListingSlotCapErrorBody {
    return listingSlotCapBody(activeCount, allowance, settings);
  }
}
