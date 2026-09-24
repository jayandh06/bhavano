import { IsBoolean, IsIP, IsOptional, IsString, MaxLength } from 'class-validator';

export class RecordPageViewDto {
  @IsString()
  @MaxLength(64)
  sessionId!: string;

  @IsString()
  @MaxLength(500)
  path!: string;

  /** Only used if this session turns out to have no Visit row yet — see
   * AnalyticsService.backfillMissingVisit. Never stored on the PageView row itself, which is
   * deliberately just (sessionId, path, createdAt). Optional so an older web build that doesn't
   * send them still records page views exactly as before. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  ip?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  userAgent?: string;

  /** True when this request came from the mobile app (see apps/mobile SoftNavAppPageViews) —
   * same meaning as RecordVisitDto.fromApp. Needed on pageview because backfillMissingVisit may
   * create the Visit row before /analytics/visit lands; without this, that recovered row would
   * be classified from the RN User-Agent as plain "mobile" instead of "mobile_app". */
  @IsOptional()
  @IsBoolean()
  fromApp?: boolean;
}
