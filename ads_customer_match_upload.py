"""Uploads existing users to Google Ads as a Customer Match list so they can be excluded from
acquisition campaigns (then run `python ads_exclude_existing_users.py --list "<name>"`).

Input: a CSV with columns email,phone, from apps/bff/scripts/export-customer-match.ts. Values are
normalised and SHA-256 hashed here, on this machine; raw contact details are never sent.

THIS SENDS HASHED PERSONAL DATA TO GOOGLE. It does nothing live unless you pass --confirm-consent,
which states that:
  - /privacy tells people their hashed contact details are shared with Google to exclude existing
    users from ads, and the business is entitled to do that; and
  - you are authorised to declare that consent for ad user data and personalisation is granted.
Run it with --dry-run first: that only counts what would be sent and sends nothing.

Delete the CSV afterwards. See docs/plans/avoid-paid-clicks-from-existing-users.md.

Run: python ads_customer_match_upload.py users.csv --dry-run
     python ads_customer_match_upload.py users.csv --confirm-consent
"""

import csv
import hashlib
import sys

from ads_setup_conversions import make_client
from google.ads.googleads.errors import GoogleAdsException

CID = "4214066478"
LIST_NAME = "Bhavano existing users (Customer Match)"
DRY = "--dry-run" in sys.argv
CONSENT = "--confirm-consent" in sys.argv
BATCH = 10000


def sha(value):
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def norm_email(raw):
    """Google's rule: trim, lowercase; for gmail.com and googlemail.com drop dots in the local part."""
    email = raw.strip().lower()
    if "@" not in email:
        return None
    local, domain = email.split("@", 1)
    if not local or "." not in domain:
        return None
    if domain in ("gmail.com", "googlemail.com"):
        local = local.replace(".", "")
        domain = "gmail.com"
    return "%s@%s" % (local, domain)


def norm_phone(raw):
    """E.164 for India: +91 followed by ten digits. Anything that does not look like a phone is skipped."""
    digits = "".join(c for c in raw if c.isdigit())
    if len(digits) == 10:
        digits = "91" + digits
    if len(digits) == 12 and digits.startswith("91"):
        return "+" + digits
    if 11 <= len(digits) <= 15 and raw.strip().startswith("+"):
        return "+" + digits
    return None


def load(path):
    emails, phones = set(), set()
    skipped = 0
    with open(path, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            e = norm_email(row.get("email") or "")
            p = norm_phone(row.get("phone") or "")
            if e:
                emails.add(sha(e))
            if p:
                phones.add(sha(p))
            if not e and not p:
                skipped += 1
    return emails, phones, skipped


def main():
    paths = [a for a in sys.argv[1:] if not a.startswith("--")]
    if not paths:
        print(__doc__)
        return
    emails, phones, skipped = load(paths[0])
    print("%d unique hashed emails, %d unique hashed phones; %d rows had neither." % (len(emails), len(phones), skipped))
    if DRY:
        print("[DRY RUN] Nothing was sent.")
        return
    if not CONSENT:
        print("Refusing to upload without --confirm-consent (read the notes at the top of this file).")
        return
    if len(emails) + len(phones) < 1000:
        print("Warning: Google needs about 1,000 matched members before a list can be used for targeting or "
              "exclusion; this list is smaller and may not become usable yet.")

    client = make_client()
    try:
        ul_op = client.get_type("UserListOperation")
        ul = ul_op.create
        ul.name = LIST_NAME
        ul.membership_life_span = 540
        ul.crm_based_user_list.upload_key_type = client.enums.CustomerMatchUploadKeyTypeEnum.CONTACT_INFO
        ul.crm_based_user_list.data_source_type = client.enums.UserListCrmDataSourceTypeEnum.FIRST_PARTY
        list_resource = client.get_service("UserListService").mutate_user_lists(
            customer_id=CID, operations=[ul_op]).results[0].resource_name

        job_svc = client.get_service("OfflineUserDataJobService")
        job = client.get_type("OfflineUserDataJob")
        job.type_ = client.enums.OfflineUserDataJobTypeEnum.CUSTOMER_MATCH_USER_LIST
        job.customer_match_user_list_metadata.user_list = list_resource
        consent = job.customer_match_user_list_metadata.consent
        consent.ad_user_data = client.enums.ConsentStatusEnum.GRANTED
        consent.ad_personalization = client.enums.ConsentStatusEnum.GRANTED
        job_resource = job_svc.create_offline_user_data_job(customer_id=CID, job=job).resource_name

        ops = []
        for h in emails:
            op = client.get_type("OfflineUserDataJobOperation")
            op.create.user_identifiers.add().hashed_email = h
            ops.append(op)
        for h in phones:
            op = client.get_type("OfflineUserDataJobOperation")
            op.create.user_identifiers.add().hashed_phone_number = h
            ops.append(op)
        for i in range(0, len(ops), BATCH):
            job_svc.add_offline_user_data_job_operations(
                resource_name=job_resource, operations=ops[i:i + BATCH], enable_partial_failure=True)
        job_svc.run_offline_user_data_job(resource_name=job_resource)
        print("Uploaded %d hashed identifiers to %r. Google can take up to about 48 hours to match them;" % (len(ops), LIST_NAME))
        print("then run: python ads_exclude_existing_users.py --list \"%s\"" % LIST_NAME)
    except GoogleAdsException as e:
        print("FAILED:")
        for err in e.failure.errors:
            print("  -", err.message)


if __name__ == "__main__":
    main()
