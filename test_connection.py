"""Tests the Google Ads API connection.

Reads creds from .env (repo root), pulls one page of campaigns from the real Bhavano
Ads account to confirm everything works. See .claude/SETUP.md, Step 8.

Run: python test_connection.py
"""

import os
from dotenv import load_dotenv
from google.ads.googleads.client import GoogleAdsClient

load_dotenv()

config = {
    "developer_token": os.getenv("GOOGLE_ADS_DEVELOPER_TOKEN"),
    "client_id": os.getenv("GOOGLE_ADS_CLIENT_ID"),
    "client_secret": os.getenv("GOOGLE_ADS_CLIENT_SECRET"),
    "refresh_token": os.getenv("GOOGLE_ADS_REFRESH_TOKEN"),
    "use_proto_plus": True,
}

customer_id = os.getenv("GOOGLE_ADS_CUSTOMER_ID", "").replace("-", "")
login_customer_id = os.getenv("GOOGLE_ADS_LOGIN_CUSTOMER_ID", "").replace("-", "")

# GOOGLE_ADS_LOGIN_CUSTOMER_ID names a manager (MCC) account. Sending that header when the
# authenticated login has no access to that MCC is itself a USER_PERMISSION_DENIED — which
# reads like a broken token/connection but isn't (see ads_setup_conversions.py's make_client
# for the same guard). Drop it when the login reaches the target customer directly instead.
if login_customer_id and login_customer_id != customer_id:
    probe = GoogleAdsClient.load_from_dict(config)
    reachable = {
        rn.split("/")[-1]
        for rn in probe.get_service("CustomerService").list_accessible_customers().resource_names
    }
    if login_customer_id in reachable:
        config["login_customer_id"] = login_customer_id
    else:
        print(
            "note: GOOGLE_ADS_LOGIN_CUSTOMER_ID=%s is not accessible to this login "
            "(reachable: %s) — omitting the login-customer-id header."
            % (login_customer_id, ", ".join(sorted(reachable)) or "none")
        )

client = GoogleAdsClient.load_from_dict(config)
ga_service = client.get_service("GoogleAdsService")
query = """
    SELECT campaign.id, campaign.name, campaign.status
    FROM campaign
    LIMIT 5
"""

response = ga_service.search(customer_id=customer_id, query=query)
print("\n[OK] Connection works. First 5 campaigns:\n")
count = 0
for row in response:
    count += 1
    print(f"  · {row.campaign.name} ({row.campaign.status.name})")
if count == 0:
    print("  (no campaigns yet - connection works, account is just empty)")
