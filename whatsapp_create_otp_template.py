"""Creates the "login_otp" WhatsApp AUTHENTICATION template via Meta's Graph API.

Registers the template for review; Meta approves or rejects asynchronously (authentication
templates are usually approved within minutes to a day). It does not send anything.

An AUTHENTICATION template is not free-form like the welcome one. Meta fixes its wording:
  - there is NO header component (a HEADER is rejected for this category),
  - the BODY text cannot be customised. Meta renders "<code> is your verification code." and,
    with add_security_recommendation, "For your security, do not share this code.",
  - the FOOTER is only an expiry line, set by minutes, not by text: "This code expires in 10
    minutes.",
  - the BUTTON is a "Copy code" button (COPY_CODE) that copies the code to the clipboard.
The expiry must match the real lifetime, OTP_TTL_MS in apps/bff/src/auth/otp.service.ts (10 min).

COPY_CODE works on iOS and Android. ONE_TAP (Android one-tap autofill) additionally needs the
app's package name and signing-key hash; pass --one-tap with BHAVANO_ANDROID_PACKAGE and
BHAVANO_ANDROID_SIGNATURE_HASH set. iOS has no one-tap, so a COPY_CODE template is the
cross-platform baseline.

When sending, the code goes in two places: the body parameter and the button parameter:

    components: [
      { type: "body",   parameters: [{ type: "text", text: CODE }] },
      { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: CODE }] }
    ]

Reads apps/bff/.env or ./.env like whatsapp_create_welcome_template.py, so the token stays local.

Run: python whatsapp_create_otp_template.py
     python whatsapp_create_otp_template.py --one-tap
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

TEMPLATE_NAME = "login_otp"
# Keep in step with OTP_TTL_MS in apps/bff/src/auth/otp.service.ts (10 minutes).
CODE_EXPIRATION_MINUTES = 10


def build_button():
    if "--one-tap" in sys.argv:
        package = os.getenv("BHAVANO_ANDROID_PACKAGE")
        sig_hash = os.getenv("BHAVANO_ANDROID_SIGNATURE_HASH")
        if not package or not sig_hash:
            print("--one-tap needs BHAVANO_ANDROID_PACKAGE and BHAVANO_ANDROID_SIGNATURE_HASH in .env.")
            sys.exit(1)
        return {
            "type": "OTP",
            "otp_type": "ONE_TAP",
            "text": "Copy code",
            "autofill_text": "Autofill",
            "package_name": package,
            "signature_hash": sig_hash,
        }
    return {"type": "OTP", "otp_type": "COPY_CODE", "text": "Copy code"}


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

    payload = {
        "name": TEMPLATE_NAME,
        "language": LANGUAGE,
        "category": "AUTHENTICATION",
        "components": [
            {"type": "BODY", "add_security_recommendation": True},
            {"type": "FOOTER", "code_expiration_minutes": CODE_EXPIRATION_MINUTES},
            {"type": "BUTTONS", "buttons": [build_button()]},
        ],
    }

    print("--- Submitting %r (%s, AUTHENTICATION) ---" % (TEMPLATE_NAME, LANGUAGE))
    data, err = post(
        "https://graph.facebook.com/%s/%s/message_templates" % (VERSION, WABA_ID), payload
    )
    if err:
        print("FAILED: %s" % err.strip()[:800])
        sys.exit(1)

    print("Submitted: %s" % json.dumps(data))
    print(
        "\nStatus stays PENDING until Meta reviews it. Check with whatsapp_test_send.py, which\n"
        "lists every template and its status. Once APPROVED, the OTP send needs this template\n"
        "name (and, if sending through MSG91, the same template approved/synced there)."
    )


if __name__ == "__main__":
    main()
