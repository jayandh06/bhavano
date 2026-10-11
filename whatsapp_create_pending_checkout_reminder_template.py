"""Creates the "pending_checkout_reminder" WhatsApp Business template via Meta's Graph API.

v2: v1 was reviewed and classified MARKETING instead of the declared UTILITY — despite having no
benefit/comparison language, the body's call-to-action ("finish paying and publish it") and the
button ("Complete payment") both explicitly framed the message around completing a payment, which
reads as commercial intent to Meta's classifier regardless of the fact that it's reminding about a
payment the owner themselves already started. Same lesson as listing_posted_reminder_v1's own
reclassification (that one for benefit/comparison language instead). v2 is a plain status
statement (ad is saved, not live) with a neutral button ("View my ad") and no payment-completion
language in either — the email variant keeps the direct "Complete payment" wording, since email
isn't subject to Meta's classifier. See apps/bff/notification-templates/whatsapp/
pending-checkout-reminder/ for the wording.

A same-day nudge for a listing stuck in `pending_checkout` — the owner picked a fee/boost option
but never completed payment, and nothing else ever tells them it's waiting (no expiry, no other
reminder). See docs/plans/pending-checkout-payment-reminder.md.

PREVIEWS BY DEFAULT. Run with no arguments and it prints the exact template Meta would receive —
does not submit anything. Only --submit actually calls the API.

Named body params ({{name}}, {{title}}), per WhatsappProvider.sendTemplate's own guidance. The
button is a DYNAMIC URL, unlike listing-posted-reminder's static one — it needs to land on this
specific listing's own checkout modal (`?openPublishCheckout=<id>`, read by
PublishCheckoutRecovery.tsx's AutoOpenPublishCheckout), not a bare /my-listings. Same
buttonUrlBase+buttonUrlExample convention as `whatsapp_create_listing_posted_template.py`.

Reads apps/bff/.env or ./.env, same as the other whatsapp_*.py scripts. The template's actual
wording is read from apps/bff/notification-templates/whatsapp/pending-checkout-reminder/ — edit
the words there, not in this file.

Run: python whatsapp_create_pending_checkout_reminder_template.py                  (preview only)
     python whatsapp_create_pending_checkout_reminder_template.py --submit         (actually submit)
"""

import os
import sys
import json
import urllib.request
import urllib.error

from dotenv import load_dotenv

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

for candidate in ("apps/bff/.env", ".env"):
    if os.path.exists(candidate):
        load_dotenv(candidate, override=False)

TOKEN = os.getenv("WHATSAPP_ACCESS_TOKEN")
WABA_ID = os.getenv("WHATSAPP_BUSINESS_ACCOUNT_ID")
VERSION = os.getenv("WHATSAPP_API_VERSION") or "v23.0"
LANGUAGE = os.getenv("WHATSAPP_TEMPLATE_LANGUAGE") or "en"

TEMPLATE_NAME = "pending_checkout_reminder_v2"

TEMPLATE_DIR = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "apps", "bff", "notification-templates", "whatsapp", "pending-checkout-reminder",
)


def read_field(filename):
    with open(os.path.join(TEMPLATE_DIR, filename), "r", encoding="utf-8") as f:
        return f.read().strip()


HEADER_TEXT = read_field("header.txt")
BODY_TEXT = read_field("body.txt")
FOOTER_TEXT = read_field("footer.txt")
BUTTON_TEXT = read_field("buttonLabel.txt")
BUTTON_URL_BASE = read_field("buttonUrlBase.txt")
BUTTON_URL_EXAMPLE = read_field("buttonUrlExample.txt")

LIMITS = {"header": 60, "body": 1024, "footer": 60, "button_text": 25}


def check_lengths():
    lengths = {
        "header": len(HEADER_TEXT),
        "body": len(BODY_TEXT),
        "footer": len(FOOTER_TEXT),
        "button_text": len(BUTTON_TEXT),
    }
    print("--- Character counts ---")
    ok = True
    for part, limit in LIMITS.items():
        n = lengths[part]
        status = "OK" if n <= limit else "TOO LONG"
        if n > limit:
            ok = False
        print("  %-12s %4d / %4d  %s" % (part, n, limit, status))
    return ok


def build_payload(category):
    return {
        "name": TEMPLATE_NAME,
        "language": LANGUAGE,
        "category": category,
        "parameter_format": "named",
        "components": [
            {"type": "HEADER", "format": "TEXT", "text": HEADER_TEXT},
            {
                "type": "BODY",
                "text": BODY_TEXT,
                "example": {"body_text_named_params": [
                    {"param_name": "name", "example": "Ravi"},
                    {"param_name": "title", "example": "2 BHK for rent in Koramangala"},
                ]},
            },
            {"type": "FOOTER", "text": FOOTER_TEXT},
            {
                "type": "BUTTONS",
                "buttons": [
                    {
                        "type": "URL",
                        "text": BUTTON_TEXT,
                        "url": BUTTON_URL_BASE + "{{1}}",
                        "example": [BUTTON_URL_BASE + BUTTON_URL_EXAMPLE],
                    },
                ],
            },
        ],
    }


def show_preview(category):
    print("=" * 60)
    print("PREVIEW — nothing has been submitted")
    print("=" * 60)
    print("\nHEADER  (static, no variables)")
    print("  " + HEADER_TEXT)
    print("\nBODY  (variables: {{name}}, {{title}})")
    for line in BODY_TEXT.split("\n"):
        print("  " + line)
    print("  ---- with example values ----")
    for line in BODY_TEXT.replace("{{name}}", "Ravi").replace(
        "{{title}}", "2 BHK for rent in Koramangala"
    ).split("\n"):
        print("  " + line)
    print("\nFOOTER  (static)")
    print("  " + FOOTER_TEXT)
    print("\nBUTTON  (URL, dynamic — one variable appended to a fixed prefix)")
    print("  [%s]" % BUTTON_TEXT)
    print("  -> %s{{1}}" % BUTTON_URL_BASE)
    print("  example resolves to: %s%s" % (BUTTON_URL_BASE, BUTTON_URL_EXAMPLE))
    print("\nCategory: %s" % category)
    print()
    check_lengths()


def post(url, payload):
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode(),
        headers={"Authorization": "Bearer %s" % TOKEN, "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req) as r:
            return json.load(r), None
    except urllib.error.HTTPError as e:
        return None, e.read().decode("utf-8", "replace")
    except Exception as e:  # noqa: BLE001 - surfacing any transport failure verbatim is the point
        return None, str(e)


def main():
    category = "UTILITY"
    submitting = "--submit" in sys.argv

    show_preview(category)

    print(
        "\nNOTE: submitting as %s. v1 (pending_checkout_reminder_v1) came back classified "
        "MARKETING - this v2 copy dropped the payment-completion language in the body's CTA and "
        "the button text that caused it, so it should read as a plain status update now. Meta's "
        "review can still reclassify regardless of what's declared here; this is a better-odds "
        "rewrite, not a guarantee." % category
    )
    print(
        "\nOnce Meta approves this, set WHATSAPP_PENDING_CHECKOUT_REMINDER_TEMPLATE=%s in .env. "
        "NotificationsService.notifyPendingCheckoutReminder is already built and waiting on that "
        "env var and Meta's approval - nothing else to change in code." % TEMPLATE_NAME
    )

    if not submitting:
        print("\nPreview only — rerun with --submit to actually create this on Meta.")
        return

    if not TOKEN or not WABA_ID:
        print("\nMissing WHATSAPP_ACCESS_TOKEN or WHATSAPP_BUSINESS_ACCOUNT_ID in .env — nothing to submit.")
        sys.exit(1)

    if not check_lengths():
        print("\nOver a limit above — Meta will reject this. Trim the text and rerun.")
        sys.exit(1)

    print("\n--- Submitting %r (%s, %s) ---" % (TEMPLATE_NAME, LANGUAGE, category))
    data, err = post(
        "https://graph.facebook.com/%s/%s/message_templates" % (VERSION, WABA_ID),
        build_payload(category),
    )
    if err:
        print("FAILED: %s" % err.strip()[:800])
        sys.exit(1)

    print("Submitted: %s" % json.dumps(data))
    print(
        "\nStatus will show PENDING until Meta reviews it. Once APPROVED, set in .env:\n"
        "  WHATSAPP_PENDING_CHECKOUT_REMINDER_TEMPLATE=%s" % TEMPLATE_NAME
    )


if __name__ == "__main__":
    main()
