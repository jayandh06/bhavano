import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RecordVisitDto {
  @IsString()
  @MaxLength(64)
  sessionId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  source?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  medium?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  campaign?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  landingPath?: string;
}
