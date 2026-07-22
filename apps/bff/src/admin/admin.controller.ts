import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import type {
  AdminListingsPage,
  ListingBoostsPage,
  ListingDetailDto,
  ListingOwnerDto,
  LoginEventsPage,
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
import { ListBoostsDto } from './dto/list-boosts.dto';
import { UpdateRateLimitsDto } from './dto/update-rate-limits.dto';
import { SearchUsersDto } from './dto/search-users.dto';

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

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
}
