import { Body, Controller, Get, Headers, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { AdminPostFeedbackPage, PostFeedbackDto } from '@bhavano/types/postFeedback';
import { AdminGuard, AuthGuard } from '../auth/guards/auth.guard';
import type { RequestUser } from '../auth/guards/auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ListPostFeedbackDto } from './dto/list-post-feedback.dto';
import { SavePostFeedbackDto } from './dto/save-post-feedback.dto';
import { PostFeedbackService } from './post-feedback.service';

/** The poster's own side: read what they already answered for one of their listings, and save or update it. */
@Controller('feedback/post')
@UseGuards(AuthGuard)
export class PostFeedbackController {
  constructor(private readonly feedback: PostFeedbackService) {}

  /** `null` (an empty 200) when nothing has been answered yet. */
  @Get(':listingId')
  async getMine(@Param('listingId') listingId: string, @CurrentUser() user: RequestUser): Promise<PostFeedbackDto | null> {
    return this.feedback.getMine(user.id, listingId);
  }

  /** A star tap, a chip and the text each call this, so it is throttled well above one form's worth but below a script's. */
  @Post()
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  save(@Body() dto: SavePostFeedbackDto, @CurrentUser() user: RequestUser, @Headers('x-client') client?: string): Promise<PostFeedbackDto> {
    return this.feedback.save(user.id, dto, client);
  }
}

/** The admin Feedback screen. */
@Controller('admin/feedback/post')
@UseGuards(AdminGuard)
export class AdminPostFeedbackController {
  constructor(private readonly feedback: PostFeedbackService) {}

  @Get()
  list(@Query() query: ListPostFeedbackDto): Promise<AdminPostFeedbackPage> {
    return this.feedback.listForAdmin(query);
  }
}
