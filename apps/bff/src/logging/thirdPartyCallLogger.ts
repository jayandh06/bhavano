import type { PinoLogger } from 'nestjs-pino';

/** 10-digit Indian mobile number, optionally prefixed with the country code — matches how phone
 * numbers appear in this codebase (`91${phone}`) and in a provider's own response payload. */
const PHONE_PATTERN = /(?:91)?[6-9]\d{9}/g;
const EMAIL_PATTERN = /[\w.+-]+@[\w-]+\.[\w.-]+/g;

/** "9876543210" -> "98******10" — enough to spot-check which real request a log line came from
 * without exposing the full number to everyone with Grafana access. */
export function maskPhone(phone: string): string {
  if (phone.length <= 4) return '*'.repeat(phone.length);
  return phone.slice(0, 2) + '*'.repeat(phone.length - 4) + phone.slice(-2);
}

/** "seller@example.com" -> "s***@example.com" — keeps the domain (useful for spotting a typo'd
 * or throwaway address) and only the first character of the local part. */
export function maskEmail(email: string): string {
  const at = email.indexOf('@');
  if (at <= 0) return '*'.repeat(email.length);
  return `${email[0]}***${email.slice(at)}`;
}

/** Defense-in-depth for a third party's own response text, whose exact shape isn't ours to
 * control — masks anything that *looks* like a phone number or email, regardless of what field
 * name it travels under. Callers that already know a response is safe (e.g. Google Maps' place
 * names) still run it through this before logging, since a third party can change their response
 * shape without any change on our side.
 *
 * Deliberately doesn't also mask "any long token-looking string" — none of the providers this
 * logs for ever put a live secret in a *response* body (credentials travel in request headers,
 * which never reach this logger), and a blunt long-string mask would hide the one thing these
 * logs exist to show: MSG91/WhatsApp's own message id, which the provider's own comment already
 * relies on being visible to verify `extractMessageId` against. */
export function scrubResponseText(text: string): string {
  return text.replace(EMAIL_PATTERN, (m) => maskEmail(m)).replace(PHONE_PATTERN, (m) => maskPhone(m));
}

/** Removes one query-param's value from a URL, e.g. `maskUrlParam(url, 'key')` for Google Maps'
 * API key, which travels in the query string rather than a header (a header never reaches this
 * logger at all, since none of these call sites pass headers into `logThirdPartyCall`). Falls
 * back to the original string if the URL doesn't parse, rather than throwing over a logging
 * concern. */
export function maskUrlParam(url: string, paramName: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.searchParams.has(paramName)) {
      parsed.searchParams.set(paramName, '***');
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

/** One structured log line per outbound third-party call, shipped through pino to Loki exactly
 * like `AllExceptionsFilter`'s own structured logging (object first, message second) — see
 * docs/plans/third-party-api-call-audit-logging.md for why this exists and what it deliberately
 * leaves out (OTP codes, template variable values, Razorpay, OAuth tokens).
 *
 * `request` is the CALLER's own hand-built summary of what it sent — never the raw payload — so
 * the caller, which already knows exactly which of its own fields are sensitive, decides what's
 * safe to log. `responseText`, in contrast, is the third party's own raw text and is always run
 * through `scrubResponseText` here, since its shape isn't ours to control. */
export function logThirdPartyCall(params: {
  logger: PinoLogger;
  provider: string;
  method: string;
  url: string;
  request?: unknown;
  status?: number;
  responseText?: string;
  ok: boolean;
}): void {
  const fields = {
    provider: params.provider,
    method: params.method,
    url: params.url,
    request: params.request,
    status: params.status,
    response: params.responseText !== undefined ? scrubResponseText(params.responseText) : undefined,
  };
  if (params.ok) {
    params.logger.info(fields, 'third_party_call');
  } else {
    params.logger.error(fields, 'third_party_call_failed');
  }
}
