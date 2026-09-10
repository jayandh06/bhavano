import { forwardRef, Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { ListingSlotsModule } from '../listing-slots/listing-slots.module';
import { ListingsModule } from '../listings/listings.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ContactRevealModule } from '../contact-reveal/contact-reveal.module';
import { PaymentsModule } from '../payments/payments.module';
import { EmailVerificationService } from './email-verification.service';
import { AccountMergeService } from './account-merge.service';
import { AccountDeletionService } from './account-deletion.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  // forwardRef both ways: AuthService needs AccountMergeService for linkPhone, and
  // UsersController needs AuthService to re-verify an OTP on the merge-confirm path.
  imports: [
    ListingSlotsModule,
    ListingsModule,
    NotificationsModule,
    ContactRevealModule,
    PaymentsModule,
    forwardRef(() => AuthModule),
  ],
  controllers: [UsersController],
  providers: [
    UsersService,
    EmailVerificationService,
    AccountMergeService,
    AccountDeletionService,
  ],
  exports: [AccountMergeService, AccountDeletionService],
})
export class UsersModule {}
