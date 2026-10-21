import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

/** The analytics session (Visit) of the device the logged-in caller is on. Only ever fills an
 * unclaimed row — see AnalyticsService.linkVisitToUser — so naming a session that already belongs
 * to someone is a no-op, not a takeover. */
export class LinkSessionDto {
  @IsString()
  @MaxLength(64)
  sessionId!: string;

  /** The website browsing session this install came from — the `ws` value the website's "Get the app" links put
   * in the Play install referrer, kept by the app until login. Linking it makes the person's web visits show
   * under their account instead of staying anonymous. Only fills an existing, unclaimed web Visit. */
  @IsOptional()
  @IsUUID()
  webSessionId?: string;
}
