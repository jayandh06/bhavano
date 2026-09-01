"""Creates the "listing_posted" WhatsApp Business template via Meta's Graph API.

Confirms a listing going live, with a button linking straight to it and a soft mention of
boosting to increase views. See docs/plans/post-ad-acknowledgement.md for the fuller plan this
belongs to (channel choice, why WhatsApp rather than SMS, what still needs wiring on the BFF side).

PREVIEWS BY DEFAULT. Run with no arguments and it prints the exact template Meta would receive —
character counts, every component, the two body variables and the button's dynamic URL — and does
not submit anything. Only --submit actually calls the API. Learned the hard way on welcome_signup:
Meta rejected that one for an emoji in the header, an error worth catching by reading the preview
rather than by spending a submission on it.

Two variables in the body ({{name}}, {{title}}) plus one in the button (the listing's own path) —
named parameters for the body, per WhatsappProvider.sendTemplate's own guidance: "worth preferring
[named] for anything with more than two variables... positional order is invisible from the
template text." The button URL variable stays positional — Meta's dynamic URL buttons only ever
take one, unnamed, appended to a fixed prefix.

Sendable once approved: WhatsappProvider.sendTemplate now takes an optional button-URL parameter
alongside the body ones (apps/bff/src/notifications/providers/whatsapp.provider.ts), and
NotificationsService.notifyListingPosted already calls it with the listing's own path. This was
not true when this script was first written — sending used to have no way to fill the button at
all, which is why an earlier version of this docstring said "not yet sendable".

Reads apps/bff/.env or ./.env, same as the other whatsapp_*.py scripts, so the token stays local.
The template's actual wording is read from
apps/bff/notification-templates/whatsapp/listing-posted/ — edit the words there, not in this file.

Run: python whatsapp_create_listing_posted_template.py                  (preview only)
     python whatsapp_create_listing_posted_template.py --submit         (actually submit)
     python whatsapp_create_listing_posted_template.py --submit --category MARKETING
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

# listing_posted (id 2347470529329840) was submitted once with a payload bug (missing
# parameter_format: "named"), got an instant INVALID_FORMAT rejection, and was deleted to be
# resubmitted under the same name — but Meta's delete was still propagating and kept refusing the
# resubmission ("Message template language is being deleted"). Renamed rather than waited out an
# uncertain propagation delay, exactly what that error message itself suggests.
TEMPLATE_NAME = "listing_posted_v2"

# The actual words live in apps/bff/notification-templates/whatsapp/listing-posted/, not here —
# see that folder's README for what editing one of these files does and does not do (short
# version: nothing takes effect until this script re-submits it and Meta re-approves it). Read
# fresh on every run rather than hardcoded, so this script and that folder cannot say different
# things.
TEMPLATE_DIR = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "apps", "bff", "notification-templates", "whatsapp", "listing-posted",
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
    category = "MARKETING" if "--category" in sys.argv and "MARKETING" in sys.argv else "UTILITY"
    submitting = "--submit" in sys.argv

    show_preview(category)

    print(
        "\nNOTE: submitting as %s. Confirming something the user just did (their ad going live) "
        "is squarely what UTILITY is for, but the boost upsell sentence in the body pulls it "
        "slightly toward promotional — Meta's review may reclassify it regardless of what's "
        "declared here. If it comes back as MARKETING, that's Meta's call to correct, not a bug "
        "in this script." % category
    )

    print(
        "\nOnce Meta approves this, sending it needs one more step: set "
        "WHATSAPP_LISTING_POSTED_TEMPLATE=%s in .env. NotificationsService.notifyListingPosted "
        "and WhatsappProvider's button-URL support are both already built and waiting on that "
        "env var and Meta's approval — nothing else to change in code." % TEMPLATE_NAME
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
