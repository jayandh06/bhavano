"use strict";
/** Shared contract for the Contact Us support form — see
 * docs/plans/contact-us-support-form.md.
 *
 * Everything the form, the BFF DTO, and the Prisma enum need to agree on lives here, so a
 * topic or a size cap can't drift between the client-side check and the server that enforces
 * it. */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MIN_DWELL_MS = exports.HONEYPOT_FIELD = exports.ACCEPTED_ATTACHMENT_MIME_TYPES = exports.MAX_ATTACHMENTS_TOTAL_BYTES = exports.MAX_ATTACHMENT_BYTES = exports.MAX_ATTACHMENTS = exports.MESSAGE_MAX_LENGTH = exports.MESSAGE_MIN_LENGTH = exports.TOPICS_WITH_PAYMENT_ID = exports.TOPICS_WITH_LISTING_URL = exports.CONTACT_TOPIC_LABELS = exports.CONTACT_TOPICS = void 0;
exports.CONTACT_TOPICS = [
    "posting",
    "subscription",
    "account",
    "listing_report",
    "website",
    "other",
];
exports.CONTACT_TOPIC_LABELS = {
    posting: "Trouble posting or editing an ad",
    subscription: "Subscription, boost, or payment",
    account: "Login, OTP, or profile",
    listing_report: "Report a listing",
    website: "Website bug or something looks wrong",
    other: "Something else",
};
/** Topics where a link to the listing in question is the single most useful thing support can
 * be given — the form reveals the field only for these. */
exports.TOPICS_WITH_LISTING_URL = new Set([
    "posting",
    "listing_report",
]);
/** Likewise for the Razorpay payment id, which turns a payment complaint into a lookup. */
exports.TOPICS_WITH_PAYMENT_ID = new Set(["subscription"]);
exports.MESSAGE_MIN_LENGTH = 20;
exports.MESSAGE_MAX_LENGTH = 4000;
exports.MAX_ATTACHMENTS = 3;
exports.MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
exports.MAX_ATTACHMENTS_TOTAL_BYTES = 10 * 1024 * 1024;
/** Images only, and every one is re-encoded server-side (see the plan's step 7.3): that strips
 * EXIF the sender didn't know was there and makes polyglot files structurally impossible. A
 * format that can't be neutralised that way — PDF especially — is deliberately not here. */
exports.ACCEPTED_ATTACHMENT_MIME_TYPES = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/heic",
    "image/heif",
];
/** Bots fill every input they find; this one is hidden from people, so a non-empty value is a
 * reliable bot signal. Named to look worth filling in. */
exports.HONEYPOT_FIELD = "website";
/** Guards against scripted posts without a CAPTCHA — a human cannot read the page, choose a
 * topic and write 20+ characters this fast. */
exports.MIN_DWELL_MS = 3000;
