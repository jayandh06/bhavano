import { IsIP, IsOptional, IsString, MaxLength } from 'class-validator';

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

  /** Sent by web's middleware, which reads it from X-Forwarded-For. `@IsIP` rather than a plain
   * string: this endpoint is public and unauthenticated, so the one field that will end up in
   * abuse investigations should not accept arbitrary text. */
  @IsOptional()
  @IsIP()
  ip?: string;
}
