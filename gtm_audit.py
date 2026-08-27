"""Step 0 of docs/plans/consolidate-analytics-and-ads-on-gtm.md — audit container GTM-N46D868W.

Read-only. Answers the blocking question before anything is built: is a Google Ads tag for
AW-18351718445 already configured? If so, it was double-counting for as long as the direct
gtag.js tag was also live (commit f24584a .. 3af5197), and that Ads data needs discounting.

Run: python gtm_audit.py
"""

import gtm_api

ADS_ID = "AW-18351718445"


def param(entity, key):
    """Reads a tag/trigger parameter by key. GTM stores these as a list of typed dicts."""
    for p in entity.get("parameter", []):
        if p.get("key") == key:
            return p.get("value") or p.get("list") or p.get("map")
    return None


def main():
    container = gtm_api.find_container()
    workspace = gtm_api.default_workspace(container)
    ws_path = workspace["path"].lstrip("/")

    print("Container : %s (%s)" % (container.get("name"), container.get("publicId")))
    print("Account   : %s" % container.get("accountId"))
    print("Workspace : %s" % workspace.get("name"))

    tags = gtm_api.get("/%s/tags" % ws_path).get("tag", [])
    triggers = gtm_api.get("/%s/triggers" % ws_path).get("trigger", [])
    variables = gtm_api.get("/%s/variables" % ws_path).get("variable", [])

    print("\n=== TAGS (%d) ===" % len(tags))
    if not tags:
        print("  (none — container is empty, nothing was double-counting)")
    for t in tags:
        bits = [t.get("name", "?"), "type=%s" % t.get("type")]
        for key in ("conversionId", "awConversionId", "tagId", "measurementId"):
            val = param(t, key)
            if val:
                bits.append("%s=%s" % (key, val))
        label = param(t, "conversionLabel") or param(t, "awConversionLabel")
        if label:
            bits.append("label=%s" % label)
        print("  - " + "  ".join(bits))

    print("\n=== TRIGGERS (%d) ===" % len(triggers))
    for tr in triggers:
        print("  - %s  type=%s  event=%s" % (tr.get("name"), tr.get("type"), param(tr, "eventName") or "-"))
    if not triggers:
        print("  (none)")

    print("\n=== VARIABLES (%d) ===" % len(variables))
    for v in variables:
        print("  - %s  type=%s  dlv=%s" % (v.get("name"), v.get("type"), param(v, "name") or "-"))
    if not variables:
        print("  (none)")

    # --- the verdict this script exists for ---
    ads_tags = [t for t in tags if ADS_ID in str(t)]
    linker = [t for t in tags if t.get("type") == "gclidw"]
    ga4 = [t for t in tags if str(param(t, "tagId") or param(t, "measurementId") or "").startswith("G-")]

    print("\n=== VERDICT ===")
    if ads_tags:
        print("  [!] %d tag(s) reference %s — these were DOUBLE-COUNTING while the" % (len(ads_tags), ADS_ID))
        print("      direct gtag.js tag was also live (f24584a .. 3af5197):")
        for t in ads_tags:
            print("        - %s" % t.get("name"))
        print("      Discount Ads data for that window.")
    else:
        print("  [ok] No tag references %s — no double-counting occurred." % ADS_ID)
    print("  Conversion Linker present : %s" % ("yes" if linker else "NO — required, see step 4.1"))
    print("  GA4 config tag present    : %s" % ("yes" if ga4 else "NO — no analytics yet, see step 3"))


if __name__ == "__main__":
    main()
