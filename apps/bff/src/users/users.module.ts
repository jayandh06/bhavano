import { forwardRef, Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { ListingSlotsModule } from '../listing-slots/listing-slots.module';
import { ListingsModule } from '../listings/listings.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { EmailVerificationService } from './email-verification.service';
import { AccountMergeService } from './account-merge.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  // forwardRef both ways: AuthService needs AccountMergeService for linkPhone, and
  // UsersController needs AuthService to re-verify an OTP on the merge-confirm path.
  imports: [
    ListingSlotsModule,
    ListingsModule,
    NotificationsModule,
    forwardRef(() => AuthModule),
  ],
  controllers: [UsersController],
  providers: [UsersService, EmailVerificationService, AccountMergeService],
  exports: [AccountMergeService],
})
export class UsersModule {}
