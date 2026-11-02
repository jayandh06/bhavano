import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import {
  POST_FEEDBACK_DIFFICULTIES,
  POST_FEEDBACK_MAX_SUGGESTION,
  POST_FEEDBACK_SOURCES,
  type PostFeedbackDifficulty,
  type PostFeedbackSource,
  type SavePostFeedbackRequest,
} from '@bhavano/types/postFeedback';

export class SavePostFeedbackDto implements SavePostFeedbackRequest {
  @IsString()
  @MaxLength(64)
  listingId!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(POST_FEEDBACK_DIFFICULTIES.length)
  @IsIn(POST_FEEDBACK_DIFFICULTIES, { each: true })
  difficulties?: PostFeedbackDifficulty[];

  @IsOptional()
  @IsString()
  @MaxLength(POST_FEEDBACK_MAX_SUGGESTION)
  suggestion?: string;

  @IsOptional()
  @IsBoolean()
  canContact?: boolean;

  @IsOptional()
  @IsIn(POST_FEEDBACK_SOURCES)
  source?: PostFeedbackSource;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  platform?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  appVersion?: string;
}
