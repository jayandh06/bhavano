import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { ListingSlotsModule } from '../listing-slots/listing-slots.module';
import { ListingsModule } from '../listings/listings.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { EmailVerificationService } from './email-verification.service';
import { AccountMergeService } from './account-merge.service';

@Module({
  imports: [ListingSlotsModule, ListingsModule, NotificationsModule],
  controllers: [UsersController],
  providers: [UsersService, EmailVerificationService, AccountMergeService],
  exports: [AccountMergeService],
})
export class UsersModule {}
