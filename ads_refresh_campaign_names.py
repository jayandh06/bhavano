"""Rewrites the CAMPAIGN_NAMES and AD_GROUP_NAMES maps in apps/bff/src/ads/campaign-names.ts from the live account (read-only against Google Ads).

The admin Page visits screen shows a visit's campaign and ad group by these names and builds its Campaign / Ad group filter lists from them; an id that is missing shows as a bare number.
Re-run after creating or renaming a campaign or ad group:  python ads_refresh_campaign_names.py
"""

import re
import sys
from datetime import date

from ads_setup_conversions import make_client

CID = "4214066478"
PATH = "apps/bff/src/ads/campaign-names.ts"


def q(s):
    return s.replace("\\", "\\\\").replace("'", "\\'")


def main():
    client = make_client()
    ga = client.get_service("GoogleAdsService")
    camps = {}
    for r in ga.search(customer_id=CID, query="SELECT campaign.id, campaign.name, campaign.status FROM campaign WHERE campaign.status != 'REMOVED' ORDER BY campaign.id"):
        camps[str(r.campaign.id)] = (r.campaign.name, r.campaign.status.name)
    groups = []
    for r in ga.search(customer_id=CID, query="SELECT campaign.id, campaign.name, ad_group.id, ad_group.name, ad_group.status FROM ad_group WHERE ad_group.status != 'REMOVED' ORDER BY campaign.name, ad_group.name"):
        groups.append((str(r.ad_group.id), r.ad_group.name, r.campaign.name, r.ad_group.status.name))

    camp_lines = ["export const CAMPAIGN_NAMES: Record<string, string> = {"]
    for cid, (name, status) in camps.items():
        camp_lines.append("  '%s': '%s',%s" % (cid, q(name), " // paused" if status == "PAUSED" else ""))
    camp_lines.append("};")

    group_lines = ["export const AD_GROUP_NAMES: Record<string, string> = {"]
    for gid, name, campaign, status in groups:
        group_lines.append("  '%s': '%s', // %s%s" % (gid, q(name), campaign, " (paused)" if status == "PAUSED" else ""))
    group_lines.append("};")

    s = open(PATH, encoding="utf8", newline="").read()
    nl = "\r\n" if "\r\n" in s else "\n"
    t = s.replace("\r\n", "\n")
    t, n1 = re.subn(r"export const CAMPAIGN_NAMES: Record<string, string> = \{.*?\n\};", lambda m: "\n".join(camp_lines), t, count=1, flags=re.S)
    t, n2 = re.subn(r"export const AD_GROUP_NAMES: Record<string, string> = \{.*?\n\};", lambda m: "\n".join(group_lines), t, count=1, flags=re.S)
    assert n1 == 1 and n2 == 1, (n1, n2)
    t = re.sub(r"Last regenerated\s+\d{4}-\d{2}-\d{2}", "Last regenerated " + date.today().isoformat(), t, count=1)
    open(PATH, "w", encoding="utf8", newline="").write(t.replace("\n", nl))
    print("%d campaigns, %d ad groups written to %s" % (len(camps), len(groups), PATH))


if __name__ == "__main__":
    main()
