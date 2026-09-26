import { IsString, MaxLength } from 'class-validator';

/** The analytics session (Visit) of the device the logged-in caller is on. Only ever fills an
 * unclaimed row — see AnalyticsService.linkVisitToUser — so naming a session that already belongs
 * to someone is a no-op, not a takeover. */
export class LinkSessionDto {
  @IsString()
  @MaxLength(64)
  sessionId!: string;
}
