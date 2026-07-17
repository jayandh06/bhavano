import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import type { ListingCardDto, ListingDetailDto, UserProfileDto } from '@bhavano/types';
import { AuthGuard } from '../auth/guards/auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { RequestUser } from '../auth/guards/auth.guard';
import { ListingsService } from '../listings/listings.service';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Controller('users/me')
@UseGuards(AuthGuard)
export class UsersController {
  constructor(
    private readonly listingsService: ListingsService,
    private readonly usersService: UsersService,
  ) {}

  @Get()
  getProfile(@CurrentUser() user: RequestUser): Promise<UserProfileDto> {
    return this.usersService.getProfile(user.id);
  }

  @Patch()
  updateProfile(@CurrentUser() user: RequestUser, @Body() dto: UpdateProfileDto): Promise<UserProfileDto> {
    return this.usersService.updateProfile(user.id, dto);
  }

  @Get('favourites')
  favourites(@CurrentUser() user: RequestUser): Promise<ListingCardDto[]> {
    return this.listingsService.listFavourites(user.id);
  }

  @Get('listings')
  myListings(@CurrentUser() user: RequestUser): Promise<ListingDetailDto[]> {
    return this.listingsService.listMine(user.id);
  }

  @Get('listings/:id')
  myListing(@Param('id') id: string, @CurrentUser() user: RequestUser): Promise<ListingDetailDto> {
    return this.listingsService.getMine(user.id, id);
  }
}
