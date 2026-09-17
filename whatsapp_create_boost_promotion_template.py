"""Creates the "boost_promotion" WhatsApp Business template via Meta's Graph API.

Offers Boost and Instant Alerts on an ad that is already live, with a button that opens the Boost
checkout for that specific listing. This is the WhatsApp half of the admin listings dashboard's
"Send boost promo" action (AdminService.sendBoostPromotion): email goes out unaided, but a
business-initiated WhatsApp message must be an approved template, so a phone-only owner gets
nothing until this one is approved.

MARKETING by default, unlike the listing_posted script's UTILITY. There is no pretending
otherwise: this message exists to sell something, and declaring it UTILITY would be both wrong and
the kind of thing that gets a number's quality rating cut.

PREVIEWS BY DEFAULT. Run with no arguments and it prints the exact template Meta would receive —
character counts, every component, the body variables and the button's dynamic URL — and submits
nothing. Only --submit calls the API.

Seven body variables ({{name}}, {{title}}, {{offerEnds}}, {{discountPercent}}, {{boostPrice}},
{{boostBasePrice}}, {{bundlePrice}}) plus one in the button (the listing id). Named for the body, per WhatsappProvider.sendTemplate's guidance for anything
past two variables; the button URL variable stays positional, since Meta's dynamic URL buttons
only ever take one.

Prices and the offer's terms are variables rather than baked into the wording on purpose — they
come from admin-editable settings (BoostPriceSettings / InstantAlertsPriceSettings) and from the
live DiscountCode row, and a template quoting a stale figure or a passed deadline could not be
corrected without a fresh Meta approval.

The wording assumes an offer is running, which means this template is only sendable while one is:
notifyBoostPromotion skips WhatsApp when no promo resolves, since an empty parameter is a 400 from
Meta rather than a gap in a sentence. Email covers the no-offer case with its own second folder
(notification-templates/email/boost-promotion/).

One button, not two. The screen it opens is the post-ad picker, where adding Instant Alerts is a
checkbox — so the second destination the email offers needs no second button here.

Once approved, set WHATSAPP_BOOST_PROMO_TEMPLATE=boost_promotion in .env — 
NotificationsService.notifyBoostPromotion already fills this template and is gated on that one
variable, exactly as notifyWelcome is on WHATSAPP_WELCOME_TEMPLATE.

Reads apps/bff/.env or ./.env, same as the other whatsapp_*.py scripts, so the token stays local.
The wording is read from apps/bff/notification-templates/whatsapp/boost-promotion/ — edit the
words there, not in this file.

Run: python whatsapp_create_boost_promotion_template.py            (preview only)
     python whatsapp_create_boost_promotion_template.py --submit   (actually submit)
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

TEMPLATE_NAME = "boost_promotion"

# The actual words live in apps/bff/notification-templates/whatsapp/listing-posted/, not here —
# see that folder's README for what editing one of these files does and does not do (short
# version: nothing takes effect until this script re-submits it and Meta re-approves it). Read
# fresh on every run rather than hardcoded, so this script and that folder cannot say different
# things.
TEMPLATE_DIR = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "apps", "bff", "notification-templates", "whatsapp", "boost-promotion",
)


def read_field(filename):
    with open(os.path.join(TEMPLATE_DIR, filename), "r", encoding="utf-8") as f:
        return f.read().strip()


# No emoji/newlines/asterisks — Meta rejects a header carrying any of those (see welcome_signup's
# own history). The body below is unrestricted.
HEADER_TEXT = read_field("header.txt")
BODY_TEXT = read_field("body.txt")
FOOTER_TEXT = read_field("footer.txt")

# The base a submitted listing's own path gets appended to, as the button's one positional
# variable. Meta requires the example to look like a real value it would resolve to.
BUTTON_URL_BASE = read_field("buttonUrlBase.txt")
BUTTON_TEXT = read_field("buttonLabel.txt")
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
        # Required whenever any component's example uses body_text_named_params rather than a
        # plain positional body_text array — omitting this is exactly what got the first
        # submission an instant INVALID_FORMAT rejection, since Meta silently assumed positional
        # and found a named-shaped example where it expected one.
        "parameter_format": "named",
        "components": [
            {"type": "HEADER", "format": "TEXT", "text": HEADER_TEXT},
            {
                "type": "BODY",
                "text": BODY_TEXT,
                "example": {"body_text_named_params": [
                    {"param_name": "name", "example": "Ravi"},
                    {"param_name": "title", "example": "2 BHK for rent in Koramangala"},
                    {"param_name": "offerEnds", "example": "30 September"},
                    {"param_name": "discountPercent", "example": "50"},
                    {"param_name": "boostPrice", "example": "100"},
                    {"param_name": "boostBasePrice", "example": "199"},
                    {"param_name": "bundlePrice", "example": "112"},
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
    print(
        "\nBODY  (variables: {{name}}, {{title}}, {{offerEnds}}, {{discountPercent}}, "
        "{{boostPrice}}, {{boostBasePrice}}, {{bundlePrice}})"
    )
    for line in BODY_TEXT.split("\n"):
        print("  " + line)
    print("  ---- with example values ----")
    for line in (
        BODY_TEXT.replace("{{name}}", "Ravi")
        .replace("{{title}}", "2 BHK for rent in Koramangala")
        .replace("{{offerEnds}}", "30 September")
        .replace("{{discountPercent}}", "50")
        .replace("{{boostPrice}}", "100")
        .replace("{{boostBasePrice}}", "199")
        .replace("{{bundlePrice}}", "112")
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
    # MARKETING, not UTILITY: this message exists to sell something. --category UTILITY is
    # accepted for completeness but is the wrong answer, and Meta would reclassify it anyway.
    category = "UTILITY" if "--category" in sys.argv and "UTILITY" in sys.argv else "MARKETING"
    submitting = "--submit" in sys.argv

    show_preview(category)

    print(
        "\nNOTE: submitting as %s. A recipient who has never messaged the business receives this "
        "under their marketing-message cap, and marketing templates count against the number's "
        "quality rating — which is the real reason AdminService.sendBoostPromotion keeps a "
        "per-listing cooldown rather than letting an admin send this twice in a week." % category
    )

    print(
        "\nOnce Meta approves this, sending it needs one more step: set "
        "WHATSAPP_BOOST_PROMO_TEMPLATE=%s in .env. NotificationsService.notifyBoostPromotion "
        "already fills this template and is gated on that variable — nothing else to change in "
        "code. Until then a phone-only owner is reported as skipped rather than sent." % TEMPLATE_NAME
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
        "\nStatus will show PENDING until Meta reviews it. Check with:\n"
        "  python whatsapp_test_send.py\n\n"
        "Once APPROVED, set in .env:\n"
        "  WHATSAPP_LISTING_POSTED_TEMPLATE=%s\n"
        "(no code currently reads that name — it's a new env var this template will need once "
        "the notifyListingPosted work in docs/plans/post-ad-acknowledgement.md is built)." % TEMPLATE_NAME
    )


if __name__ == "__main__":
    main()
