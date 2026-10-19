import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

export class BulkAreaOverviewStatusDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsString({ each: true })
  areaIds!: string[];

  /** Bulk actions are publish and unpublish only; sending for review stays a one-area step. */
  @IsIn(['published', 'draft'])
  status!: 'published' | 'draft';

  @IsOptional()
  @IsBoolean()
  checklistConfirmed?: boolean;
}
