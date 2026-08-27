"""Lists what MSG91 actually holds for this account — templates, their ids, types, status.

Written after four failed sends that all reported "Template ID Missing or Invalid Template"
regardless of endpoint, sender, or which of the two ids was used. That pattern rules out the
request and points at the template record, so this asks MSG91 rather than guessing again.

Read-only: GETs only, sends no SMS, costs nothing. MSG91's template APIs have moved between
hosts and paths over the years, so several candidates are probed and the ones that answer are
reported.

Run: python msg91_list_templates.py
"""

import json
import os
import sys

import requests
from dotenv import load_dotenv

load_dotenv(".env")
load_dotenv("apps/bff/.env")

CANDIDATES = [
    ("GET", "https://control.msg91.com/api/v5/otp/template"),
    ("GET", "https://control.msg91.com/api/v5/otp/templates"),
    ("GET", "https://control.msg91.com/api/v5/flow/"),
    ("GET", "https://control.msg91.com/api/v5/flow"),
    ("GET", "https://control.msg91.com/api/v5/sms/template"),
    ("GET", "https://control.msg91.com/api/v5/dlt/template"),
    ("GET", "https://api.msg91.com/api/v5/flow/"),
    ("GET", "https://control.msg91.com/api/v5/campaign/api/templates"),
]


def main() -> int:
    auth_key = os.getenv("MSG91_AUTH_KEY")
    if not auth_key:
        print("MSG91_AUTH_KEY not set in .env", file=sys.stderr)
        return 1
    headers = {"authkey": auth_key, "Content-Type": "application/json"}

    print("Probing MSG91 template endpoints (read-only)\n")
    useful = 0
    for method, url in CANDIDATES:
        try:
            resp = requests.request(method, url, headers=headers, timeout=25)
        except requests.RequestException as exc:
            print("  %-58s connection error: %s" % (url, exc))
            continue
        body = resp.text.strip()
        marker = ""
        # A 200 carrying more than a bare error envelope is what we're hunting for.
        if resp.status_code == 200 and len(body) > 40 and '"type":"error"' not in body:
            marker = "   <== USEFUL"
            useful += 1
        print("  %-58s %s  %s%s" % (url, resp.status_code, body[:110].replace("\n", " "), marker))

        if marker:
            print("\n----- full body -----")
            try:
                print(json.dumps(resp.json(), indent=2)[:4000])
            except ValueError:
                print(body[:4000])
            print("---------------------\n")

    if not useful:
        print("\nNo endpoint returned a template list. The dashboard is then the only source of")
        print("truth for the template's section (OTP vs Flow) and its approval status.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
