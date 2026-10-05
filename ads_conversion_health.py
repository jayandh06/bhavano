"""Read-only: why does Google Ads flag a conversion action "Misconfigured" / "Needs attention"?

Prints, for every non-removed conversion action: type, category, primary/secondary, counting,
value settings and 30-day stats; the Data Manager upload summary (status, alerts, recent
daily/job results) for UPLOAD_CLICKS actions; and the account's conversion goals (which
category+origin pairs are biddable).

Run: python ads_conversion_health.py
"""

from ads_setup_conversions import make_client
from google.ads.googleads.errors import GoogleAdsException

CID = "4214066478"


def search(ga, query):
    try:
        return list(ga.search(customer_id=CID, query=query))
    except GoogleAdsException as e:
        print("  QUERY FAILED:", e.failure.errors[0].message if e.failure.errors else e)
        return []


def main():
    client = make_client()
    ga = client.get_service("GoogleAdsService")

    print("=== Conversion actions (non-removed) ===")
    for r in search(ga, """
        SELECT conversion_action.id, conversion_action.name, conversion_action.status,
               conversion_action.type, conversion_action.category, conversion_action.origin,
               conversion_action.primary_for_goal, conversion_action.include_in_conversions_metric,
               conversion_action.counting_type, conversion_action.value_settings.default_value,
               conversion_action.value_settings.always_use_default_value,
               conversion_action.value_settings.default_currency_code,
               conversion_action.click_through_lookback_window_days,
               conversion_action.attribution_model_settings.attribution_model
        FROM conversion_action
        WHERE conversion_action.status != 'REMOVED'
        ORDER BY conversion_action.name
    """):
        ca = r.conversion_action
        print("- %s  id=%s  %s  type=%s  cat=%s  origin=%s" % (
            ca.name, ca.id, ca.status.name, ca.type_.name, ca.category.name, ca.origin.name))
        print("    primary=%s  in_conversions=%s  counting=%s  value: default=%s %s always_default=%s  lookback=%sd  attribution=%s" % (
            ca.primary_for_goal, ca.include_in_conversions_metric, ca.counting_type.name,
            ca.value_settings.default_value, ca.value_settings.default_currency_code,
            ca.value_settings.always_use_default_value, ca.click_through_lookback_window_days,
            ca.attribution_model_settings.attribution_model.name))

    print("\n=== 30-day stats by action ===")
    for r in search(ga, """
        SELECT segments.conversion_action_name, metrics.all_conversions,
               metrics.all_conversions_value, metrics.conversions, metrics.conversions_value
        FROM customer
        WHERE segments.date DURING LAST_30_DAYS
    """):
        m = r.metrics
        print("  %-40s all=%.1f (₹%.0f)  biddable=%.1f (₹%.0f)" % (
            r.segments.conversion_action_name, m.all_conversions, m.all_conversions_value,
            m.conversions, m.conversions_value))

    print("\n=== Upload summaries (UPLOAD_CLICKS) ===")
    for r in search(ga, """
        SELECT offline_conversion_upload_conversion_action_summary.conversion_action_name,
               offline_conversion_upload_conversion_action_summary.conversion_action_id,
               offline_conversion_upload_conversion_action_summary.client,
               offline_conversion_upload_conversion_action_summary.status,
               offline_conversion_upload_conversion_action_summary.total_event_count,
               offline_conversion_upload_conversion_action_summary.successful_event_count,
               offline_conversion_upload_conversion_action_summary.pending_event_count,
               offline_conversion_upload_conversion_action_summary.last_upload_date_time,
               offline_conversion_upload_conversion_action_summary.alerts,
               offline_conversion_upload_conversion_action_summary.daily_summaries
        FROM offline_conversion_upload_conversion_action_summary
    """):
        s = r.offline_conversion_upload_conversion_action_summary
        print("- %s (id=%s) client=%s status=%s total=%s ok=%s pending=%s last=%s" % (
            s.conversion_action_name, s.conversion_action_id, s.client.name, s.status.name,
            s.total_event_count, s.successful_event_count, s.pending_event_count,
            s.last_upload_date_time))
        for a in s.alerts:
            print("    ALERT %s  rate=%.2f" % (a.error, a.error_percentage))
        for d in list(s.daily_summaries)[:7]:
            print("    %s  ok=%s failed=%s pending=%s" % (
                d.upload_date, d.successful_count, d.failed_count, d.pending_count))

    print("\n=== Account conversion tracking settings ===")
    for r in search(ga, """
        SELECT customer.conversion_tracking_setting.conversion_tracking_status,
               customer.conversion_tracking_setting.accepted_customer_data_terms,
               customer.conversion_tracking_setting.enhanced_conversions_for_leads_enabled,
               customer.conversion_tracking_setting.google_ads_conversion_customer,
               customer.conversion_tracking_setting.conversion_tracking_id
        FROM customer
    """):
        s = r.customer.conversion_tracking_setting
        print("  status=%s  customer_data_terms=%s  ec_for_leads=%s  conversion_customer=%s  tracking_id=%s" % (
            s.conversion_tracking_status.name, s.accepted_customer_data_terms,
            s.enhanced_conversions_for_leads_enabled, s.google_ads_conversion_customer,
            s.conversion_tracking_id))

    print("\n=== Upload client summaries ===")
    for r in search(ga, """
        SELECT offline_conversion_upload_client_summary.client,
               offline_conversion_upload_client_summary.status,
               offline_conversion_upload_client_summary.success_rate,
               offline_conversion_upload_client_summary.alerts
        FROM offline_conversion_upload_client_summary
    """):
        s = r.offline_conversion_upload_client_summary
        print("  client=%s status=%s success=%.2f" % (s.client.name, s.status.name, s.success_rate))
        for a in s.alerts:
            print("    ALERT %s  rate=%.2f" % (a.error, a.error_percentage))

    print("\n=== Account conversion goals ===")
    for r in search(ga, """
        SELECT customer_conversion_goal.category, customer_conversion_goal.origin,
               customer_conversion_goal.biddable
        FROM customer_conversion_goal
    """):
        g = r.customer_conversion_goal
        print("  %-22s %-12s biddable=%s" % (g.category.name, g.origin.name, g.biddable))


if __name__ == "__main__":
    main()
