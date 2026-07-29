import { ForbiddenException, Injectable } from '@nestjs/common';
import {
  listingSlotAllowance,
  type ListingSlotCapErrorBody,
  type ListingSlotEntitlementInput,
} from '@bhavano/types/listingSlots';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ListingSlotsService {
  constructor(private readonly prisma: PrismaService) {}

  activeListingWhere(ownerId: string, now = new Date()) {
    return {
      ownerId,
      status: 'active' as const,
      expiresAt: { gt: now },
    };
  }

  async countActiveListings(ownerId: string): Promise<number> {
    return this.prisma.listing.count({ where: this.activeListingWhere(ownerId) });
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
    const user = await this.getEntitlement(userId);
    const [activeCount, allowance] = await Promise.all([
      this.countActiveListings(userId),
      Promise.resolve(listingSlotAllowance(user)),
    ]);
    return { activeCount, allowance };
  }

  async assertCanPublish(ownerId: string): Promise<void> {
    const user = await this.getEntitlement(ownerId);
    const allowance = listingSlotAllowance(user);
    const activeCount = await this.countActiveListings(ownerId);
    if (activeCount < allowance) return;

    const body: ListingSlotCapErrorBody = {
      code: 'LISTING_SLOT_CAP_REACHED',
      message:
        `You have ${activeCount} active listings and your plan allows ${allowance}. ` +
        `Remove or wait for an ad to expire, or upgrade for more slots.`,
      activeCount,
      allowance,
      upsell: allowance < 10 ? ['sellerSlotPack', 'agentPro'] : ['agentPro'],
    };
    throw new ForbiddenException(body);
  }
}
