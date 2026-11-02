import { Module } from '@nestjs/common';
import { AdminPostFeedbackController, PostFeedbackController } from './post-feedback.controller';
import { PostFeedbackService } from './post-feedback.service';

@Module({
  controllers: [PostFeedbackController, AdminPostFeedbackController],
  providers: [PostFeedbackService],
  exports: [PostFeedbackService],
})
export class FeedbackModule {}
