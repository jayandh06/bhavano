import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import type { AdminListingsPage, ListingDetailDto } from '@bhavano/types';
import { AdminGuard } from '../auth/guards/auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { RequestUser } from '../auth/guards/auth.guard';
import { AdminService } from './admin.service';
import { ListAdminListingsDto } from './dto/list-admin-listings.dto';
import { FlagListingDto } from './dto/flag-listing.dto';
import { SetReviewedDto } from './dto/set-reviewed.dto';

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
}
