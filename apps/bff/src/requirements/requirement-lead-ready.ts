import type { City, Requirement } from '@prisma/client';
import { isLeadReady } from '@bhavano/types/requirementQuestions';
import type { PrismaService } from '../prisma/prisma.service';
import { criteriaOf } from './requirements.service';
import { listingFits, type InventoryItem } from './requirement-feed';

/** Far above today's volume (under 100 open); the whole set is filtered in memory. See the feed service. */
export const FEED_SCAN_LIMIT = 2000;

export type LeadReadyRow = Requirement & { city: City | null };

/** Open requirements specific enough for an owner or agent to act on (city, property type and transaction set,
 * and the areas/size lead-ready rule), not expired and not the viewer's own. The one definition behind the
 * Requirements tab and the per-ad match count, so the two numbers cannot disagree. */
export async function loadLeadReadyRows(prisma: PrismaService, excludeSeekerId?: string): Promise<LeadReadyRow[]> {
  const rows = await prisma.requirement.findMany({
    where: {
      status: { in: ['open', 'working'] },
      expiresAt: { gt: new Date() },
      cityId: { not: null },
      category: { not: null },
      transactionType: { not: null },
      ...(excludeSeekerId ? { seekerId: { not: excludeSeekerId } } : {}),
    },
    include: { city: true },
    orderBy: { createdAt: 'desc' },
    take: FEED_SCAN_LIMIT,
  });
  return rows.filter((row) => isLeadReady(criteriaOf(row)));
}

/** How many lead-ready requirements each of an owner's ads fits, by the same rule the Requirements tab uses
 * (`listingFits`: same city, category and transaction, area among the requirement's areas). One query for all
 * the ads. Carries no seeker identity. Ads with no fit are left out of the map. */
export async function countFittingRequirements(
  prisma: PrismaService,
  ownerId: string,
  listings: ({ id: string } & InventoryItem)[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (listings.length === 0) return counts;
  const rows = await loadLeadReadyRows(prisma, ownerId);
  const criteria = rows.map(criteriaOf);
  for (const listing of listings) {
    const n = criteria.filter((c) => listingFits(c, listing)).length;
    if (n > 0) counts.set(listing.id, n);
  }
  return counts;
}
