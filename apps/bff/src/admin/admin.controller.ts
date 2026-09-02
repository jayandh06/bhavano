import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import type {
  AdminListingsPage,
  CampaignPreviewDto,
  CampaignSendsPage,
  ImportOutreachContactsResult,
  ListingBoostsPage,
  ListingDetailDto,
  ListingOwnerDto,
  LoginEventsPage,
  PageVisitsPage,
  OutreachCampaignDto,
  OutreachCampaignsPage,
  OutreachContactDto,
  OutreachContactsPage,
  RateLimitSettingsDto,
  UserActivityDto,
} from '@bhavano/types';
import { AdminGuard } from '../auth/guards/auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { RequestUser } from '../auth/guards/auth.guard';
import { AdminService } from './admin.service';
import { ListAdminListingsDto } from './dto/list-admin-listings.dto';
import { FlagListingDto } from './dto/flag-listing.dto';
import { SetReviewedDto } from './dto/set-reviewed.dto';
import { ListLoginsDto } from './dto/list-logins.dto';
import { ListPageVisitsDto } from './dto/list-page-visits.dto';
import { ListBoostsDto } from './dto/list-boosts.dto';
import { UpdateRateLimitsDto } from './dto/update-rate-limits.dto';
import { SearchUsersDto } from './dto/search-users.dto';
import { RotatePhotoDto } from '../listings/dto/rotate-photo.dto';
import { ListingPhotosService } from '../listings/listing-photos.service';
import {
  CreateOutreachCampaignDto,
  CreateOutreachContactDto,
  ImportOutreachContactsDto,
  ListCampaignSendsDto,
  ListOutreachCampaignsDto,
  ListOutreachContactsDto,
  OptOutDto,
  UpdateOutreachCampaignDto,
} from './dto/outreach.dto';
import { OutreachService } from '../outreach/outreach.service';
import { OutreachCampaignJob } from '../outreach/outreach-campaign.job';

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly outreachService: OutreachService,
    private readonly outreachCampaignJob: OutreachCampaignJob,
    private readonly listingPhotos: ListingPhotosService,
  ) {}

  @Get('listings')
  listListings(@Query() query: ListAdminListingsDto): Promise<AdminListingsPage> {
    return this.adminService.listListings(query);
  }

  @Patch('listings/:id/review')
  setReviewed(@Param('id') id: string, @Body() dto: SetReviewedDto): Promise<ListingDetailDto> {
    return this.adminService.setReviewed(id, dto.adminReviewed);
  }

  @Post('listings/:id/flag')
  flagListing(
    @Param('id') id: string,
    @Body() dto: FlagListingDto,
    @CurrentUser() user: RequestUser,
  ): Promise<ListingDetailDto> {
    return this.adminService.flagListing(id, user.id, dto.message);
  }

  @Post('listings/:id/approve')
  approveListing(@Param('id') id: string, @CurrentUser() user: RequestUser): Promise<ListingDetailDto> {
    return this.adminService.approveListing(id, user.id);
  }

  @Post('listings/:id/photos/:photoNo/rotate')
  rotatePhoto(
    @Param('id') id: string,
    @Param('photoNo') photoNo: string,
    @Body() dto: RotatePhotoDto,
  ): Promise<{ rotation: number }> {
    return this.listingPhotos.rotateAsAdmin(id, Number(photoNo), dto.turns);
  }

  @Post('listings/:id/photos/:photoNo/set-cover')
  setCoverPhoto(@Param('id') id: string, @Param('photoNo') photoNo: string): Promise<{ displayOrder: number }> {
    return this.listingPhotos.setCoverAsAdmin(id, Number(photoNo));
  }

  @Get('listings/:id/thread')
  getThread(@Param('id') id: string, @CurrentUser() user: RequestUser): Promise<{ id: string }> {
    return this.adminService.getThread(id, user.id);
  }

  @Get('listings/:id/owner')
  getListingOwner(@Param('id') id: string): Promise<ListingOwnerDto | null> {
    return this.adminService.getListingOwner(id);
  }

  @Get('logins')
  listRecentLogins(@Query() query: ListLoginsDto): Promise<LoginEventsPage> {
    return this.adminService.listRecentLogins(query);
  }

  @Get('page-visits')
  listPageVisits(@Query() query: ListPageVisitsDto): Promise<PageVisitsPage> {
    return this.adminService.listPageVisits(query);
  }

  @Get('users/search')
  searchUsers(@Query() query: SearchUsersDto): Promise<ListingOwnerDto[]> {
    return this.adminService.searchUsers(query.q, query.limit);
  }

  @Get('users/:id/activity')
  getUserActivity(@Param('id') id: string): Promise<UserActivityDto> {
    return this.adminService.getUserActivity(id);
  }

  @Get('rate-limits')
  getRateLimitSettings(): Promise<RateLimitSettingsDto> {
    return this.adminService.getRateLimitSettings();
  }

  @Patch('rate-limits')
  updateRateLimitSettings(@Body() dto: UpdateRateLimitsDto): Promise<RateLimitSettingsDto> {
    return this.adminService.updateRateLimitSettings(dto);
  }

  @Get('boosts')
  listBoosts(@Query() query: ListBoostsDto): Promise<ListingBoostsPage> {
    return this.adminService.listBoosts(query);
  }

  @Post('listings/:id/revoke-boost')
  async revokeBoost(@Param('id') id: string): Promise<{ success: true }> {
    await this.adminService.revokeBoost(id);
    return { success: true };
  }

  // --- Outreach contacts --------------------------------------------------

  @Get('outreach/contacts')
  listOutreachContacts(@Query() query: ListOutreachContactsDto): Promise<OutreachContactsPage> {
    return this.outreachService.listContacts(query);
  }

  @Post('outreach/contacts')
  createOutreachContact(@Body() dto: CreateOutreachContactDto): Promise<OutreachContactDto> {
    return this.outreachService.createContact(dto);
  }

  @Post('outreach/contacts/import')
  importOutreachContacts(@Body() dto: ImportOutreachContactsDto): Promise<ImportOutreachContactsResult> {
    return this.outreachService.importContacts({
      source: dto.source,
      sourceRef: dto.sourceRef,
      contacts: dto.contacts.map((c) => ({ ...c, source: c.source ?? dto.source })),
    });
  }

  @Post('outreach/contacts/:id/opt-out')
  async optOutContact(@Param('id') id: string, @Body() dto: OptOutDto): Promise<{ success: true }> {
    await this.outreachService.optOut(id, dto.reason);
    return { success: true };
  }

  // --- Campaigns ----------------------------------------------------------

  @Get('outreach/campaigns')
  listCampaigns(@Query() query: ListOutreachCampaignsDto): Promise<OutreachCampaignsPage> {
    return this.outreachService.listCampaigns(query);
  }

  @Get('outreach/campaigns/:id')
  getCampaign(@Param('id') id: string): Promise<OutreachCampaignDto> {
    return this.outreachService.getCampaign(id);
  }

  @Post('outreach/campaigns')
  createCampaign(
    @Body() dto: CreateOutreachCampaignDto,
    @CurrentUser() user: RequestUser,
  ): Promise<OutreachCampaignDto> {
    return this.outreachService.createCampaign(dto, user.id);
  }

  @Patch('outreach/campaigns/:id')
  updateCampaign(
    @Param('id') id: string,
    @Body() dto: UpdateOutreachCampaignDto,
  ): Promise<OutreachCampaignDto> {
    return this.outreachService.updateCampaign(id, dto);
  }

  /** Pre-flight: what the next run would do, without doing it. */
  @Get('outreach/campaigns/:id/preview')
  previewCampaign(@Param('id') id: string): Promise<CampaignPreviewDto> {
    return this.outreachService.previewCampaign(id);
  }

  /** Fire a campaign immediately instead of waiting for the hourly tick. Still honours the
   * campaign's own dryRun flag — this is "run now", not "bypass the safety". */
  @Post('outreach/campaigns/:id/run')
  async runCampaign(@Param('id') id: string): Promise<{ sent: number; failed: number; skipped: number }> {
    const campaign = await this.outreachService.requireCampaignRow(id);
    return this.outreachCampaignJob.runCampaign(campaign);
  }

  @Get('outreach/sends')
  listSends(@Query() query: ListCampaignSendsDto): Promise<CampaignSendsPage> {
    return this.outreachService.listSends(query);
  }
}
