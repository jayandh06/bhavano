import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class MergeUsersDto {
  @IsString()
  @MinLength(1)
  winnerId!: string;

  @IsString()
  @MinLength(1)
  loserId!: string;

  /** Free text for the UserMergeAction audit row — not required, but every admin tool this
   * destructive should at least invite one. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
