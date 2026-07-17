import { Injectable } from '@nestjs/common';
import type { AdminListingsPage, ListingDetailDto } from '@bhavano/types';
import { PrismaService } from '../prisma/prisma.service';
import { ListingsService } from '../listings/listings.service';
import { MessagingService } from '../messaging/messaging.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ListAdminListingsDto } from './dto/list-admin-listings.dto';

const APPROVED_MESSAGE = 'Your listing has been reviewed and is live again.';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly listingsService: ListingsService,
    private readonly messagingService: MessagingService,
    private readonly notificationsService: NotificationsService,
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

    const owner = await this.getOwnerContact(id);
    if (owner) await this.notificationsService.notifyListingFlagged(owner, listing, message);

    return listing;
  }

  async approveListing(id: string, adminId: string): Promise<ListingDetailDto> {
    const listing = await this.listingsService.approve(id);
    const thread = await this.messagingService.getOrCreateModerationThread(id, adminId);
    await this.messagingService.sendMessage(thread.id, adminId, APPROVED_MESSAGE);

    const owner = await this.getOwnerContact(id);
    if (owner) await this.notificationsService.notifyListingApproved(owner, listing);

    return listing;
  }

  private async getOwnerContact(listingId: string): Promise<{ email: string | null; phone: string | null } | null> {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: { owner: { select: { email: true, phone: true } } },
    });
    return listing?.owner ?? null;
  }
}
