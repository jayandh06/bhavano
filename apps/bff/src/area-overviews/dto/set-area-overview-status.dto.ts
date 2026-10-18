import { IsBoolean, IsIn, IsOptional } from 'class-validator';

export class SetAreaOverviewStatusDto {
  @IsIn(['draft', 'in_review', 'published'])
  status!: 'draft' | 'in_review' | 'published';

  /** The reviewer ticked every item of AREA_OVERVIEW_REVIEW_CHECKLIST. Required to publish. */
  @IsOptional()
  @IsBoolean()
  checklistConfirmed?: boolean;
}
