import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { PhotoProcessingService } from './photo-processing.service';

@Module({
  imports: [StorageModule],
  providers: [PhotoProcessingService],
})
export class PhotoProcessingModule {}
