import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

const SHARE_CHANNELS = ['whatsapp', 'copy', 'share_sheet', 'email', 'facebook'] as const;

export class RecordShareTapDto {
  /** The referrer's own per-session id — same field RecordReferralClickDto uses; the referrer is
   * already known from the request's auth token, this is only for the funnel's own session
   * bookkeeping, same shape as every other analytics-adjacent id in this app. */
  @IsString()
  @MaxLength(64)
  sessionId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  listingId?: string;

  /** Which button/menu entry was tapped — see ReferralClick.channel's own doc comment. */
  @IsOptional()
  @IsIn(SHARE_CHANNELS)
  channel?: (typeof SHARE_CHANNELS)[number];
}
