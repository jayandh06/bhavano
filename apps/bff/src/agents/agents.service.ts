import { Injectable, NotFoundException } from '@nestjs/common';
import type { AgentStorefrontDto } from '@bhavano/types';
import { PrismaService } from '../prisma/prisma.service';
import { ListingsService } from '../listings/listings.service';

const STOREFRONT_LISTING_LIMIT = 50;

@Injectable()
export class AgentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly listingsService: ListingsService,
  ) {}

  /** Public, unauthenticated — any user with listings has a storefront; Agent Pro subscribers
   * additionally get `isAgentPro` for the badge shown on it. */
  async getStorefront(userId: string): Promise<AgentStorefrontDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, agentProUntil: true, createdAt: true },
    });
    if (!user) throw new NotFoundException('Agent not found');

    const listingsPage = await this.listingsService.list({ ownerId: user.id, limit: STOREFRONT_LISTING_LIMIT });

    return {
      id: user.id,
      name: user.name ?? 'Bhavano user',
      isAgentPro: (user.agentProUntil?.getTime() ?? 0) > Date.now(),
      memberSince: user.createdAt.toISOString(),
      listings: listingsPage.items,
      total: listingsPage.total,
    };
  }
}
