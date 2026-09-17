import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

/**
 * Tells owners about demand they could actually fill — the half of Phase 1 that connects seekers
 * to providers, per docs/plans/property-requirements-demand-side.md.
 *
 * Every rule here exists to stop this becoming a spam cannon, which is the failure mode that
 * would cost far more than the leads are worth:
 *
 *  - **Matched on inventory, not geography.** An owner hears about a requirement only if they
 *    have a listing in the same city AND category, and — when the requirement names an area — in
 *    that area. Someone who lists PGs in Bengaluru never hears about a plot in Agra.
 *  - **Digested per owner.** One message covering all of their matches, not one per requirement.
 *  - **Capped fan-out per requirement** (OWNERS_PER_REQUIREMENT), so one capture cannot notify
 *    everyone who has ever listed in a big city.
 *  - **Once per requirement.** `ownersNotifiedAt` is stamped after a successful run, and renewal
 *    clears it — a renewed requirement is fresh demand, and owners who have listed since have
 *    never heard about it.
 *  - **No seeker identity in the message.** The reply path is the site.
 *
 * It also retires requirements that have aged out, so `expired` is a real state rather than an
 * unused enum value and so nothing stale is ever included above.
 */
const OWNERS_PER_REQUIREMENT = 20;

/** Nothing older than this is worth pushing at an owner even if it was never notified — a
 * backlog that surfaces weeks late reads as spam, not as a lead. */
const MAX_REQUIREMENT_AGE_DAYS = 14;

@Injectable()
export class RequirementMatchJob {
  private readonly logger = new Logger(RequirementMatchJob.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /** 10:00 IST — an hour after the admin digest, so a person has seen the queue first and can
   * close out anything obviously junk before owners are told about it. */
  @Cron('0 10 * * *', { timeZone: 'Asia/Kolkata' })
  async runDaily(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.retireExpired();
      await this.notifyOwners();
    } catch (error) {
      this.logger.error('Requirement match job failed', error instanceof Error ? error.stack : String(error));
    } finally {
      this.running = false;
    }
  }

  /** Aged-out requirements stop being live. Deliberately not a soft read-time filter alone: an
   * admin's queue should show them as closed-expired rather than silently ranking them alongside
   * live demand. */
  private async retireExpired(): Promise<void> {
    const { count } = await this.prisma.requirement.updateMany({
      where: { status: { in: ['open', 'working'] }, expiresAt: { lte: new Date() } },
      data: { status: 'closed', closedReason: 'expired' },
    });
    if (count > 0) this.logger.log(`Retired ${count} expired requirement(s)`);
  }

  private async notifyOwners(): Promise<void> {
    const cutoff = new Date(Date.now() - MAX_REQUIREMENT_AGE_DAYS * 24 * 60 * 60 * 1000);

    const pending = await this.prisma.requirement.findMany({
      where: {
        ownersNotifiedAt: null,
        status: { in: ['open', 'working'] },
        expiresAt: { gt: new Date() },
        createdAt: { gte: cutoff },
      },
      include: { city: true, area: true },
      orderBy: { createdAt: 'asc' },
    });
    if (pending.length === 0) {
      this.logger.log('No requirements awaiting owner notification');
      return;
    }

    // Built up per owner first, so somebody matching five requirements gets one email listing
    // five things rather than five emails.
    const linesByOwner = new Map<string, string[]>();
    const notifiedRequirementIds: string[] = [];

    for (const requirement of pending) {
      const owners = await this.ownersFor(requirement);
      if (owners.length === 0) {
        // Nobody to tell. Left un-stamped on purpose: an owner may list in that area next week,
        // and the age cutoff above is what stops it being retried forever.
        continue;
      }

      const where = requirement.area?.name ?? requirement.city?.name ?? 'your area';
      const budget = requirement.maxPrice ? ` up to ₹${requirement.maxPrice.toLocaleString('en-IN')}` : '';
      const by = requirement.moveInBy ? `, needed by ${requirement.moveInBy.toISOString().slice(0, 10)}` : '';
      const line = `${requirement.searchLabel} — in ${where}${budget}${by}`;

      for (const ownerId of owners) {
        linesByOwner.set(ownerId, [...(linesByOwner.get(ownerId) ?? []), line]);
      }
      notifiedRequirementIds.push(requirement.id);
    }

    if (linesByOwner.size === 0) {
      this.logger.log(`${pending.length} requirement(s) pending but no matching owners yet`);
      return;
    }

    const owners = await this.prisma.user.findMany({
      where: { id: { in: [...linesByOwner.keys()] } },
      select: { id: true, name: true, email: true, phone: true },
    });

    let sent = 0;
    for (const owner of owners) {
      const lines = linesByOwner.get(owner.id) ?? [];
      const channel = await this.notifications.notifyRequirementsToOwner(owner, lines).catch((error: unknown) => {
        this.logger.error(`Requirement match notification to ${owner.id} failed: ${String(error)}`);
        return null;
      });
      if (channel) sent++;
    }

    // Stamped even if some sends failed: retrying would re-notify everyone who did receive it,
    // and a duplicate is worse here than a miss. A renewal clears this and gives it another go.
    await this.prisma.requirement.updateMany({
      where: { id: { in: notifiedRequirementIds } },
      data: { ownersNotifiedAt: new Date() },
    });

    this.logger.log(
      `Notified ${sent}/${owners.length} owner(s) about ${notifiedRequirementIds.length} requirement(s)`,
    );
  }

  /** Owners with inventory that actually matches — same city and category, plus the same area
   * when the requirement names one. Capped, newest listings first, so a big city's whole owner
   * base is never notified at once. */
  private async ownersFor(requirement: {
    id: string;
    seekerId: string;
    cityId: string | null;
    areaId: string | null;
    category: string | null;
  }): Promise<string[]> {
    if (!requirement.cityId) return [];

    const listings = await this.prisma.listing.findMany({
      where: {
        cityId: requirement.cityId,
        ...(requirement.areaId ? { areaId: requirement.areaId } : {}),
        ...(requirement.category ? { category: requirement.category as never } : {}),
        // Never the seeker themselves, and never the bulk-import placeholder account.
        ownerId: { not: requirement.seekerId },
      },
      select: { ownerId: true },
      distinct: ['ownerId'],
      orderBy: { createdAt: 'desc' },
      take: OWNERS_PER_REQUIREMENT,
    });
    return listings.map((listing) => listing.ownerId);
  }
}
