import { IsString, MaxLength } from 'class-validator';

/** The whole payload, deliberately: this endpoint's only job is to say "a real browser engine ran
 * on this session". It takes no client-supplied facts beyond the session id — no user agent, no
 * fingerprint, no device details — because anything a client *tells* us is exactly what `isBot`
 * already fails on. What makes this signal worth having is that the request happened at all,
 * which cannot be spoofed by a scraper that doesn't execute JavaScript.
 *
 * The session id isn't read from the client either: `bhavano_sid` is httpOnly, so web's
 * /api/analytics/confirm route handler reads the cookie server-side and forwards it here. */
export class ConfirmJsDto {
  @IsString()
  @MaxLength(64)
  sessionId!: string;
}
