import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import { createHash } from 'crypto';

/** Fixed, permanent conversion action ids for this account's two UPLOAD_CLICKS actions —
 * created once by ads_create_offline_conversion_actions.py, not worth re-resolving on every
 * call. Same treatment as gtm_build.py's ADS_CONVERSION_LABELS. Distinct from (and not a
 * replacement for) the older WEBPAGE-type "New registration"/"Post ad success" actions, which
 * type doesn't support events:ingest — see
 * docs/plans/server-side-google-ads-conversion-upload.md. */
export const NEW_REGISTRATION_CONVERSION_ACTION_ID = '7750776144';
export const POST_AD_SUCCESS_CONVERSION_ACTION_ID = '7750575968';

interface UploadClickConversionInput {
  /** Optional — Google's own guidance for this account was "you are only importing events that
   * have both user-provided data and a click ID; send all events that have user-provided data,
   * regardless of click ID" (Enhanced Conversions can match a hashed email/phone against Google's
   * own identity graph without a gclid at all). `adIdentifiers` is only included in the request
   * when this is present; the call still proceeds on `email`/`phone` alone. */
  gclid?: string;
  conversionActionId: string;
  /** Dedup key: a repeated ingest with the same transactionId (within the same conversion
   * action) updates the existing event rather than creating a second one, so retries can't
   * double-count. Derive it from the business event's own identity (e.g. `signup-${user.id}`),
   * not a timestamp — unambiguous regardless of exact call timing. */
  transactionId: string;
  /** The business event's own timestamp (e.g. User.createdAt) — never "now". */
  eventTimestamp: Date;
  email?: string | null;
  phone?: string | null;
}

const AW_CUSTOMER_ID = '4214066478';
const INGEST_URL = 'https://datamanager.googleapis.com/v1/events:ingest';

/** gRPC-style status codes (google.rpc.Code) that mean the request or current state was
 * invalid — not transient, and not something a retry would fix on its own, but also not worth
 * more than a log line since this call is fire-and-forget and never blocks the flow it's
 * reporting on. */
const REQUEST_ERROR_CODES = new Set([
  'INVALID_ARGUMENT',
  'NOT_FOUND',
  'PERMISSION_DENIED',
  'FAILED_PRECONDITION',
  'UNAUTHENTICATED',
]);

/** Reports a conversion to Google Ads directly from the backend (Data Manager API's
 * events:ingest), preferring a gclid captured server-side at landing (see
 * apps/web/src/middleware.ts) when there is one — immune to the client-side GTM tracking an ad
 * blocker or restrictive browser can silently drop — but not requiring one: an event with only
 * hashed email/phone still gets sent, so Enhanced Conversions matching can find it without a
 * click id (see uploadClickConversion's own doc comment for why). See
 * docs/plans/server-side-google-ads-conversion-upload.md for the full design, why this targets
 * dedicated UPLOAD_CLICKS conversion actions rather than the older WEBPAGE-type ones, and why
 * the equivalent GTM client-side Ads tags were paused rather than left running alongside this.
 *
 * Raw REST over fetch, not a client library — same philosophy as this repo's gtm_api.py: not
 * worth a full SDK for one endpoint. No developer-token header — Data Manager API doesn't use
 * one; access is scoped entirely by the OAuth credentials. */
@Injectable()
export class GoogleAdsConversionProvider {
  private readonly logger = new Logger(GoogleAdsConversionProvider.name);
  private readonly client: OAuth2Client;

  constructor(private readonly config: ConfigService) {
    this.client = new OAuth2Client(
      this.config.get<string>('GOOGLE_ADS_CLIENT_ID'),
      this.config.get<string>('GOOGLE_ADS_CLIENT_SECRET'),
    );
    this.client.setCredentials({
      refresh_token: this.config.get<string>('GOOGLE_ADS_REFRESH_TOKEN'),
    });
  }

  /** Never throws — a failure here must never break the signup/listing-post flow it's reporting
   * on. Skip calling this entirely when there's neither a gclid nor any user-provided data —
   * nothing Google could match the event to either way, not worth a network round trip to find
   * out. A gclid alone or email/phone alone are both enough to proceed. */
  async uploadClickConversion(input: UploadClickConversionInput): Promise<void> {
    const userIdentifiers = buildUserIdentifiers(input.email, input.phone);
    if (!input.gclid && !userIdentifiers) return;

    let accessToken: string | null | undefined;
    try {
      ({ token: accessToken } = await this.client.getAccessToken());
    } catch (e) {
      this.logger.warn(
        `Failed to mint an access token for Google Ads conversion upload: ${describeError(e)}`,
      );
      return;
    }
    if (!accessToken) return;

    const body = {
      destinations: [
        {
          operatingAccount: { accountType: 'GOOGLE_ADS', accountId: AW_CUSTOMER_ID },
          productDestinationId: input.conversionActionId,
        },
      ],
      encoding: 'HEX',
      events: [
        {
          eventTimestamp: input.eventTimestamp.toISOString(),
          transactionId: input.transactionId,
          ...(input.gclid ? { adIdentifiers: { gclid: input.gclid } } : {}),
          ...(userIdentifiers ? { userData: { userIdentifiers } } : {}),
          eventSource: 'WEB',
        },
      ],
    };

    try {
      const res = await fetch(INGEST_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}) as Record<string, unknown>);
        this.logOutcome(json);
      }
    } catch (e) {
      this.logger.warn(`Google Ads conversion upload request failed: ${describeError(e)}`);
    }
  }

  private logOutcome(error: unknown): void {
    const message = JSON.stringify(error);
    const isRequestError = [...REQUEST_ERROR_CODES].some((code) => message.includes(code));
    if (isRequestError) {
      this.logger.warn(`Google Ads conversion upload rejected: ${message}`);
    } else {
      // UNAVAILABLE/DEADLINE_EXCEEDED/INTERNAL/UNKNOWN/ABORTED — transient. No retry: this is a
      // fire-and-forget one-shot call, and the transactionId dedup means a future manual
      // reconciliation wouldn't double-count if one were ever added.
      this.logger.debug(`Google Ads conversion upload transient failure: ${message}`);
    }
  }
}

function buildUserIdentifiers(
  email?: string | null,
  phone?: string | null,
): Array<{ emailAddress: string } | { phoneNumber: string }> | undefined {
  const identifiers: Array<{ emailAddress: string } | { phoneNumber: string }> = [];
  if (email) identifiers.push({ emailAddress: sha256(email.trim().toLowerCase()) });
  if (phone) identifiers.push({ phoneNumber: sha256(phone) });
  return identifiers.length ? identifiers : undefined;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function describeError(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
