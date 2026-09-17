import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import type { RequirementStatus } from '@bhavano/types';

const REQUIREMENT_STATUSES: RequirementStatus[] = ['open', 'working', 'closed'];

export class ListRequirementsDto {
  @IsOptional()
  @IsIn(REQUIREMENT_STATUSES)
  status?: RequirementStatus;

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
