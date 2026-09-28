"""Narrows the four Other-Metro campaigns to the five tier-2 cities that actually have listings and
convert (Kolkata, Ahmedabad, Jaipur, Lucknow, Coimbatore), removing the other 26 city targets.
Campaigns, budgets, keywords and ads are untouched, so their budget concentrates on the five.

Why: docs/plans/google-ads-performance-analysis-2026-09.md, "Narrow to 11 cities?" — the 26 took
34% of spend at ₹139 CPA (vs ₹104) and hold 7% of listings with 2 enquiries in 18 days.

Run: python ads_narrow_other_metro_cities.py --dry-run     (validate only, changes nothing)
     python ads_narrow_other_metro_cities.py
     python ads_narrow_other_metro_cities.py --restore     (adds the removed cities back)
"""

import sys

from ads_setup_conversions import make_client
from google.ads.googleads.errors import GoogleAdsException

CID = "4214066478"
CAMPAIGN_PREFIX = "Other-Metro-"
KEEP = {"Kolkata", "Ahmedabad", "Jaipur", "Lucknow", "Coimbatore"}

DRY = "--dry-run" in sys.argv
RESTORE = "--restore" in sys.argv


def main():
    client = make_client()
    ga = client.get_service("GoogleAdsService")
    svc = client.get_service("CampaignCriterionService")

    campaigns = {
        r.campaign.resource_name: r.campaign.name
        for r in ga.search(customer_id=CID, query=(
            "SELECT campaign.resource_name, campaign.name FROM campaign "
            "WHERE campaign.status = 'ENABLED' AND campaign.name LIKE '%s%%'" % CAMPAIGN_PREFIX))
    }
    print("Account %s%s — %d campaigns\n" % (CID, "   [DRY RUN]" if DRY else "", len(campaigns)))

    if RESTORE:
        restore(client, ga, svc, campaigns)
        return

    crit = list(ga.search(customer_id=CID, query=(
        "SELECT campaign.resource_name, campaign_criterion.resource_name, "
        "campaign_criterion.location.geo_target_constant FROM campaign_criterion "
        "WHERE campaign_criterion.type = 'LOCATION' AND campaign_criterion.negative = FALSE "
        "AND campaign.status = 'ENABLED' AND campaign.name LIKE '%s%%'" % CAMPAIGN_PREFIX)))
    names = geo_names(ga, {r.campaign_criterion.location.geo_target_constant for r in crit})

    for camp_rn, camp_name in sorted(campaigns.items(), key=lambda x: x[1]):
        mine = [r for r in crit if r.campaign.resource_name == camp_rn]
        keep = [r for r in mine if names[r.campaign_criterion.location.geo_target_constant] in KEEP]
        drop = [r for r in mine if names[r.campaign_criterion.location.geo_target_constant] not in KEEP]
        if len(keep) != len(KEEP):
            print("  SKIP %s — expected %d kept cities, found %d; not touching it" % (camp_name, len(KEEP), len(keep)))
            continue
        if not drop:
            print("  ok   %s — already narrowed" % camp_name)
            continue
        ops = []
        for r in drop:
            op = client.get_type("CampaignCriterionOperation")
            op.remove = r.campaign_criterion.resource_name
            ops.append(op)
        mutate(client, svc, ops, "%s: keep %d, remove %d (%s)" % (
            camp_name, len(keep), len(drop),
            ", ".join(sorted(names[r.campaign_criterion.location.geo_target_constant] for r in drop))))


def restore(client, ga, svc, campaigns):
    """Adds the 26 removed cities back to each Other-Metro campaign, skipping any already there."""
    for camp_rn, camp_name in sorted(campaigns.items(), key=lambda x: x[1]):
        have = {r.campaign_criterion.location.geo_target_constant for r in ga.search(customer_id=CID, query=(
            "SELECT campaign_criterion.location.geo_target_constant FROM campaign_criterion "
            "WHERE campaign_criterion.type = 'LOCATION' AND campaign.resource_name = '%s'" % camp_rn))}
        ops = []
        for geo_id in REMOVED_GEO_IDS:
            rn = "geoTargetConstants/%s" % geo_id
            if rn in have:
                continue
            op = client.get_type("CampaignCriterionOperation")
            op.create.campaign = camp_rn
            op.create.location.geo_target_constant = rn
            ops.append(op)
        if ops:
            mutate(client, svc, ops, "%s: re-add %d cities" % (camp_name, len(ops)))
        else:
            print("  ok   %s — nothing to restore" % camp_name)


def geo_names(ga, resource_names):
    ids = ",".join(rn.split("/")[-1] for rn in resource_names if rn)
    if not ids:
        return {}
    return {
        r.geo_target_constant.resource_name: r.geo_target_constant.name
        for r in ga.search(customer_id=CID, query=(
            "SELECT geo_target_constant.resource_name, geo_target_constant.name "
            "FROM geo_target_constant WHERE geo_target_constant.id IN (%s)" % ids))
    }


def mutate(client, svc, ops, label):
    request = client.get_type("MutateCampaignCriteriaRequest")
    request.customer_id = CID
    request.operations.extend(ops)
    request.validate_only = DRY
    try:
        svc.mutate_campaign_criteria(request=request)
        print("  %s %s" % ("WOULD" if DRY else "done ", label))
    except GoogleAdsException as e:
        msg = e.failure.errors[0].message if e.failure.errors else str(e)
        print("  FAILED %s -> %s" % (label, msg))


# The 26 cities this removes, as geo target constant ids, so --restore adds back exactly these.
REMOVED_GEO_IDS = [
    "1007800",  # Amritsar
    "1007792",  # Bhopal
    "1007799",  # Bhubaneswar
    "1007801",  # Chandigarh
    "1007819",  # Dehradun
    "1007745",  # Guwahati
    "1007796",  # Indore
    "1007823",  # Kanpur
    "1007776",  # Kochi
    "1007778",  # Kozhikode
    "1007802",  # Ludhiana
    "1007812",  # Madurai
    "1007772",  # Mangaluru
    "1007773",  # Mysuru
    "1007786",  # Nagpur
    "9040235",  # Nashik
    "9040227",  # Panaji
    "1007749",  # Patna
    "9040198",  # Raipur
    "1007759",  # Rajkot
    "9040192",  # Ranchi
    "1007760",  # Surat
    "1007779",  # Thiruvananthapuram
    "1007761",  # Vadodara
    "1007742",  # Vijayawada
    "1007743",  # Visakhapatnam
]


if __name__ == "__main__":
    main()
