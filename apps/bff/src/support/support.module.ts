import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { StorageModule } from '../storage/storage.module';
import { SupportController } from './support.controller';
import { SupportRetentionJob } from './support-retention.job';
import { SupportService } from './support.service';

@Module({
  imports: [NotificationsModule, StorageModule],
  controllers: [SupportController],
  providers: [SupportService, SupportRetentionJob],
})
export class SupportModule {}
