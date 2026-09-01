"""Creates the "welcome_signup" WhatsApp Business template via Meta's Graph API.

This registers the template for review — Meta approves or rejects it asynchronously, usually
within a day for a UTILITY-category template. It does not send anything; see
whatsapp_test_send.py for that once this is approved.

The body carries exactly one variable ({{1}}), because that is what the app already sends:
NotificationsService.notifyWelcome calls

    this.whatsapp.sendTemplate(user.phone, welcomeTemplate, [user.name ?? 'there'])

— the name alone, not a "Hi <name>" greeting, since the approved template supplies its own
wording around it (see that method's own comment). Changing the variable count here means
changing that call to match, not just this script.

The header and footer are static text with no {{}} placeholders. WhatsappProvider.sendTemplate
never sends a header component — "Omit `components` entirely for a template with no
variables" is its own comment about the body, and it has no header-parameter code path at all —
so a header WITH a variable would have nothing to fill it and Meta would reject every send.

Reads apps/bff/.env or ./.env, same as whatsapp_test_send.py, so the token stays on your machine.
The template's actual wording is read from apps/bff/notification-templates/whatsapp/welcome/ —
edit the words there, not in this file.

Run: python whatsapp_create_welcome_template.py
     python whatsapp_create_welcome_template.py --category MARKETING   (see the note below first)
"""

import os
import sys
import json
import urllib.request
import urllib.error

from dotenv import load_dotenv

# Windows terminals default to a codepage that cannot print an em dash or the emoji this
# template's own copy uses, so printing it (or Meta's JSON response echoing it back) raises
# UnicodeEncodeError rather than a harmless mangled character. Reconfigured once, up front,
# rather than relying on the caller having set PYTHONIOENCODING=utf-8 themselves.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

for candidate in ("apps/bff/.env", ".env"):
    if os.path.exists(candidate):
        load_dotenv(candidate, override=False)

TOKEN = os.getenv("WHATSAPP_ACCESS_TOKEN")
WABA_ID = os.getenv("WHATSAPP_BUSINESS_ACCOUNT_ID")
VERSION = os.getenv("WHATSAPP_API_VERSION") or "v23.0"
LANGUAGE = os.getenv("WHATSAPP_TEMPLATE_LANGUAGE") or "en"

TEMPLATE_NAME = "welcome_signup"

# The actual words live in apps/bff/notification-templates/whatsapp/welcome/, not here — see
# that folder's README for what editing one of these files does and does not do (short version:
# nothing takes effect until this script re-submits it and Meta re-approves it). Read fresh on
# every run rather than hardcoded, so this script and that folder cannot say different things.
TEMPLATE_DIR = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "apps", "bff", "notification-templates", "whatsapp", "welcome",
)


def read_field(filename):
    with open(os.path.join(TEMPLATE_DIR, filename), "r", encoding="utf-8") as f:
        return f.read().strip()


# Meta rejects a header carrying an emoji, newline, or markdown formatting (*bold*, _italic_) —
# "Header format is incorrect" is the exact error a submission with one gets. That restriction is
# header-only: the body below keeps its emoji freely.
HEADER_TEXT = read_field("header.txt")
BODY_TEXT = read_field("body.txt")
FOOTER_TEXT = read_field("footer.txt")

# Meta's own limits — checked here so a typo gets caught before a rejected submission costs a
# review cycle, which is usually a day.
LIMITS = {"header": 60, "body": 1024, "footer": 60}


def check_lengths():
    lengths = {"header": len(HEADER_TEXT), "body": len(BODY_TEXT), "footer": len(FOOTER_TEXT)}
    print("--- Character counts ---")
    ok = True
    for part, limit in LIMITS.items():
        n = lengths[part]
        status = "OK" if n <= limit else "TOO LONG"
        if n > limit:
            ok = False
        print("  %-7s %4d / %4d  %s" % (part, n, limit, status))
    return ok


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
    if not TOKEN or not WABA_ID:
        print("Missing WHATSAPP_ACCESS_TOKEN or WHATSAPP_BUSINESS_ACCOUNT_ID in .env — nothing to do.")
        sys.exit(1)

    category = "MARKETING" if "--category" in sys.argv and "MARKETING" in sys.argv else "UTILITY"

    if not check_lengths():
        print("\nOver a limit above — Meta will reject this. Trim the text and rerun.")
        sys.exit(1)

    print(
        "\nNOTE: submitting as %s. This message reads more promotional than most approved "
        "UTILITY templates (it sells four product features and ends on a call to action, not "
        "just a receipt of the signup) — Meta's automated review may still reclassify or reject "
        "it as MARKETING regardless of what is declared here. MARKETING templates need explicit "
        "opt-in tracking and cost more per conversation. If it comes back reclassified, that is "
        "Meta's decision to correct, not a bug in this script." % category
    )

    payload = {
        "name": TEMPLATE_NAME,
        "language": LANGUAGE,
        "category": category,
        "components": [
            {"type": "HEADER", "format": "TEXT", "text": HEADER_TEXT},
            {"type": "BODY", "text": BODY_TEXT, "example": {"body_text": [["Ravi"]]}},
            {"type": "FOOTER", "text": FOOTER_TEXT},
        ],
    }

    print("\n--- Submitting %r (%s, %s) ---" % (TEMPLATE_NAME, LANGUAGE, category))
    data, err = post(
        "https://graph.facebook.com/%s/%s/message_templates" % (VERSION, WABA_ID), payload
    )
    if err:
        print("FAILED: %s" % err.strip()[:800])
        sys.exit(1)

    print("Submitted: %s" % json.dumps(data))
    print(
        "\nStatus will show PENDING until Meta reviews it (usually within a day). Check with:\n"
        "  python whatsapp_test_send.py\n"
        "which lists every template and its status/category.\n\n"
        "Once APPROVED, set in .env:\n"
        "  WHATSAPP_WELCOME_TEMPLATE=%s" % TEMPLATE_NAME
    )


if __name__ == "__main__":
    main()
