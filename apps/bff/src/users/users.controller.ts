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
  LinkIdentifierResult,
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
import { ConfirmMergeDto } from './dto/confirm-merge.dto';
import { EmailVerificationService } from './email-verification.service';
import { AccountMergeService } from './account-merge.service';
import { AuthService } from '../auth/auth.service';

@Controller('users/me')
@UseGuards(AuthGuard)
export class UsersController {
  constructor(
    private readonly listingsService: ListingsService,
    private readonly usersService: UsersService,
    private readonly emailVerification: EmailVerificationService,
    private readonly accountMerge: AccountMergeService,
    private readonly authService: AuthService,
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
  verifyEmail(
    @CurrentUser() user: RequestUser,
    @Body() dto: VerifyEmailDto,
  ): Promise<LinkIdentifierResult> {
    return this.emailVerification.verifyCode(user.id, dto.email, dto.code);
  }

  /** Executes a merge the user was asked to approve, for the case where both accounts hold
   * something. The identifier was already proven in the request that returned `confirm`; this
   * re-proves ownership of the other account by requiring the same identifier again, so a stale
   * or forged call cannot merge accounts the caller does not control. */
  @Post('merge/confirm')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async confirmMerge(
    @CurrentUser() user: RequestUser,
    @Body() dto: ConfirmMergeDto,
  ): Promise<{ success: true }> {
    await this.accountMerge.confirmByIdentifier(
      user.id,
      { phone: dto.phone, email: dto.email, code: dto.code },
      {
        // Injected rather than imported so the merge service stays free of a dependency on the
        // auth module, which already depends on it.
        phone: (phone, code) => this.authService.assertOtpValid(phone, code),
        email: (uid, mail, code) =>
          this.emailVerification.assertCodeValid(uid, mail, code),
      },
    );
    return { success: true };
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
