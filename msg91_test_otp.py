"""Sends one real OTP SMS through MSG91, to prove out the template variable before deploying.

The approved DLT template uses ##var1## rather than the ##OTP## placeholder MSG91's OTP API
substitutes into by default, so this sends the code under both names and reports what MSG91
says. Run it against your own phone and read the SMS: if the digits appear, the provider change
in apps/bff/src/notifications/providers/msg91.provider.ts is correct.

Reads MSG91_AUTH_KEY / MSG91_DLT_TEMPLATE_ID / MSG91_SENDER_ID from .env (repo root), falling
back to apps/bff/.env.

Run: python msg91_test_otp.py 9876543210
     python msg91_test_otp.py 9876543210 --var-name VAR1
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
    ap.add_argument("--var-name", default="var1", help="template variable name (default: var1)")
    args = ap.parse_args()

    auth_key = os.getenv("MSG91_AUTH_KEY")
    if not auth_key:
        return err("MSG91_AUTH_KEY is not set in .env or apps/bff/.env.\n"
                   "It is currently only set on the prod host — copy it locally to test.")
    template_id = os.getenv("MSG91_DLT_TEMPLATE_ID")
    if not template_id:
        return err("MSG91_DLT_TEMPLATE_ID is not set. Put the approved template id in .env first.")
    sender_id = os.getenv("MSG91_SENDER_ID")

    code = str(random.randint(100000, 999999))
    params = {
        "mobile": "91%s" % args.phone,
        "otp": code,
        args.var_name: code,
        "template_id": template_id,
    }
    if sender_id:
        params["sender"] = sender_id

    print("Sending code %s to %s" % (code, args.phone))
    print("  template_id = %s" % template_id)
    print("  sender      = %s" % (sender_id or "(not set — MSG91 will use the account default)"))
    print("  variables   = otp=%s, %s=%s" % (code, args.var_name, code))

    resp = requests.post(
        "https://control.msg91.com/api/v5/otp",
        params=params,
        headers={"authkey": auth_key, "Content-Type": "application/json"},
        timeout=30,
    )
    print("\nHTTP %s\n%s" % (resp.status_code, resp.text))

    # MSG91 answers 200 with {"type": "error"} for template/sender problems, so the status code
    # alone is not the success signal.
    if resp.status_code != 200 or '"error"' in resp.text:
        print("\n=> Send REJECTED. Common causes: template id belongs to a different account,")
        print("   sender header not registered against this template, or DLT not approved yet.")
        return 1

    print("\n=> Accepted by MSG91. Now read the SMS:")
    print("   digits present  -> the %s variable is correct; deploy the provider change." % args.var_name)
    print("   still blank     -> re-run with --var-name VAR1 (or whatever the template shows).")
    return 0


def err(message: str) -> int:
    print(message, file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
