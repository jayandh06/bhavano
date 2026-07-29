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
    "login_customer_id": os.getenv("GOOGLE_ADS_LOGIN_CUSTOMER_ID", "").replace("-", ""),
    "use_proto_plus": True,
}

client = GoogleAdsClient.load_from_dict(config)
ga_service = client.get_service("GoogleAdsService")

customer_id = os.getenv("GOOGLE_ADS_CUSTOMER_ID", "").replace("-", "")
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
