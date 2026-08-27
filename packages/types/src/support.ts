/** Shared contract for the Contact Us support form — see
 * docs/plans/contact-us-support-form.md.
 *
 * Everything the form, the BFF DTO, and the Prisma enum need to agree on lives here, so a
 * topic or a size cap can't drift between the client-side check and the server that enforces
 * it. */

export const CONTACT_TOPICS = [
  "posting",
  "subscription",
  "account",
  "listing_report",
  "website",
  "other",
] as const;

export type ContactTopic = (typeof CONTACT_TOPICS)[number];

export const CONTACT_TOPIC_LABELS: Record<ContactTopic, string> = {
  posting: "Trouble posting or editing an ad",
  subscription: "Subscription, boost, or payment",
  account: "Login, OTP, or profile",
  listing_report: "Report a listing",
  website: "Website bug or something looks wrong",
  other: "Something else",
};

/** Topics where a link to the listing in question is the single most useful thing support can
 * be given — the form reveals the field only for these. */
export const TOPICS_WITH_LISTING_URL: ReadonlySet<ContactTopic> = new Set<ContactTopic>([
  "posting",
  "listing_report",
]);

/** Likewise for the Razorpay payment id, which turns a payment complaint into a lookup. */
export const TOPICS_WITH_PAYMENT_ID: ReadonlySet<ContactTopic> = new Set<ContactTopic>(["subscription"]);

export const MESSAGE_MIN_LENGTH = 20;
export const MESSAGE_MAX_LENGTH = 4000;

export const MAX_ATTACHMENTS = 3;
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
export const MAX_ATTACHMENTS_TOTAL_BYTES = 10 * 1024 * 1024;

/** Images only, and every one is re-encoded server-side (see the plan's step 7.3): that strips
 * EXIF the sender didn't know was there and makes polyglot files structurally impossible. A
 * format that can't be neutralised that way — PDF especially — is deliberately not here. */
export const ACCEPTED_ATTACHMENT_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
] as const;

/** Bots fill every input they find; this one is hidden from people, so a non-empty value is a
 * reliable bot signal. Named to look worth filling in. */
export const HONEYPOT_FIELD = "website";

/** Guards against scripted posts without a CAPTCHA — a human cannot read the page, choose a
 * topic and write 20+ characters this fast. */
export const MIN_DWELL_MS = 3000;

export interface SupportAttachmentInput {
  filename: string;
  mimeType: string;
  bytes: number;
}

export interface CreateSupportTicketInput {
  topic: ContactTopic;
  name: string;
  email: string;
  phone?: string;
  listingUrl?: string;
  paymentId?: string;
  message: string;
}

export interface CreateSupportTicketResponse {
  ticketId: string;
}
