import { IsOptional, IsString, MaxLength } from 'class-validator';

export class GoogleLoginDto {
  @IsString()
  idToken!: string;

  /** First-touch attribution captured by web's middleware.ts — see AuthService.loginWithGoogle. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  acquisitionSource?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  acquisitionMedium?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  acquisitionCampaign?: string;

  /** See VerifyOtpDto.sessionId — same purpose, for the Google login path. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  sessionId?: string;
}
