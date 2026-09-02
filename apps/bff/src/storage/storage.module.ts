import { Module } from '@nestjs/common';
import { R2StorageService } from './r2-storage.service';
import { CdnPurgeService } from './cdn-purge.service';

@Module({
  providers: [R2StorageService, CdnPurgeService],
  exports: [R2StorageService, CdnPurgeService],
})
export class StorageModule {}
