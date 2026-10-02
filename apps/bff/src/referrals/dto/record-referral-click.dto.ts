import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RecordReferralClickDto {
  /** The referrer's own user id — carried by the shared link as `?ref=<userId>` (web) or the
   * mobile deep link's equivalent query param. Not validated as a real user id here; an unknown
   * or malformed value is simply a click that attributes to nothing, same stance
   * `attributeSignupIfReferred` takes at signup time. */
  @IsString()
  @MaxLength(64)
  referralCode!: string;

  /** The visitor's per-session id (web's `bhavano_sid` cookie, or the mobile app's in-process
   * session id) — same field web's `/analytics/visit` already uses, see RecordVisitDto. */
  @IsString()
  @MaxLength(64)
  sessionId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  landingListingId?: string;
}
