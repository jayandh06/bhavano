import { IsIn, IsIP, IsOptional, IsString, MaxLength } from 'class-validator';

const CLIENT_APPS = ['web', 'admin', 'mobile'] as const;
export type ClientApp = (typeof CLIENT_APPS)[number];

/** Public, unauthenticated — a browser/app tells us it just crashed, which can happen before any
 * login. Every field but `app`/`message` is optional, so a partial report (e.g. mobile with no
 * `digest`, which is a Next.js-only concept) still goes through. `@MaxLength` on every string
 * field bounds the worst case instead of a body-level size config change — same approach
 * `RecordVisitDto` already uses for this app's other public endpoints.
 *
 * Nothing here is authenticated or trusted: `userId` is the client's own unverified claim (read
 * from a locally-decoded token, never re-verified here), useful as a debugging hint and nothing
 * more — never use it for an authorization decision. See
 * docs/plans/client-error-reporting-loki-grafana.md. */
export class CreateClientErrorDto {
  @IsIn(CLIENT_APPS)
  app!: ClientApp;

  @IsString()
  @MaxLength(500)
  message!: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  stack?: string;

  /** React's own field (`ErrorInfo.componentStack`) — which component was rendering when a
   * render-time error was caught. Not present for an error caught outside a render boundary
   * (e.g. mobile's `ErrorUtils.setGlobalHandler` path). */
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  componentStack?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  url?: string;

  /** Next.js's own opaque error-boundary correlation id (`error.digest`) — lets a report be
   * matched back to the corresponding server-side log line for the same failure, when there is
   * one. Web/admin only; mobile has no equivalent. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  digest?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  userAgent?: string;

  /** Mobile's own app version (`Constants.expoConfig?.version`) — no equivalent signal exists
   * anywhere else in this codebase today (confirmed: no app-version header on any existing BFF
   * call), so this is the first place it's threaded through. */
  @IsOptional()
  @IsString()
  @MaxLength(50)
  appVersion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  userId?: string;

  /** Forwarded explicitly by web/admin's own Server Action, same reasoning as
   * `RecordVisitDto.ip`: a call proxied through a Server Action reaches the BFF from the Next.js
   * container itself, so `req.ip` there is the container's address, not the real visitor's.
   * Mobile calls the BFF directly, so it never needs to set this — the controller falls back to
   * `req.ip` when this is absent. */
  @IsOptional()
  @IsIP()
  ip?: string;
}
