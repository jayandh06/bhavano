import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  ActivityEventDto,
  AdminListingsPage,
  ListingDetailDto,
  ListingOwnerDto,
  LoginEventsPage,
  RateLimitSettingsDto,
  UserActivityDto,
} from '@bhavano/types';
import { PrismaService } from '../prisma/prisma.service';
import { ListingsService } from '../listings/listings.service';
import { MessagingService } from '../messaging/messaging.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RateLimitService } from '../rate-limit/rate-limit.service';
import { ListAdminListingsDto } from './dto/list-admin-listings.dto';
import { ListLoginsDto } from './dto/list-logins.dto';
import { UpdateRateLimitsDto } from './dto/update-rate-limits.dto';

const APPROVED_MESSAGE = 'Your listing has been reviewed and is live again.';
const ACTIVITY_LIMIT_PER_SOURCE = 50;
const ACTIVITY_TIMELINE_CAP = 100;

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly listingsService: ListingsService,
    private readonly messagingService: MessagingService,
    private readonly notificationsService: NotificationsService,
    private readonly rateLimitService: RateLimitService,
  ) {}

  listListings(query: ListAdminListingsDto): Promise<AdminListingsPage> {
    return this.listingsService.listForAdmin(query);
  }

  setReviewed(id: string, adminReviewed: boolean): Promise<ListingDetailDto> {
    return this.listingsService.setAdminReviewed(id, adminReviewed);
  }

  /** Get-or-create is safe/idempotent here — used by the admin UI to open a listing's
   * moderation thread for ongoing back-and-forth, not just the one-shot flag/approve notes. */
  async getThread(id: string, adminId: string): Promise<{ id: string }> {
    const thread = await this.messagingService.getOrCreateModerationThread(id, adminId);
    return { id: thread.id };
  }

  /** The combined soft-delete + notify-owner action: takes the listing offline, posts the
   * discrepancy as the first message of the admin↔owner moderation thread, and emails/texts
   * the owner so they don't have to notice the message on their own. */
  async flagListing(id: string, adminId: string, message: string): Promise<ListingDetailDto> {
    const listing = await this.listingsService.flag(id);
    const thread = await this.messagingService.getOrCreateModerationThread(id, adminId);
    await this.messagingService.sendMessage(thread.id, adminId, message);

    const owner = await this.getListingOwner(id);
    if (owner) await this.notificationsService.notifyListingFlagged(owner, listing, message);

    return listing;
  }

  async approveListing(id: string, adminId: string): Promise<ListingDetailDto> {
    const listing = await this.listingsService.approve(id);
    const thread = await this.messagingService.getOrCreateModerationThread(id, adminId);
    await this.messagingService.sendMessage(thread.id, adminId, APPROVED_MESSAGE);

    const owner = await this.getListingOwner(id);
    if (owner) await this.notificationsService.notifyListingApproved(owner, listing);

    return listing;
  }

  /** Used both internally (flag/approve notifications) and by the admin UI's listing-detail
   * page, which links to /users/:id/activity from here without ownerId ever appearing in the
   * public ListingDetailDto. */
  async getListingOwner(listingId: string): Promise<ListingOwnerDto | null> {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: { owner: { select: { id: true, name: true, phone: true, email: true } } },
    });
    return listing?.owner ?? null;
  }

  async listRecentLogins(query: ListLoginsDto): Promise<LoginEventsPage> {
    const { cursor, from, to, limit } = query;
    const where: Prisma.LoginEventWhereInput = {
      ...(from || to
        ? { createdAt: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.loginEvent.findMany({
        where,
        include: { user: { select: { name: true, phone: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      }),
      this.prisma.loginEvent.count({ where }),
    ]);

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    return {
      items: page.map((row) => ({
        id: row.id,
        userId: row.userId,
        userName: row.user.name,
        userPhone: row.user.phone,
        userEmail: row.user.email,
        method: row.method,
        createdAt: row.createdAt.toISOString(),
      })),
      nextCursor: hasMore ? page[page.length - 1].id : null,
      total,
    };
  }

  /** Merges several tables that each already carry a userId-ish field + timestamp (logins,
   * owned listings, sent messages, favourites, viewed listings) into one sorted timeline,
   * rather than duplicating that data into a new unified log table. */
  async getUserActivity(userId: string): Promise<UserActivityDto> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { city: true } });
    if (!user) throw new NotFoundException(`User ${userId} not found`);

    const [logins, listings, messages, favourites, views] = await Promise.all([
      this.prisma.loginEvent.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: ACTIVITY_LIMIT_PER_SOURCE,
      }),
      this.prisma.listing.findMany({
        where: { ownerId: userId },
        orderBy: { createdAt: 'desc' },
        take: ACTIVITY_LIMIT_PER_SOURCE,
        select: { id: true, title: true, createdAt: true, updatedAt: true },
      }),
      this.prisma.message.findMany({
        where: { senderId: userId },
        orderBy: { createdAt: 'desc' },
        take: ACTIVITY_LIMIT_PER_SOURCE,
        select: { id: true, body: true, createdAt: true },
      }),
      this.prisma.favourite.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: ACTIVITY_LIMIT_PER_SOURCE,
        include: { listing: { select: { title: true } } },
      }),
      this.prisma.listingView.findMany({
        where: { viewerKey: `user:${userId}` },
        orderBy: { createdAt: 'desc' },
        take: ACTIVITY_LIMIT_PER_SOURCE,
        include: { listing: { select: { title: true } } },
      }),
    ]);

    const events: ActivityEventDto[] = [
      ...logins.map((l) => ({
        type: 'login' as const,
        timestamp: l.createdAt.toISOString(),
        summary: `Logged in via ${l.method}`,
        refId: l.id,
      })),
      ...listings.map((l) => ({
        type: 'listing_posted' as const,
        timestamp: l.createdAt.toISOString(),
        summary: `Posted listing "${l.title}"`,
        refId: l.id,
      })),
      ...listings
        .filter((l) => l.updatedAt.getTime() !== l.createdAt.getTime())
        .map((l) => ({
          type: 'listing_updated' as const,
          timestamp: l.updatedAt.toISOString(),
          summary: `Updated listing "${l.title}"`,
          refId: l.id,
        })),
      ...messages.map((m) => ({
        type: 'message_sent' as const,
        timestamp: m.createdAt.toISOString(),
        summary: `Sent a message: "${m.body.slice(0, 60)}"`,
        refId: m.id,
      })),
      ...favourites.map((f) => ({
        type: 'favourite_added' as const,
        timestamp: f.createdAt.toISOString(),
        summary: `Favourited "${f.listing.title}"`,
        refId: f.listingId,
      })),
      ...views.map((v) => ({
        type: 'listing_viewed' as const,
        timestamp: v.createdAt.toISOString(),
        summary: `Viewed "${v.listing.title}"`,
        refId: v.listingId,
      })),
    ]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, ACTIVITY_TIMELINE_CAP);

    return {
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        cityName: user.city?.name ?? null,
        role: user.role,
        createdAt: user.createdAt.toISOString(),
      },
      events,
    };
  }

  getRateLimitSettings(): Promise<RateLimitSettingsDto> {
    return this.rateLimitService.getSettings();
  }

  updateRateLimitSettings(dto: UpdateRateLimitsDto): Promise<RateLimitSettingsDto> {
    return this.rateLimitService.updateSettings(dto);
  }
}
