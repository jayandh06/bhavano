"""Thin Google Tag Manager API v2 client, shared by the gtm_*.py scripts.

Uses the OAuth client already set up for the Google Ads API (GOOGLE_ADS_CLIENT_ID/SECRET)
plus a Tag Manager-scoped refresh token in GTM_REFRESH_TOKEN — see get_gtm_refresh_token.py.

Raw REST via `requests` rather than google-api-python-client, which isn't installed and isn't
worth adding for a handful of endpoints.
"""

import os
import sys
import time

import requests
from dotenv import load_dotenv
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials

load_dotenv()

BASE = "https://tagmanager.googleapis.com/tagmanager/v2"

# The container this repo's web app loads (apps/web/src/app/layout.tsx, NEXT_PUBLIC_GTM_ID).
CONTAINER_PUBLIC_ID = "GTM-N46D868W"

# 429 backoff: 30s, 60s, 120s, 240s. The quota that bites is per-minute, so the first wait
# alone clears it in the common case.
MAX_RETRIES = 4
RETRY_BASE_SECONDS = 30


def _token() -> str:
    client_id = os.getenv("GOOGLE_ADS_CLIENT_ID")
    client_secret = os.getenv("GOOGLE_ADS_CLIENT_SECRET")
    refresh_token = os.getenv("GTM_REFRESH_TOKEN")
    missing = [
        name
        for name, value in [
            ("GOOGLE_ADS_CLIENT_ID", client_id),
            ("GOOGLE_ADS_CLIENT_SECRET", client_secret),
            ("GTM_REFRESH_TOKEN", refresh_token),
        ]
        if not value
    ]
    if missing:
        raise SystemExit(
            "Missing from .env: %s\nRun `python get_gtm_refresh_token.py` first." % ", ".join(missing)
        )

    creds = Credentials(
        None,
        refresh_token=refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=client_id,
        client_secret=client_secret,
    )
    creds.refresh(Request())
    return creds.token


_session = None


def session() -> requests.Session:
    """An authenticated session. The access token is minted once per process run."""
    global _session
    if _session is None:
        s = requests.Session()
        s.headers["Authorization"] = "Bearer " + _token()
        _session = s
    return _session


def call(method: str, path: str, _attempt: int = 0, **kwargs):
    """One API call. `path` is relative to BASE (or absolute for a full resource path).

    Surfaces Google's own error body on failure — its `message` field is far more useful
    than a bare HTTP status (e.g. it names a disabled API or a missing permission).

    Retries on 429. The Tag Manager API's per-minute write quota is low enough that a
    straight run of ~30 creates trips it partway through, so back off and continue rather
    than leaving the workspace half-built.
    """
    url = path if path.startswith("http") else BASE + path
    resp = session().request(method, url, **kwargs)
    if resp.status_code == 429 and _attempt < MAX_RETRIES:
        wait = RETRY_BASE_SECONDS * (2 ** _attempt)
        print("    (429 quota — waiting %ds, retry %d/%d)" % (wait, _attempt + 1, MAX_RETRIES))
        time.sleep(wait)
        return call(method, path, _attempt=_attempt + 1, **kwargs)
    if not resp.ok:
        try:
            err = resp.json().get("error", {})
            detail = err.get("message", resp.text)
            status = err.get("status", "")
        except ValueError:
            detail, status = resp.text, ""
        hint = ""
        # Google reports a disabled API as a 403 whose `status` is PERMISSION_DENIED — the
        # SERVICE_DISABLED reason sits in `details`, not in the message — so match the prose too,
        # otherwise this misreports as a container-permissions problem.
        disabled = "SERVICE_DISABLED" in (status + detail + resp.text) or (
            "has not been used in project" in detail or "it is disabled" in detail
        )
        if resp.status_code == 403 and disabled:
            hint = (
                "\n\nHint: enable the Tag Manager API for this OAuth client's Cloud project:\n"
                "  https://console.cloud.google.com/apis/library/tagmanager.googleapis.com"
            )
        elif "insufficient authentication scopes" in detail.lower():
            hint = (
                "\n\nHint: GTM_REFRESH_TOKEN was minted before this API's scope was added.\n"
                "  Re-run `python get_gtm_refresh_token.py` and replace GTM_REFRESH_TOKEN in .env."
            )
        elif resp.status_code in (401, 403):
            hint = (
                "\n\nHint: the signed-in Google account needs Publish rights on %s\n"
                "  (tagmanager.google.com -> Admin -> User Management)." % CONTAINER_PUBLIC_ID
            )
        raise SystemExit("%s %s -> %s %s%s" % (method, url, resp.status_code, detail, hint))
    return resp.json() if resp.content else {}


def get(path, **kw):
    return call("GET", path, **kw)


def post(path, **kw):
    return call("POST", path, **kw)


def find_container():
    """Locates CONTAINER_PUBLIC_ID across every GTM account this token can see.

    Returns the container resource. Its `path` field is the prefix every later call needs.
    """
    accounts = get("/accounts").get("account", [])
    if not accounts:
        raise SystemExit("This Google account has no GTM accounts. Wrong login?")
    for acct in accounts:
        containers = get("/%s/containers" % acct["path"].lstrip("/")).get("container", [])
        for c in containers:
            if c.get("publicId") == CONTAINER_PUBLIC_ID:
                return c
    seen = ", ".join(
        c.get("publicId", "?")
        for a in accounts
        for c in get("/%s/containers" % a["path"].lstrip("/")).get("container", [])
    )
    raise SystemExit(
        "Container %s not found. Visible to this login: %s" % (CONTAINER_PUBLIC_ID, seen or "(none)")
    )


def default_workspace(container):
    """The workspace edits go into — prefers the standard 'Default Workspace'."""
    workspaces = get("/%s/workspaces" % container["path"].lstrip("/")).get("workspace", [])
    if not workspaces:
        raise SystemExit("Container %s has no workspaces." % CONTAINER_PUBLIC_ID)
    for w in workspaces:
        if w.get("name") == "Default Workspace":
            return w
    return workspaces[0]


if __name__ == "__main__":
    # Smoke test: prove auth works and the container is reachable.
    c = find_container()
    w = default_workspace(c)
    print("OK  account=%s  container=%s (%s)" % (c.get("accountId"), c.get("name"), c.get("publicId")))
    print("    workspace=%s" % w.get("name"))
    sys.exit(0)
