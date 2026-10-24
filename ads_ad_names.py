"""Read-only: prints the AD_NAMES block for apps/bff/src/ads/campaign-names.ts.

Every ad in the Google Ads account (not removed) becomes `'<ad id>': '<first two headlines> (...<last 4 digits>)'`,
so the admin analytics can show a readable name for an ad id instead of a bare number. The last four
digits are kept because several ads in one ad group share their first headlines.

Nothing here changes the account: it is one GAQL SELECT.

Run: python ads_ad_names.py > ad_names.txt   (then paste the block into campaign-names.ts)
"""
import os

from dotenv import load_dotenv

from ads_setup_conversions import make_client

load_dotenv(".env")

QUERY = """
  SELECT ad_group_ad.ad.id, ad_group_ad.ad.responsive_search_ad.headlines, ad_group_ad.ad.type
  FROM ad_group_ad
  WHERE ad_group_ad.status != 'REMOVED'
  ORDER BY ad_group_ad.ad.id
"""


def label(ad) -> str:
    try:
        headlines = [h.text for h in ad.responsive_search_ad.headlines][:2]
    except Exception:
        headlines = []
    text = " / ".join(h for h in headlines if h) or "(no text)"
    return f"{text} (...{str(ad.id)[-4:]})"


def main() -> None:
    customer_id = os.getenv("GOOGLE_ADS_CUSTOMER_ID", "").replace("-", "")
    client = make_client()
    svc = client.get_service("GoogleAdsService")
    print("export const AD_NAMES: Record<string, string> = {")
    for row in svc.search(customer_id=customer_id, query=QUERY):
        ad = row.ad_group_ad.ad
        name = label(ad).replace("\\", "\\\\").replace("'", "\\'")
        print(f"  '{ad.id}': '{name}',")
    print("};")


if __name__ == "__main__":
    main()
