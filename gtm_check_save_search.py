"""Read-only: is the 'Save a search' Google Ads conversion actually wired and live?

Checks three things the workspace-level audit (gtm_audit.py) doesn't:
  1. Is the "Ads - save_search" tag's firingTriggerId actually the "CE - save_search" trigger?
  2. Is the tag paused or live?
  3. Has the CURRENTLY PUBLISHED (live) container version — not just the draft workspace — ever
     included this tag? A correct draft that was never published serves nothing to real visitors.

Run: python gtm_check_save_search.py
"""

import gtm_api


def param(entity, key):
    for p in entity.get("parameter", []):
        if p.get("key") == key:
            return p.get("value") or p.get("list") or p.get("map")
    return None


def main():
    container = gtm_api.find_container()
    workspace = gtm_api.default_workspace(container)
    ws_path = workspace["path"].lstrip("/")

    tags = gtm_api.get("/%s/tags" % ws_path).get("tag", [])
    triggers = gtm_api.get("/%s/triggers" % ws_path).get("trigger", [])

    tag = next((t for t in tags if t.get("name") == "Ads - save_search"), None)
    trigger = next((t for t in triggers if t.get("name") == "CE - save_search"), None)

    print("=== Draft workspace ===")
    if not tag:
        print("  [MISSING] No 'Ads - save_search' tag in the workspace at all.")
    else:
        print("  Tag found: tagId=%s  paused=%s  label=%s" % (
            tag.get("tagId"), tag.get("paused", False), param(tag, "conversionLabel")))
        print("  firingTriggerId:", tag.get("firingTriggerId"))
    if not trigger:
        print("  [MISSING] No 'CE - save_search' trigger in the workspace at all.")
    else:
        print("  Trigger found: triggerId=%s" % trigger.get("triggerId"))

    if tag and trigger:
        wired = trigger.get("triggerId") in (tag.get("firingTriggerId") or [])
        print("  Tag actually fires on this trigger:", "YES" if wired else "NO (mismatched wiring!)")

    print("\n=== Live (published) version — what real visitors actually get ===")
    acct_id = container["accountId"]
    cid = container["containerId"]
    live = gtm_api.call("get", "/accounts/%s/containers/%s/versions:live" % (acct_id, cid))
    if "error" in live:
        print("  [!] No live/published version at all:", live["error"].get("message"))
        return
    print("  Published version:", live.get("containerVersionId"), "-", live.get("name") or "(unnamed)")
    live_tags = live.get("tag", [])
    live_triggers = live.get("trigger", [])
    live_tag = next((t for t in live_tags if t.get("name") == "Ads - save_search"), None)
    live_trigger = next((t for t in live_triggers if t.get("name") == "CE - save_search"), None)
    if not live_tag:
        print("  [MISSING FROM LIVE] 'Ads - save_search' is not in the published version — the")
        print("  draft workspace above was never published. Real visitors do not get this tag.")
    else:
        print("  Live tag found: paused=%s  label=%s" % (live_tag.get("paused", False), param(live_tag, "conversionLabel")))
        if live_trigger:
            wired_live = live_trigger.get("triggerId") in (live_tag.get("firingTriggerId") or [])
            print("  Live tag actually fires on the live trigger:", "YES" if wired_live else "NO")
        else:
            print("  [MISSING FROM LIVE] 'CE - save_search' trigger not in the published version.")


if __name__ == "__main__":
    main()
