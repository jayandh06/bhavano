import type { PinoLogger } from 'nestjs-pino';

/** One structured log line per client-reported UI error, shipped through pino to Loki the same
 * way `thirdPartyCallLogger.ts`'s `logThirdPartyCall` ships outbound-call logs — object first,
 * message second, matching `AllExceptionsFilter`'s own structured logging. Separate helper rather
 * than reusing `logThirdPartyCall` because the semantics differ: this is "a client told us it
 * crashed," not "we called a third party and got a response back." See
 * docs/plans/client-error-reporting-loki-grafana.md.
 *
 * Always logs at error level — a client error report is, by definition, always worth seeing.
 * Nothing here is authenticated or re-verified; `userId` is the client's own unverified claim. */
export function logClientError(params: {
  logger: PinoLogger;
  app: string;
  message: string;
  stack?: string;
  componentStack?: string;
  url?: string;
  digest?: string;
  userAgent?: string;
  appVersion?: string;
  userId?: string;
  ip?: string;
}): void {
  const { logger, ...fields } = params;
  logger.error(fields, 'client_error');
}
