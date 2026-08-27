"""Sends one real OTP SMS through MSG91, mirroring exactly what the bff does in production.

Defaults to the **Flow** API, because that is what works: the Bhavano_Login template is a
Flow/Transactional template, and MSG91's OTP endpoint (/api/v5/otp) rejects it as "Template ID
Missing or Invalid Template" regardless of ids or sender. Use --otp-api only to re-test that.

Two traps this exists to catch, both learned the hard way:
  - MSG91 answers 200 with type:success for sends it then discards (IP not whitelisted, invalid
    template). The API response is not the outcome — MSG91 -> Reports -> SMS logs is.
  - MSG91_DLT_TEMPLATE_ID wants MSG91's own template id (24 hex chars), not the 19-digit DLT
    registry id, despite the variable's name.

Reads MSG91_AUTH_KEY / MSG91_DLT_TEMPLATE_ID / MSG91_SENDER_ID from .env (repo root), falling
back to apps/bff/.env.

Run: python msg91_test_otp.py 9876543210
     python msg91_test_otp.py 9876543210 --otp-api
"""

import argparse
import os
import random
import sys

import requests
from dotenv import load_dotenv

load_dotenv(".env")
load_dotenv("apps/bff/.env")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("phone", help="10-digit Indian mobile number, no country code")
    ap.add_argument(
        "--template-id",
        default=None,
        help="override MSG91_DLT_TEMPLATE_ID for one run — use it to try the DLT registry id "
        "(19 digits) against the MSG91 id (24 hex chars) without editing .env",
    )
    ap.add_argument(
        "--otp-api",
        action="store_true",
        help="send via the OTP API (/api/v5/otp) instead of the Flow API. Only useful against "
        "an OTP-type template — the Bhavano_Login template is a Flow/Transactional one, which "
        "that endpoint rejects as 'Invalid Template'",
    )
    ap.add_argument(
        "--var-name",
        default=None,
        help="also send the code under this extra param name, for a template whose placeholder "
        "is not ##otp## (e.g. --var-name var1)",
    )
    args = ap.parse_args()

    auth_key = os.getenv("MSG91_AUTH_KEY")
    if not auth_key:
        return err("MSG91_AUTH_KEY is not set in .env or apps/bff/.env.\n"
                   "It is currently only set on the prod host — copy it locally to test.")
    template_id = args.template_id or os.getenv("MSG91_DLT_TEMPLATE_ID")
    if not template_id:
        return err("MSG91_DLT_TEMPLATE_ID is not set. Put the approved template id in .env first.")
    sender_id = os.getenv("MSG91_SENDER_ID")

    code = str(random.randint(100000, 999999))
    params = {
        "mobile": "91%s" % args.phone,
        "otp": code,
        "template_id": template_id,
    }
    if args.var_name:
        params[args.var_name] = code
    if sender_id:
        params["sender"] = sender_id

    print("Sending code %s to %s" % (code, args.phone))
    print("  template_id = %s" % template_id)
    print("  sender      = %s" % (sender_id or "(not set — MSG91 will use the account default)"))
    extra = ", %s=%s" % (args.var_name, code) if args.var_name else ""
    print("  variables   = otp=%s%s" % (code, extra))

    if not args.otp_api:
        # The Flow API takes template variables as named keys on the recipient, so the key has to
        # match the template's placeholder (##otp## -> "otp"). Worth trying when the OTP API says
        # "Invalid Template": that error also means "this template is not an OTP-type template",
        # and a Flow/Transactional template can only be sent through this endpoint.
        recipient = {"mobiles": "91%s" % args.phone, args.var_name or "otp": code}
        print("  endpoint    = /api/v5/flow/  (recipient key: %s)" % (args.var_name or "otp"))
        resp = requests.post(
            "https://control.msg91.com/api/v5/flow/",
            json={
                "template_id": template_id,
                "short_url": "0",
                **({"sender": sender_id} if sender_id else {}),
                "recipients": [recipient],
            },
            headers={"authkey": auth_key, "Content-Type": "application/json"},
            timeout=30,
        )
    else:
        print("  endpoint    = /api/v5/otp")
        resp = requests.post(
            "https://control.msg91.com/api/v5/otp",
            params=params,
            headers={"authkey": auth_key, "Content-Type": "application/json"},
            timeout=30,
        )
    print("\nHTTP %s\n%s" % (resp.status_code, resp.text))
    print("\nNOTE: MSG91 answers 200 / type:success even for sends it then discards — an IP")
    print("      that is not whitelisted, or an invalid template, both look like this here.")
    print("      Always confirm the outcome in MSG91 -> Reports -> SMS logs.")

    # MSG91 answers 200 with {"type": "error"} for template/sender problems, so the status code
    # alone is not the success signal.
    if resp.status_code != 200 or '"error"' in resp.text:
        print("\n=> Send REJECTED. Common causes: template id belongs to a different account,")
        print("   sender header not registered against this template, or DLT not approved yet.")
        return 1

    print("\n=> Accepted by MSG91. Now read the SMS:")
    print("   digits present  -> the template placeholder matches; deploy as-is.")
    print("   still blank     -> the placeholder is named something else; re-run with")
    print("                      --var-name <name>, then set MSG91_OTP_VAR_NAME to match.")
    return 0


def err(message: str) -> int:
    print(message, file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
