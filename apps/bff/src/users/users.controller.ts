import { Controller, Get, UseGuards } from '@nestjs/common';
import type { ListingCardDto } from '@bhavano/types';
import { AuthGuard } from '../auth/guards/auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { RequestUser } from '../auth/guards/auth.guard';
import { ListingsService } from '../listings/listings.service';

@Controller('users/me')
@UseGuards(AuthGuard)
export class UsersController {
  constructor(private readonly listingsService: ListingsService) {}

  @Get('favourites')
  favourites(@CurrentUser() user: RequestUser): Promise<ListingCardDto[]> {
    return this.listingsService.listFavourites(user.id);
  }
}
