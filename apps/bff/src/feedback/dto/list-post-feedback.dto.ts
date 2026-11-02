import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { POST_FEEDBACK_DIFFICULTIES, POST_FEEDBACK_SOURCES, type PostFeedbackDifficulty, type PostFeedbackSource } from '@bhavano/types/postFeedback';

/** Filters for the admin Feedback screen (GET /admin/feedback/post). */
export class ListPostFeedbackDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  /** Exactly this many stars. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  /** `low` is 1 to 2 stars, the answers worth reading first. */
  @IsOptional()
  @IsIn(['low'])
  band?: 'low';

  @IsOptional()
  @IsIn(POST_FEEDBACK_DIFFICULTIES)
  difficulty?: PostFeedbackDifficulty;

  @IsOptional()
  @IsIn(POST_FEEDBACK_SOURCES)
  source?: PostFeedbackSource;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  category?: string;

  @IsOptional()
  @IsIn(['web', 'app'])
  platform?: 'web' | 'app';

  /** Only answers that include a written suggestion. */
  @IsOptional()
  @IsIn(['yes'])
  hasText?: 'yes';

  /** Only answers whose author said we may contact them. */
  @IsOptional()
  @IsIn(['yes'])
  canContact?: 'yes';

  @IsOptional()
  @IsString()
  @MaxLength(64)
  listingId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  userId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 25;
}
