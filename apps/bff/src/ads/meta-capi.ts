import { createHash } from 'crypto';
import { Logger } from '@nestjs/common';
import { toE164India } from '../outreach/phone';

/**
 * Reports a conversion to Meta (Facebook / Instagram) through the Conversions API, so Ads Manager can show sign-ups, posted ads and purchases from Meta ads and
 * optimise for them. Server to server, like the Google Ads upload (google-ads-conversion.provider.ts), and likewise fire-and-forget: it never throws and never
 * slows the flow it reports on. See docs/plans/meta-facebook-instagram-ads-test.md.
 *
 * Does nothing until META_PIXEL_ID (the dataset id) and META_CAPI_ACCESS_TOKEN are set. META_CAPI_TEST_EVENT_CODE, when set, sends to Events Manager's Test events tab
 * instead of counting. Only people who arrived from Meta are ever reported (isMetaTraffic): nobody else's details leave for Meta.
 */

const GRAPH_VERSION = 'v21.0';
const logger = new Logger('MetaConversions');

export type MetaEventName = 'CompleteRegistration' | 'PostAdSuccess' | 'Purchase';

export interface MetaConversionInput {
  eventName: MetaEventName;
  /** Stable per business event (`signup-<userId>`, `listing-<id>`, the payment id), so a retry never counts twice. */
  eventId: string;
  eventTime: Date;
  email?: string | null;
  phone?: string | null;
  userId?: string | null;
  /** The click id from a Meta ad link. Used to build `fbc` when the browser cookie was not kept. */
  fbclid?: string | null;
  /** The Pixel's `_fbp` browser id, when the Pixel had run. */
  fbp?: string | null;
  value?: number;
  currency?: string;
}

/** Whether this person came from Meta: a Meta click id, a paid-social medium, or a facebook / instagram source. */
export function isMetaTraffic(a: { source?: string | null; medium?: string | null; fbclid?: string | null }): boolean {
  if (a.fbclid) return true;
  if ((a.medium ?? '').toLowerCase() === 'paid_social') return true;
  const source = (a.source ?? '').toLowerCase();
  return /facebook|instagram/.test(source) || source === 'fb' || source === 'ig' || source === 'meta';
}

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

/** The request body's event, pure so it can be tested without the network. Hashed fields follow Meta's normalisation: lowercase trimmed email, phone as digits with country code. */
export function buildMetaEvent(input: MetaConversionInput): Record<string, unknown> {
  const userData: Record<string, unknown> = {};
  if (input.email?.trim()) userData.em = [sha256(input.email.trim().toLowerCase())];
  const e164 = toE164India(input.phone);
  if (e164) userData.ph = [sha256(e164.replace(/\D/g, ''))];
  if (input.userId) userData.external_id = [sha256(input.userId)];
  if (input.fbp) userData.fbp = input.fbp;
  if (input.fbclid) userData.fbc = `fb.1.${input.eventTime.getTime()}.${input.fbclid}`;

  return {
    event_name: input.eventName,
    event_time: Math.floor(input.eventTime.getTime() / 1000),
    event_id: input.eventId,
    action_source: 'website',
    user_data: userData,
    ...(input.value !== undefined && input.currency ? { custom_data: { value: input.value, currency: input.currency } } : {}),
  };
}

/** Never throws. Returns whether a request was made (false when not configured or nothing Meta could match the event to). */
export async function sendMetaConversion(input: MetaConversionInput): Promise<boolean> {
  const pixelId = process.env.META_PIXEL_ID;
  const token = process.env.META_CAPI_ACCESS_TOKEN;
  if (!pixelId || !token) return false;

  const event = buildMetaEvent(input);
  const userData = event.user_data as Record<string, unknown>;
  // Nothing to match on: an event Meta cannot attribute to anyone is noise.
  if (Object.keys(userData).length === 0) return false;

  const testCode = process.env.META_CAPI_TEST_EVENT_CODE;
  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(pixelId)}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: [event], access_token: token, ...(testCode ? { test_event_code: testCode } : {}) }),
    });
    if (!res.ok) {
      // Never log the request: it carries hashed identifiers and the access token. The response says why (bad token, wrong dataset id).
      logger.warn(`Meta conversion ${input.eventName} rejected: ${res.status} ${(await res.text()).slice(0, 300)}`);
    }
    return true;
  } catch (e) {
    logger.warn(`Meta conversion ${input.eventName} failed: ${e instanceof Error ? e.message : String(e)}`);
    return false;
  }
}
