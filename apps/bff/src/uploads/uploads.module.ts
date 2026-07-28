import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { UploadsController } from './uploads.controller';
import { VideoUploadsController } from './video-uploads.controller';

@Module({
  imports: [StorageModule],
  controllers: [UploadsController, VideoUploadsController],
})
export class UploadsModule {}
