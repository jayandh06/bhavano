"""Creates the "listing_posted_reminder" WhatsApp Business template via Meta's Graph API.

v2: v1 was reviewed and classified MARKETING instead of the declared UTILITY — the body argued
the benefit of Featured ("ranks above regular listings and gets more views") and the button was
an explicit purchase CTA ("Feature my ad"), both of which read as promotional regardless of what
category this script declares. v2 is a plain status statement (ad is live, not currently
Featured) with a neutral button ("View my ad") and no benefit/comparison language — the Featured
push for not-yet-boosted owners still lives in the email variant, which isn't subject to Meta's
classifier. See apps/bff/notification-templates/whatsapp/listing-posted-reminder/ for the wording.

A few-days-after-posting nudge for the not-boosted half of docs/plans/ (the owner win-back plan's
Part A). See whatsapp_create_listing_posted_reminder_featured_template.py for the already-boosted
sibling — two separate templates because an approved template's text is fixed and can't branch on
boost status at send time.

PREVIEWS BY DEFAULT. Run with no arguments and it prints the exact template Meta would receive —
does not submit anything. Only --submit actually calls the API.

Named body params ({{name}}, {{title}}), per WhatsappProvider.sendTemplate's own guidance. The
button is a static URL (always /my-listings — this reminder doesn't deep-link to the listing
itself, unlike listing_posted_v2), so no dynamic {{1}}/example is needed on the button.

Reads apps/bff/.env or ./.env, same as the other whatsapp_*.py scripts. The template's actual
wording is read from apps/bff/notification-templates/whatsapp/listing-posted-reminder/ — edit the
words there, not in this file.

Run: python whatsapp_create_listing_posted_reminder_template.py                  (preview only)
     python whatsapp_create_listing_posted_reminder_template.py --submit         (actually submit)
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

TEMPLATE_NAME = "listing_posted_reminder_v2"

TEMPLATE_DIR = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "apps", "bff", "notification-templates", "whatsapp", "listing-posted-reminder",
)


def read_field(filename):
    with open(os.path.join(TEMPLATE_DIR, filename), "r", encoding="utf-8") as f:
        return f.read().strip()


HEADER_TEXT = read_field("header.txt")
BODY_TEXT = read_field("body.txt")
FOOTER_TEXT = read_field("footer.txt")
BUTTON_TEXT = read_field("buttonLabel.txt")
BUTTON_URL = read_field("buttonUrl.txt")

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
            # Static URL — always /my-listings, no per-send variable, so no {{1}}/example needed
            # the way listing_posted_v2's dynamic deep-link button requires.
            {"type": "BUTTONS", "buttons": [{"type": "URL", "text": BUTTON_TEXT, "url": BUTTON_URL}]},
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
    print("\nBUTTON  (static URL, no variable)")
    print("  [%s] -> %s" % (BUTTON_TEXT, BUTTON_URL))
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
    category = "MARKETING" if "--category" in sys.argv and "MARKETING" in sys.argv else "UTILITY"
    submitting = "--submit" in sys.argv

    show_preview(category)

    print(
        "\nNOTE: submitting as %s. v1 (listing_posted_reminder_v1) came back classified MARKETING "
        "- this v2 copy dropped the benefit/comparison language and the purchase-style button text "
        "that caused it, so it should read as a plain status update now. Meta's review can still "
        "reclassify regardless of what's declared here; this is a better-odds rewrite, not a "
        "guarantee." % category
    )
    print(
        "\nOnce Meta approves this, set WHATSAPP_LISTING_POSTED_REMINDER_TEMPLATE=%s in .env. "
        "NotificationsService.notifyListingPostedReminder is already built and waiting on that "
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
        "  WHATSAPP_LISTING_POSTED_REMINDER_TEMPLATE=%s" % TEMPLATE_NAME
    )


if __name__ == "__main__":
    main()
