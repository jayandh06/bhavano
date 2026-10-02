import { Module } from '@nestjs/common';
import { ReferralsController } from './referrals.controller';
import { ReferralsService } from './referrals.service';
import { ReferralsAdminService } from './referrals-admin.service';

@Module({
  controllers: [ReferralsController],
  providers: [ReferralsService, ReferralsAdminService],
  exports: [ReferralsService, ReferralsAdminService],
})
export class ReferralsModule {}
