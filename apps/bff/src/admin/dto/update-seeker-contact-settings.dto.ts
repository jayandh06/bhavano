import { IsBoolean, IsIn, IsInt, Max, Min } from 'class-validator';

export class UpdateSeekerContactSettingsDto {
  @IsBoolean()
  enabled!: boolean;

  @IsIn(['notice', 'opt_in'])
  consentMode!: 'notice' | 'opt_in';

  @IsInt()
  @Min(0)
  @Max(50)
  freeLeadRevealsPerOwner!: number;
}
