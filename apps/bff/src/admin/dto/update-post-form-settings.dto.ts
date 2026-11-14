import { IsInt, Max, Min } from 'class-validator';

export class UpdatePostFormSettingsDto {
  /** Share of visitors (0 to 100) who get the redesigned post-ad Details form. */
  @IsInt()
  @Min(0)
  @Max(100)
  v2Percent!: number;
}
