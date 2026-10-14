"""Tests for get_agent_leads_from_portals_apify.py — the pure matching/merging logic. No network.

Run: python -m unittest test_get_agent_leads_from_portals_apify -v
"""

import os
import sys
import unittest
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault("AUTH_JWT_SECRET", "test-secret")

import get_agent_leads_from_portals_apify as m


class PhoneTests(unittest.TestCase):
    def test_national_number_formats(self):
        for raw in ("+91 98200 12345", "919820012345", "09820012345", "98200-12345"):
            self.assertEqual(m.national_number(raw), "9820012345", raw)

    def test_national_number_rejects_bad_input(self):
        for raw in (None, "", "12345", "98200"):
            self.assertIsNone(m.national_number(raw))

    def test_mobile_vs_landline(self):
        self.assertEqual(m.phone_kind("+91 98200 12345"), "mobile")
        self.assertEqual(m.phone_kind("9820012345"), "mobile")
        # An STD-coded landline must not be mistaken for a mobile once its leading 0 is stripped.
        self.assertEqual(m.phone_kind("080 2345 6789"), "landline")
        self.assertEqual(m.phone_kind("+91 80 2345 6789"), "landline")
        self.assertEqual(m.phone_kind("+91 80123 45678"), "mobile")  # 80xxx mobile series, written 5+5
        self.assertIsNone(m.phone_kind(None))
        self.assertFalse(m.is_mobile("044 2345 6789"))

    def test_phone_prefix_from_masked_value(self):
        self.assertEqual(m.phone_prefix("98200....."), "98200")
        self.assertEqual(m.phone_prefix("77380XXXXX"), "77380")
        self.assertIsNone(m.phone_prefix(None))


class AgentLabelTests(unittest.TestCase):
    def test_keeps_dealers_agents_brokers(self):
        for label in ("Dealer", "Featured Dealer", "Agent", "Certified Agent", "Broker"):
            self.assertTrue(m.is_agent_label(label), label)

    def test_drops_owners_and_builders(self):
        for label in ("Owner", "Builder", "Developer", "Seller", "", None):
            self.assertFalse(m.is_agent_label(label), label)


class NameMatchTests(unittest.TestCase):
    def test_generic_words_do_not_make_a_match(self):
        self.assertLess(m.name_similarity("Sunrise Real Estate", "Moonlight Real Estate"), m.REVIEW_SCORE)

    def test_same_firm_with_different_suffix_matches(self):
        self.assertGreaterEqual(m.name_similarity("Lakshmi Realty", "Sri Lakshmi Realty & Associates"), 0.6)
        self.assertGreaterEqual(m.name_similarity("Olive Homes", "OLIVE HOMES PVT LTD"), 0.95)

    def test_prefix_of_a_longer_name_is_damped(self):
        self.assertLess(m.name_similarity("Sri Lakshmi", "Sri Lakshmi Venkateswara Builders Group"),
                        m.name_similarity("Sri Lakshmi", "Sri Lakshmi Realty"))

    def test_all_generic_name_does_not_empty_the_key(self):
        self.assertNotEqual(m.firm_key("Real Estate"), "")


class ExtractionTests(unittest.TestCase):
    CUTOFF = datetime.now(timezone.utc) - timedelta(days=30)

    def acres(self, label="Dealer", company="Olive Homes", posted=None):
        posted = posted or datetime.now(timezone.utc).isoformat()
        return {
            "contact_details": {"company_name": company, "contact_name": "mir", "class_label": label},
            "listing": {"posted_at": posted, "details_url": "https://99acres/x"},
            "location": {"city": "Bangalore", "locality": "Whitefield, Bengaluru"},
        }

    def test_acres_dealer_kept_and_city_canonicalised(self):
        firm = m.firm_from_acres(self.acres(), self.CUTOFF)
        self.assertEqual(firm["city"], "Bengaluru")
        self.assertEqual(firm["firm"], "Olive Homes")

    def test_acres_owner_and_missing_company_dropped(self):
        self.assertIsNone(m.firm_from_acres(self.acres(label="Owner"), self.CUTOFF))
        self.assertIsNone(m.firm_from_acres(self.acres(company=""), self.CUTOFF))

    def test_acres_old_listing_dropped(self):
        old = (datetime.now(timezone.utc) - timedelta(days=90)).isoformat()
        self.assertIsNone(m.firm_from_acres(self.acres(posted=old), self.CUTOFF))

    def test_housing_row_carries_prefix(self):
        row = {"listerFirm": "Matrix Realty Solutions", "listerName": "X", "listerType": "Agent",
               "listerPhonePartial": "98200.....", "city": "Bangalore", "locality": "HSR"}
        firm = m.firm_from_housing(row)
        self.assertEqual(firm["prefix"], "98200")

    def test_housing_builder_dropped(self):
        self.assertIsNone(m.firm_from_housing({"listerFirm": "ABC", "listerType": "Builder"}))


class MergeAndMatchTests(unittest.TestCase):
    def test_same_firm_on_both_portals_merges(self):
        a = {"firm": "Olive Homes", "contact": "", "city": "Bengaluru", "locality": "Whitefield", "prefix": None, "url": "u1", "portal": "99acres"}
        b = {"firm": "OLIVE HOMES PVT LTD", "contact": "", "city": "Bengaluru", "locality": "", "prefix": "98200", "url": "u2", "portal": "housing"}
        firms = m.merge_firms([a, b, None])
        self.assertEqual(len(firms), 1)
        self.assertEqual(firms[0]["portals"], {"99acres", "housing"})
        self.assertEqual(firms[0]["listings"], 2)

    def test_same_name_in_different_cities_stays_separate(self):
        a = {"firm": "Olive Homes", "contact": "", "city": "Bengaluru", "locality": "", "prefix": None, "url": None, "portal": "99acres"}
        b = dict(a, city="Chennai")
        self.assertEqual(len(m.merge_firms([a, b])), 2)

    def firm(self):
        return m.merge_firms([{"firm": "Olive Homes", "contact": "", "city": "Bengaluru", "locality": "Whitefield",
                               "prefix": "98200", "url": None, "portal": "housing"}])[0]

    def test_prefix_and_locality_make_a_confident_match(self):
        place = {"title": "Olive Homes", "address": "Whitefield, Bengaluru", "phone": "+91 98200 12345"}
        match = m.best_match(self.firm(), [place])
        self.assertEqual(m.classify(match["score"]), "confident")
        self.assertTrue(match["prefix_hit"])

    def test_different_business_is_unmatched(self):
        place = {"title": "Taj Hotel", "address": "MG Road", "phone": "+91 98765 43210"}
        self.assertEqual(m.classify(m.best_match(self.firm(), [place])["score"]), "unmatched")

    def test_closed_business_is_penalised(self):
        place = {"title": "Olive Homes", "address": "Whitefield", "phone": "+91 98200 12345", "permanentlyClosed": True}
        self.assertNotEqual(m.classify(m.best_match(self.firm(), [place])["score"]), "confident")

    def test_landline_match_is_not_sms_capable(self):
        place = {"title": "Olive Homes", "address": "Whitefield, Bengaluru", "phone": "080 2345 6789"}
        row = m.result_row(self.firm(), m.best_match(self.firm(), [place]))
        self.assertEqual(row["mobile"], "landline")
        self.assertEqual(row["sms_capable"], "no")

    def test_confident_mobile_is_sms_capable(self):
        place = {"title": "Olive Homes", "address": "Whitefield, Bengaluru", "phone": "+91 98200 12345"}
        row = m.result_row(self.firm(), m.best_match(self.firm(), [place]))
        self.assertEqual(row["sms_capable"], "yes")


if __name__ == "__main__":
    unittest.main()
