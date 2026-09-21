import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/** Pagination for GET /admin/users/:userId/login-history — same shape as
 * ListListingEngagementDto, a very active user's full login history is the only realistic way
 * this ever needs more than one page. */
export class ListUserLoginHistoryDto {
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
  limit: number = 50;
}
