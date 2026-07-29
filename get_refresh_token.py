"""Generates a Google Ads refresh token.

Reads GOOGLE_ADS_CLIENT_ID/GOOGLE_ADS_CLIENT_SECRET from .env (repo root), opens a
browser for you to grant access, then prints the refresh token to paste back into .env
as GOOGLE_ADS_REFRESH_TOKEN. See .claude/SETUP.md, Step 7.

Run: python get_refresh_token.py
"""

import os
from dotenv import load_dotenv
from google_auth_oauthlib.flow import InstalledAppFlow

load_dotenv()

SCOPES = ["https://www.googleapis.com/auth/adwords"]

client_id = os.getenv("GOOGLE_ADS_CLIENT_ID")
client_secret = os.getenv("GOOGLE_ADS_CLIENT_SECRET")

if not client_id or not client_secret:
    raise SystemExit("GOOGLE_ADS_CLIENT_ID / GOOGLE_ADS_CLIENT_SECRET not found in .env — fill those in first.")

client_config = {
    "installed": {
        "client_id": client_id,
        "client_secret": client_secret,
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "token_uri": "https://oauth2.googleapis.com/token",
        "redirect_uris": ["http://localhost"],
    }
}

flow = InstalledAppFlow.from_client_config(client_config, SCOPES)
creds = flow.run_local_server(port=0, prompt="consent", access_type="offline")

print("\n\n=== YOUR REFRESH TOKEN ===")
print(creds.refresh_token)
print("==========================\n")
print("Paste this into .env as GOOGLE_ADS_REFRESH_TOKEN")
