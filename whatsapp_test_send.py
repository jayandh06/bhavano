"""Verifies the WhatsApp Cloud API config, then optionally sends a real test message.

Answers the two questions that cost the most time when wiring this up:

  1. Is WHATSAPP_PHONE_NUMBER_ID actually the *phone number* id, or the WhatsApp Business Account
     id sitting next to it on the same screen? Only the first works on /messages, and using the
     second fails with an error that never says so.
  2. Is the access token a permanent System User token, or the dashboard's temporary one that
     expires within about a day?

Reads apps/bff/.env or ./.env, so the token stays on your machine and in one place — the same
values the BFF itself will use. Nothing is written anywhere.

Run: python whatsapp_test_send.py                 (checks config only)
     python whatsapp_test_send.py 9876543210      (also sends hello_world to that number)
     python whatsapp_test_send.py 9876543210 my_template "Some Name"
"""

import os
import sys
import json
import urllib.request
import urllib.error

from dotenv import load_dotenv

for candidate in ("apps/bff/.env", ".env"):
    if os.path.exists(candidate):
        load_dotenv(candidate, override=False)

TOKEN = os.getenv("WHATSAPP_ACCESS_TOKEN")
PHONE_NUMBER_ID = os.getenv("WHATSAPP_PHONE_NUMBER_ID")
WABA_ID = os.getenv("WHATSAPP_BUSINESS_ACCOUNT_ID")
VERSION = os.getenv("WHATSAPP_API_VERSION") or "v23.0"
LANGUAGE = os.getenv("WHATSAPP_TEMPLATE_LANGUAGE") or "en"


def get(url):
    req = urllib.request.Request(url, headers={"Authorization": "Bearer %s" % TOKEN})
    try:
        with urllib.request.urlopen(req) as r:
            return json.load(r), None
    except urllib.error.HTTPError as e:
        return None, e.read().decode("utf-8", "replace")
    except Exception as e:  # noqa: BLE001 - surfacing any transport failure verbatim is the point
        return None, str(e)


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
    except Exception as e:  # noqa: BLE001
        return None, str(e)


def main():
    if not TOKEN:
        raise SystemExit("WHATSAPP_ACCESS_TOKEN is not set in apps/bff/.env or .env")
    if not PHONE_NUMBER_ID:
        raise SystemExit("WHATSAPP_PHONE_NUMBER_ID is not set in apps/bff/.env or .env")

    print("Graph API %s" % VERSION)
    print("WHATSAPP_PHONE_NUMBER_ID = %s" % PHONE_NUMBER_ID)

    # A phone number node answers with display_phone_number; a WABA node does not. That is the
    # cleanest way to tell the two ids apart without needing to know which is which up front.
    print("\n--- Is that id a phone number? ---")
    data, err = get(
        "https://graph.facebook.com/%s/%s?fields=display_phone_number,verified_name,quality_rating"
        % (VERSION, PHONE_NUMBER_ID)
    )
    if err:
        print("  NO — the lookup failed:")
        print("  %s" % err.strip()[:400])
        print("\n  If this says the object does not exist or is unsupported, the value is almost")
        print("  certainly the WhatsApp Business Account id rather than the phone number id.")
        print("  Find the right one at: Meta app dashboard -> WhatsApp -> API Setup, or run this")
        print("  with WHATSAPP_BUSINESS_ACCOUNT_ID set and it will list them for you.")
    elif data.get("display_phone_number"):
        print("  YES — this is the phone number id.")
        print("    number  : %s" % data.get("display_phone_number"))
        print("    name    : %s" % data.get("verified_name"))
        print("    quality : %s" % data.get("quality_rating"))
    else:
        print("  Unclear — the node resolved but has no display_phone_number: %s" % data)

    if WABA_ID:
        print("\n--- Phone numbers on WABA %s ---" % WABA_ID)
        data, err = get("https://graph.facebook.com/%s/%s/phone_numbers" % (VERSION, WABA_ID))
        if err:
            print("  lookup failed: %s" % err.strip()[:300])
        else:
            for n in data.get("data", []):
                match = "  <-- matches your WHATSAPP_PHONE_NUMBER_ID" if n.get("id") == PHONE_NUMBER_ID else ""
                print("  id=%-20s %s%s" % (n.get("id"), n.get("display_phone_number"), match))

        print("\n--- Approved templates ---")
        data, err = get(
            "https://graph.facebook.com/%s/%s/message_templates?fields=name,status,category,language&limit=25"
            % (VERSION, WABA_ID)
        )
        if err:
            print("  lookup failed: %s" % err.strip()[:300])
        else:
            rows = data.get("data", [])
            if not rows:
                print("  (none yet — business-initiated messages need an approved template)")
            for t in rows:
                print("  %-28s %-10s %-12s %s" % (t.get("name"), t.get("status"), t.get("category"), t.get("language")))
    else:
        print("\n(set WHATSAPP_BUSINESS_ACCOUNT_ID in .env to also list phone numbers and templates)")

    if len(sys.argv) < 2:
        print("\nConfig check only. Pass a phone number to send a real message.")
        return

    to = sys.argv[1].lstrip("+")
    if not to.startswith("91"):
        to = "91" + to
    template = sys.argv[2] if len(sys.argv) > 2 else "hello_world"
    params = sys.argv[3:]

    print("\n--- Sending %r to %s ---" % (template, to))
    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": to,
        "type": "template",
        "template": {"name": template, "language": {"code": LANGUAGE}},
    }
    # hello_world takes no variables; an empty components array is rejected rather than ignored.
    if params:
        payload["template"]["components"] = [
            {"type": "body", "parameters": [{"type": "text", "text": p} for p in params]}
        ]

    data, err = post("https://graph.facebook.com/%s/%s/messages" % (VERSION, PHONE_NUMBER_ID), payload)
    if err:
        print("  FAILED: %s" % err.strip()[:600])
        return
    print("  accepted: %s" % json.dumps(data))
    print("\n  'Accepted' means Meta queued it, not that it arrived — check the handset.")


if __name__ == "__main__":
    main()
