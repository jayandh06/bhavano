"""Identifies which GA4 measurement ID actually belongs to bhavano.com.

The GTM container has two in play — G-XZ2TDGSKMS (what the live tag sends to) and
G-T5G7MCWJRC (what the live version's description claims) — and step 3 of
docs/plans/consolidate-analytics-and-ads-on-gtm.md is blocked until it's clear which is
the real property. See that plan's findings log.

Read-only: lists GA4 account summaries, then each property's data streams, and matches
their default URIs against the site domain.

Reuses the authenticated session from gtm_api (same OAuth client, same refresh token) —
requires the analytics.readonly scope, so re-run get_gtm_refresh_token.py if this 403s.

Run: python ga4_audit.py
"""

import gtm_api

ADMIN = "https://analyticsadmin.googleapis.com/v1beta"
SITE_HINT = "bhavano"

# The two IDs seen in container GTM-N46D868W, for cross-referencing against what's real.
SEEN_IN_GTM = {
    "G-XZ2TDGSKMS": "live GA4 Event tag's measurementIdOverride + draft Google tag",
    "G-T5G7MCWJRC": "live container version's description text",
}


def main():
    summaries = gtm_api.get(ADMIN + "/accountSummaries").get("accountSummaries", [])
    if not summaries:
        raise SystemExit(
            "No GA4 accounts visible to this login.\n"
            "Either this Google account has no Analytics access, or the token predates the\n"
            "analytics.readonly scope — re-run `python get_gtm_refresh_token.py`."
        )

    found = {}
    for acct in summaries:
        print("Account: %s (%s)" % (acct.get("displayName"), acct.get("account")))
        for prop in acct.get("propertySummaries", []):
            prop_id = prop.get("property")  # "properties/123456789"
            print("  Property: %s  [%s]" % (prop.get("displayName"), prop_id))
            streams = gtm_api.get("%s/%s/dataStreams" % (ADMIN, prop_id)).get("dataStreams", [])
            if not streams:
                print("     (no data streams)")
            for st in streams:
                web = st.get("webStreamData", {}) or {}
                mid = web.get("measurementId", "-")
                uri = web.get("defaultUri", "-")
                marker = ""
                if SITE_HINT in (uri or "").lower():
                    marker = "   <== matches %s" % SITE_HINT
                print("     stream: %-16s %-34s %s%s" % (mid, uri, st.get("displayName", ""), marker))
                if mid and mid != "-":
                    found[mid] = {
                        "property": prop.get("displayName"),
                        "property_id": prop_id,
                        "uri": uri,
                        "matches_site": SITE_HINT in (uri or "").lower(),
                    }

    print("\n=== CROSS-REFERENCE WITH GTM ===")
    for mid, where in SEEN_IN_GTM.items():
        info = found.get(mid)
        if not info:
            print("  %s  NOT FOUND in this Analytics account" % mid)
            print("      (referenced by: %s)" % where)
            print("      -> either it belongs to an Analytics account this login can't see,")
            print("         or it is stale/mistyped and should not be used.")
        else:
            verdict = "MATCHES bhavano.com" if info["matches_site"] else "exists, but stream URI is " + str(info["uri"])
            print("  %s  %s" % (mid, verdict))
            print("      property: %s [%s]" % (info["property"], info["property_id"]))
            print("      (referenced by: %s)" % where)

    real = [m for m, i in found.items() if i["matches_site"]]
    print("\n=== VERDICT ===")
    if len(real) == 1:
        print("  Use %s — it is the only stream whose URI matches %s." % (real[0], SITE_HINT))
    elif len(real) > 1:
        print("  Multiple streams match %s: %s" % (SITE_HINT, ", ".join(real)))
        print("  Pick the one whose property is the intended reporting property.")
    else:
        print("  No stream URI mentions %s. Inspect the listing above manually." % SITE_HINT)


if __name__ == "__main__":
    main()
