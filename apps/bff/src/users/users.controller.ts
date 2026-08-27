import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type {
  ListingCardDto,
  ListingDetailDto,
  UserProfileDto,
} from '@bhavano/types';
import { AuthGuard } from '../auth/guards/auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { RequestUser } from '../auth/guards/auth.guard';
import { ListingsService } from '../listings/listings.service';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { RequestEmailCodeDto, VerifyEmailDto } from './dto/verify-email.dto';
import { EmailVerificationService } from './email-verification.service';

@Controller('users/me')
@UseGuards(AuthGuard)
export class UsersController {
  constructor(
    private readonly listingsService: ListingsService,
    private readonly usersService: UsersService,
    private readonly emailVerification: EmailVerificationService,
  ) {}

  @Get()
  getProfile(@CurrentUser() user: RequestUser): Promise<UserProfileDto> {
    return this.usersService.getProfile(user.id);
  }

  @Patch()
  updateProfile(
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<UserProfileDto> {
    return this.usersService.updateProfile(user.id, dto);
  }

  /** Sending a code costs an email and reveals whether an address is taken, so it gets the same
   * budget as OTP send rather than the default. */
  @Post('email/request-code')
  @HttpCode(200)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  async requestEmailCode(
    @CurrentUser() user: RequestUser,
    @Body() dto: RequestEmailCodeDto,
  ): Promise<{ success: true }> {
    await this.emailVerification.requestCode(user.id, dto.email);
    return { success: true };
  }

  @Post('email/verify')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async verifyEmail(
    @CurrentUser() user: RequestUser,
    @Body() dto: VerifyEmailDto,
  ): Promise<UserProfileDto> {
    await this.emailVerification.verifyCode(user.id, dto.email, dto.code);
    return this.usersService.getProfile(user.id);
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
  myListing(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ): Promise<ListingDetailDto> {
    return this.listingsService.getMine(user.id, id);
  }
}
