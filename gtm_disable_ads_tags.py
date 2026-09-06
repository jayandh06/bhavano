"""Pauses the two client-side Ads conversion tags that server-side upload replaces.

Part A of docs/plans/server-side-google-ads-conversion-upload.md. The bff now uploads
`New registration` / `Post ad success` conversions directly to Google Ads
(ConversionUploadService) using the gclid captured at signup — running the GTM client-side
`awct` tags for the same two conversion actions at the same time would double-count, since
Google's own dedupe only catches an exact (gclid, conversion_date_time) match and a browser hit
vs. a server upload never share a timestamp. Every other tag (boost_purchase,
subscription_purchase, save_search, contact_owner, all GA4 tags) is untouched — this only pauses
the Ads `awct` tags for signup_complete/post_ad_success.

Pausing (not deleting) — reversible from the GTM UI or by re-running with --unpause, no redeploy
needed either way once published.

Run: python gtm_disable_ads_tags.py --dry-run
     python gtm_disable_ads_tags.py
     python gtm_disable_ads_tags.py --unpause   # revert
Then: python gtm_publish.py --name "Pause client-side Ads tags (server-side upload replaces them)"
"""

import argparse

import gtm_api

TAG_NAMES = ["Ads - signup_complete", "Ads - post_ad_success"]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--unpause", action="store_true", help="Revert: set paused=false instead")
    args = ap.parse_args()
    target_paused = not args.unpause

    container = gtm_api.find_container()
    ws = gtm_api.default_workspace(container)["path"].lstrip("/")
    tags = gtm_api.get("/%s/tags" % ws).get("tag", [])

    for name in TAG_NAMES:
        tag = next((t for t in tags if t.get("name") == name), None)
        if not tag:
            print("  SKIP   %-30s not found in workspace" % name)
            continue
        if tag.get("paused", False) == target_paused:
            print("  ok     %-30s already paused=%s" % (name, target_paused))
            continue

        path = tag["path"].lstrip("/")
        label = "pause" if target_paused else "unpause"
        if args.dry_run:
            print("  WOULD  %s %s" % (label, name))
            continue
        tag["paused"] = target_paused
        gtm_api.call("PUT", "/%s" % path, json=tag)
        print("  done   %s %s" % (label, name))

    if not args.dry_run:
        print("\nNot live yet — run gtm_publish.py to promote this workspace, or gtm_audit.py "
              "to confirm the change is staged first.")


if __name__ == "__main__":
    main()
