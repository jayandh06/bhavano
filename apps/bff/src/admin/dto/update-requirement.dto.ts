import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import type { RequirementStatus } from '@bhavano/types';

const REQUIREMENT_STATUSES: RequirementStatus[] = ['open', 'working', 'closed'];

export class UpdateRequirementDto {
  @IsOptional()
  @IsIn(REQUIREMENT_STATUSES)
  status?: RequirementStatus;

  /** What was done about it — who was called, which listing was suggested, why it was closed.
   * The only record of the manual follow-up that Phase 0 depends on. */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  adminNote?: string;
}
