"""Creates a container version from the Default Workspace and publishes it live.

Step 5 of docs/plans/consolidate-analytics-and-ads-on-gtm.md.

IMPORTANT: publishing promotes the ENTIRE workspace, not one tag. Everything currently in
the workspace goes live together. Run gtm_audit.py first to see exactly what that is.

Rollback is instant and does not need a deploy: GTM keeps every version, and any previous
one can be re-published from the dashboard (Versions -> ... -> Publish) or by passing
--rollback-to <versionId> here.

Run: python gtm_publish.py --name "..." --notes "..."
     python gtm_publish.py --dry-run
     python gtm_publish.py --rollback-to 2
"""

import argparse

import gtm_api


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--name", default="GA4 event tracking + Conversion Linker")
    ap.add_argument("--notes", default="")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--rollback-to", metavar="VERSION_ID")
    args = ap.parse_args()

    container = gtm_api.find_container()
    cpath = container["path"].lstrip("/")

    if args.rollback_to:
        if args.dry_run:
            print("WOULD republish version %s" % args.rollback_to)
            return
        gtm_api.post("/%s/versions/%s:publish" % (cpath, args.rollback_to))
        print("Republished version %s — live now." % args.rollback_to)
        return

    workspace = gtm_api.default_workspace(container)
    ws = workspace["path"].lstrip("/")

    tags = gtm_api.get("/%s/tags" % ws).get("tag", [])
    triggers = gtm_api.get("/%s/triggers" % ws).get("trigger", [])
    variables = gtm_api.get("/%s/variables" % ws).get("variable", [])
    live = gtm_api.get("/%s/versions:live" % cpath)

    print("Container : %s (%s)" % (container.get("name"), container.get("publicId")))
    print("Currently live: %s (id=%s, %d tags)" % (
        live.get("name"), live.get("containerVersionId"), len(live.get("tag", []))))
    print("\nAbout to publish the whole workspace: %d tags, %d triggers, %d variables" % (
        len(tags), len(triggers), len(variables)))
    for t in tags:
        print("   tag: %s (%s)" % (t.get("name"), t.get("type")))

    if args.dry_run:
        print("\n[dry run] nothing created or published.")
        return

    version = gtm_api.post(
        "/%s:create_version" % ws,
        json={"name": args.name, "notes": args.notes},
    )
    cv = version.get("containerVersion", version)
    vid = cv.get("containerVersionId")
    if not vid:
        raise SystemExit("Version creation returned no containerVersionId: %s" % version)
    print("\nCreated version %s: %s" % (vid, cv.get("name")))

    gtm_api.post("/%s/versions/%s:publish" % (cpath, vid))
    print("PUBLISHED version %s — live on the site now." % vid)
    print("Rollback if needed: python gtm_publish.py --rollback-to %s" % live.get("containerVersionId"))


if __name__ == "__main__":
    main()
