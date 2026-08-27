"""Generates a Google Tag Manager refresh token.

Same shape as get_refresh_token.py (which does this for the Google Ads API) and reuses the
same OAuth client — only the scopes differ. Reads GOOGLE_ADS_CLIENT_ID/SECRET from .env
(repo root), opens a browser for you to grant access, then prints a refresh token to paste
back into .env as GTM_REFRESH_TOKEN.

Prerequisites, both one-time:
  1. Enable BOTH APIs in the same Google Cloud project as the OAuth client (project 268317873723):
     https://console.cloud.google.com/apis/library/tagmanager.googleapis.com?project=268317873723
     https://console.cloud.google.com/apis/library/analyticsadmin.googleapis.com?project=268317873723
     Without these the token mints fine but every API call returns 403 SERVICE_DISABLED.
     Note the ?project= — the generic library link opens whichever project you last used.
  2. Sign in as a Google account with **Publish** rights on container GTM-N46D868W
     (tagmanager.google.com -> Admin -> User Management).

Run: python get_gtm_refresh_token.py
"""

import os
from dotenv import load_dotenv
from google_auth_oauthlib.flow import InstalledAppFlow

load_dotenv()

# readonly covers the audit; edit.containers creates variables/triggers/tags in a workspace;
# edit.containerversions creates a version from that workspace; publish pushes a version live.
# Publishing stays a deliberate, separate step — nothing here publishes on its own.
SCOPES = [
    "https://www.googleapis.com/auth/tagmanager.readonly",
    "https://www.googleapis.com/auth/tagmanager.edit.containers",
    "https://www.googleapis.com/auth/tagmanager.edit.containerversions",
    "https://www.googleapis.com/auth/tagmanager.publish",
    # Read-only GA4 Admin, so ga4_audit.py can list properties/data streams and identify which
    # measurement ID actually belongs to bhavano.com. Read-only on purpose — nothing here edits
    # an Analytics property.
    "https://www.googleapis.com/auth/analytics.readonly",
]

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

print("\n\n=== YOUR GTM REFRESH TOKEN ===")
print(creds.refresh_token)
print("==============================\n")
print("Paste this into .env as GTM_REFRESH_TOKEN (a new key — do not overwrite")
print("GOOGLE_ADS_REFRESH_TOKEN, which is a different token for a different API).")
