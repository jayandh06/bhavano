import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { VideoProcessingService } from './video-processing.service';
import { VideoTmpSweeperService } from './video-tmp-sweeper.service';

@Module({
  imports: [StorageModule],
  providers: [VideoProcessingService, VideoTmpSweeperService],
})
export class VideoProcessingModule {}
