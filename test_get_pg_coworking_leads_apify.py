"""Regression tests for get_pg_coworking_leads_apify.py — every function added/changed while
building the Apify-based scraper this session, consolidated from what was until now only ad-hoc,
throwaway verification (real live Apify calls, one-off heredoc scripts) into a real, checked-in
suite. No network calls: requests.post/get are always mocked.

Uses Python's built-in unittest (no new dependency — this repo has no requirements.txt and no
existing Python test framework; test_connection.py is a live smoke-check, not an automated test).

Run: python3 -m unittest test_get_pg_coworking_leads_apify -v
"""

import os
import sys
import tempfile
import unittest
from unittest.mock import patch

import requests

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault("AUTH_JWT_SECRET", "test-secret")

import get_pg_coworking_leads_apify as scraper


class FakeResp:
    def __init__(self, status_code=200, json_data=None):
        self.status_code = status_code
        self._json = json_data if json_data is not None else []

    def raise_for_status(self):
        if self.status_code >= 400:
            raise requests.HTTPError(f"HTTP {self.status_code}")

    def json(self):
        return self._json


class SlugifyTests(unittest.TestCase):
    def test_lowercases_and_hyphenates(self):
        self.assertEqual(scraper.slugify("Gents PG"), "gents-pg")

    def test_strips_punctuation(self):
        self.assertEqual(scraper.slugify("Ladies PG!!"), "ladies-pg")

    def test_collapses_multiple_separators(self):
        self.assertEqual(scraper.slugify("pg,coworking"), "pg-coworking")


class ApifySearchTests(unittest.TestCase):
    def setUp(self):
        self.counter = scraper.RequestCounter()

    def test_happy_path_uses_bearer_auth_and_omits_maxImages_by_default(self):
        places = [{"placeId": "p1", "title": "Test PG"}]
        with patch("requests.post", return_value=FakeResp(200, places)) as mock_post:
            result = scraper.apify_search("tok", "actor1", "Gents PG", "Whitefield, Bengaluru, India", 20, 300, self.counter)
        self.assertEqual(result, places)
        self.assertEqual(self.counter.actor_runs, 1)
        call = mock_post.call_args
        self.assertEqual(call.kwargs["headers"]["Authorization"], "Bearer tok")
        self.assertEqual(call.kwargs["json"]["searchStringsArray"], ["Gents PG"])
        self.assertNotIn("maxImages", call.kwargs["json"])

    def test_max_images_above_one_is_sent(self):
        with patch("requests.post", return_value=FakeResp(200, [])) as mock_post:
            scraper.apify_search("tok", "actor1", "q", "loc", 20, 300, self.counter, max_images=3)
        self.assertEqual(mock_post.call_args.kwargs["json"]["maxImages"], 3)

    def test_max_images_of_one_is_not_sent(self):
        with patch("requests.post", return_value=FakeResp(200, [])) as mock_post:
            scraper.apify_search("tok", "actor1", "q", "loc", 20, 300, self.counter, max_images=1)
        self.assertNotIn("maxImages", mock_post.call_args.kwargs["json"])

    def test_408_timeout_returns_empty_without_raising(self):
        with patch("requests.post", return_value=FakeResp(408)):
            result = scraper.apify_search("tok", "actor1", "q", "loc", 20, 300, self.counter)
        self.assertEqual(result, [])
        self.assertEqual(self.counter.actor_runs, 1)

    def test_network_error_returns_empty_without_raising(self):
        with patch("requests.post", side_effect=requests.RequestException("boom")):
            result = scraper.apify_search("tok", "actor1", "q", "loc", 20, 300, self.counter)
        self.assertEqual(result, [])
        self.assertEqual(self.counter.actor_runs, 0)


class BuildContactTests(unittest.TestCase):
    def _place(self, **overrides):
        place = {
            "placeId": "p1", "title": "Sunrise PG for Gents", "address": "123 Main Rd",
            "phone": "+919999999999", "website": "https://sunrisepg.example",
            "location": {"lat": 12.97, "lng": 77.75}, "totalScore": 4.3, "reviewsCount": 87,
            "categories": ["Hostel", "PG"], "permanentlyClosed": False, "temporarilyClosed": False,
        }
        place.update(overrides)
        return place

    def test_maps_core_fields(self):
        c = scraper.build_contact(
            "Bengaluru", "Whitefield", "pg", "q", self._place(), [], "city1", "area1", use_geocode=False,
        )
        self.assertEqual(c["name"], "Sunrise PG for Gents")
        self.assertEqual(c["phone"], "+919999999999")
        self.assertEqual((c["lat"], c["lng"]), (12.97, 77.75))
        self.assertEqual(c["googleRating"], 4.3)
        self.assertEqual(c["googleReviewCount"], 87)
        self.assertEqual(c["googlePlaceId"], "p1")
        self.assertEqual(c["businessCategory"], "pg")
        self.assertEqual((c["cityId"], c["areaId"]), ("city1", "area1"))
        self.assertIn("Categories: Hostel, PG", c["notes"])

    def test_business_status_operational_by_default(self):
        c = scraper.build_contact("B", None, "pg", "q", self._place(), [], None, None, use_geocode=False)
        self.assertEqual(c["businessStatus"], "OPERATIONAL")

    def test_business_status_closed_permanently(self):
        c = scraper.build_contact(
            "B", None, "pg", "q", self._place(permanentlyClosed=True), [], None, None, use_geocode=False,
        )
        self.assertEqual(c["businessStatus"], "CLOSED_PERMANENTLY")

    def test_business_status_closed_temporarily(self):
        c = scraper.build_contact(
            "B", None, "pg", "q", self._place(temporarilyClosed=True), [], None, None, use_geocode=False,
        )
        self.assertEqual(c["businessStatus"], "CLOSED_TEMPORARILY")

    def test_missing_name_and_phone_handled_gracefully(self):
        bare_place = {"placeId": "p2", "location": {"lat": 1, "lng": 1}}
        c = scraper.build_contact("B", None, "pg", "q", bare_place, [], None, None, use_geocode=False)
        self.assertEqual(c["name"], "(no name)")
        self.assertIsNone(c["phone"])
        self.assertIsNone(c["googleRating"])
        self.assertEqual(c["businessStatus"], "OPERATIONAL")

    def test_places_fetch_log_id_threaded_through(self):
        c = scraper.build_contact(
            "B", None, "pg", "q", self._place(), [], None, None, use_geocode=False, places_fetch_log_id="log1",
        )
        self.assertEqual(c["placesFetchLogId"], "log1")

    def test_local_photo_paths_recorded_in_notes(self):
        c = scraper.build_contact(
            "B", None, "pg", "q", self._place(), ["/tmp/photos/p1_0.jpg"], None, None, use_geocode=False,
        )
        self.assertIn("Local photos: /tmp/photos/p1_0.jpg", c["notes"])


class CollectCityTests(unittest.TestCase):
    def setUp(self):
        self.counter = scraper.RequestCounter()
        self.locations = [{"area": "Whitefield", "areaId": "area1"}, {"area": "Koramangala", "areaId": "area2"}]

    def _place(self, place_id, rating=4.5, image_url="https://img.example/1.jpg"):
        return {
            "placeId": place_id, "title": f"PG {place_id}", "address": "a", "phone": "1",
            "location": {"lat": 1, "lng": 1}, "totalScore": rating, "reviewsCount": 10,
            "categories": [], "imageUrl": image_url,
        }

    def test_skip_check_respects_fetched_pairs(self):
        fetched_pairs = {("area1", "pg", "PG accommodation")}
        with patch.object(scraper, "create_places_fetch_log", return_value="log1") as mock_create, \
             patch.object(scraper, "apify_search", return_value=[self._place("p1")]):
            contacts, _ = scraper.collect_city(
                "tok", "actor", "Bengaluru", "city1", self.locations, ["pg"], 20, "/tmp/x", False, 1,
                self.counter, fetched_pairs, force=False, bff_url="http://x", use_geocode=False,
                bff_token="jwt", dry_run=False, query_prefix=None,
            )
        # area1 already fetched under the default prefix -> only area2 searched
        self.assertEqual(mock_create.call_count, 1)
        self.assertEqual(mock_create.call_args[0][2]["areaId"], "area2")
        self.assertEqual(len(contacts), 1)
        self.assertEqual(contacts[0]["placesFetchLogId"], "log1")

    def test_different_query_prefix_is_not_wrongly_skipped(self):
        fetched_pairs = {("area1", "pg", "PG accommodation")}  # only the default-prefix fetch logged
        with patch.object(scraper, "create_places_fetch_log", return_value="log1") as mock_create, \
             patch.object(scraper, "apify_search", return_value=[]):
            scraper.collect_city(
                "tok", "actor", "Bengaluru", "city1", self.locations, ["pg"], 20, "/tmp/x", False, 1,
                self.counter, fetched_pairs, force=False, bff_url="http://x", use_geocode=False,
                bff_token="jwt", dry_run=False, query_prefix="Gents PG",
            )
        # both areas searched under the new prefix, since neither is in fetched_pairs under it
        self.assertEqual(mock_create.call_count, 2)
        self.assertEqual({c[0][2]["areaId"] for c in mock_create.call_args_list}, {"area1", "area2"})

    def test_min_rating_filters_after_counting_found(self):
        places = [self._place("p1", rating=4.8), self._place("p2", rating=3.0)]
        with patch.object(scraper, "create_places_fetch_log", return_value="log1"), \
             patch.object(scraper, "apify_search", return_value=places):
            contacts, pair_stats = scraper.collect_city(
                "tok", "actor", "Bengaluru", "city1", [self.locations[0]], ["pg"], 20, "/tmp/x", False, 1,
                self.counter, set(), force=False, min_rating=4.0, bff_url="http://x", use_geocode=False,
                bff_token="jwt", dry_run=False, query_prefix=None,
            )
        self.assertEqual(len(contacts), 1)
        self.assertEqual(contacts[0]["name"], "PG p1")
        stats = pair_stats[("Whitefield", "pg")]
        self.assertEqual((stats["found"], stats["imported"]), (2, 1))

    def test_dry_run_never_creates_fetch_log_and_contacts_have_no_log_id(self):
        with patch.object(scraper, "create_places_fetch_log") as mock_create, \
             patch.object(scraper, "apify_search", return_value=[self._place("p1")]):
            contacts, _ = scraper.collect_city(
                "tok", "actor", "Bengaluru", "city1", [self.locations[0]], ["pg"], 20, "/tmp/x", False, 1,
                self.counter, set(), force=False, bff_url="http://x", use_geocode=False,
                bff_token="jwt", dry_run=True, query_prefix=None,
            )
        mock_create.assert_not_called()
        self.assertTrue(all(c["placesFetchLogId"] is None for c in contacts))

    def test_downloads_plural_imageUrls_when_present_else_falls_back_to_singular(self):
        place_multi = self._place("p1")
        place_multi["imageUrls"] = ["u1", "u2", "u3"]
        captured = []

        def fake_download(image_urls, place_id, out_dir, max_photos, counter):
            captured.append(list(image_urls))
            return []

        with patch.object(scraper, "create_places_fetch_log", return_value="log1"), \
             patch.object(scraper, "apify_search", return_value=[place_multi]), \
             patch.object(scraper, "download_apify_photos", side_effect=fake_download):
            scraper.collect_city(
                "tok", "actor", "Bengaluru", "city1", [self.locations[0]], ["pg"], 20, "/tmp/x", True, 3,
                self.counter, set(), force=False, bff_url="http://x", use_geocode=False,
                bff_token="jwt", dry_run=False, query_prefix=None,
            )
        self.assertEqual(captured, [["u1", "u2", "u3"]])

    def test_falls_back_to_singular_imageUrl_when_no_plural_field(self):
        captured = []

        def fake_download(image_urls, place_id, out_dir, max_photos, counter):
            captured.append(list(image_urls))
            return []

        with patch.object(scraper, "create_places_fetch_log", return_value="log1"), \
             patch.object(scraper, "apify_search", return_value=[self._place("p1", image_url="only-one.jpg")]), \
             patch.object(scraper, "download_apify_photos", side_effect=fake_download):
            scraper.collect_city(
                "tok", "actor", "Bengaluru", "city1", [self.locations[0]], ["pg"], 20, "/tmp/x", True, 1,
                self.counter, set(), force=False, bff_url="http://x", use_geocode=False,
                bff_token="jwt", dry_run=False, query_prefix=None,
            )
        self.assertEqual(captured, [["only-one.jpg"]])


class ImportContactsBatchedTests(unittest.TestCase):
    def test_splits_into_batches_and_sums_totals(self):
        contacts = [{"name": f"c{i}"} for i in range(45)]
        sizes = []

        def fake_import(bff_url, token, batch):
            sizes.append(len(batch))
            return {"created": len(batch), "updated": 0, "skipped": 0}

        with patch.object(scraper, "import_contacts", side_effect=fake_import):
            result = scraper.import_contacts_batched("http://x", "tok", contacts)

        self.assertEqual(sizes, [20, 20, 5])
        self.assertEqual(result, {"created": 45, "updated": 0, "skipped": 0, "failed_batches": 0})

    def test_one_failed_batch_does_not_stop_the_others(self):
        contacts = [{"name": f"c{i}"} for i in range(45)]
        calls = []

        def fake_import(bff_url, token, batch):
            calls.append(len(batch))
            if len(calls) == 2:
                raise requests.HTTPError("413 Payload Too Large")
            return {"created": len(batch), "updated": 0, "skipped": 0}

        with patch.object(scraper, "import_contacts", side_effect=fake_import):
            result = scraper.import_contacts_batched("http://x", "tok", contacts)

        self.assertEqual(len(calls), 3, "all 3 batches should still be attempted")
        self.assertEqual(result["failed_batches"], 1)
        self.assertEqual(result["created"], 25)  # batch 2 (20 contacts) contributed 0

    def test_auth_failure_systemexit_propagates_immediately(self):
        with patch.object(scraper, "import_contacts", side_effect=SystemExit("bad jwt")):
            with self.assertRaises(SystemExit):
                scraper.import_contacts_batched("http://x", "tok", [{"name": "c1"}])


class LoadAreasCsvTests(unittest.TestCase):
    def test_parses_multiple_cities_in_rank_order(self):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False, newline="") as f:
            f.write("City,Rank,Area\nBangalore,2,HSR Layout\nBangalore,1,Koramangala\nMumbai,1,Andheri East\n")
            path = f.name
        try:
            result = scraper.load_areas_csv(path)
        finally:
            os.unlink(path)
        self.assertEqual(list(result.keys()), ["Bangalore", "Mumbai"])
        self.assertEqual(result["Bangalore"], ["Koramangala", "HSR Layout"])  # rank 1 before rank 2
        self.assertEqual(result["Mumbai"], ["Andheri East"])


class ResolveLocationsFromCsvTests(unittest.TestCase):
    def test_applies_city_name_alias_and_matches_known_areas(self):
        def fake_lookup_city(bff_url, name):
            self.assertEqual(name, "Bengaluru", "should alias Bangalore -> Bengaluru")
            return {"id": "city-blr"}

        def fake_lookup_areas(bff_url, city_id):
            return [{"id": "area-koramangala", "name": "Koramangala"}]

        with patch.object(scraper, "lookup_city", side_effect=fake_lookup_city), \
             patch.object(scraper, "lookup_areas", side_effect=fake_lookup_areas):
            city_id, locations = scraper.resolve_locations_from_csv(
                "http://x", "Bangalore", ["Koramangala", "Some Unknown Area"],
            )

        self.assertEqual(city_id, "city-blr")
        self.assertEqual(locations[0], {"area": "Koramangala", "areaId": "area-koramangala"})
        self.assertEqual(locations[1], {"area": "Some Unknown Area", "areaId": None})

    def test_unseeded_city_returns_all_areas_with_no_areaId(self):
        with patch.object(scraper, "lookup_city", return_value=None):
            city_id, locations = scraper.resolve_locations_from_csv("http://x", "Nowhereville", ["AreaA", "AreaB"])
        self.assertIsNone(city_id)
        self.assertEqual(locations, [{"area": "AreaA", "areaId": None}, {"area": "AreaB", "areaId": None}])


class TeeTests(unittest.TestCase):
    def test_writes_to_all_streams_including_a_crash_traceback(self):
        with tempfile.TemporaryDirectory() as tmp:
            log_path = os.path.join(tmp, "run.log")
            with open(log_path, "a") as log_fh:
                old_stderr = sys.stderr
                sys.stderr = scraper.Tee(old_stderr, log_fh)
                try:
                    print("normal progress line", file=sys.stderr)
                    try:
                        raise ValueError("simulated crash")
                    except ValueError:
                        import traceback
                        traceback.print_exc(file=sys.stderr)
                finally:
                    sys.stderr = old_stderr
            with open(log_path) as f:
                content = f.read()
        self.assertIn("normal progress line", content)
        self.assertIn("ValueError: simulated crash", content)


class MainPerCityImportTests(unittest.TestCase):
    """main()'s per-city import loop — the fix for the production incident where one city's
    import failure (a 413) killed the entire run and lost every already-completed city."""

    def _run_main_with(self, argv, contacts_by_city):
        def fake_resolve_locations(bff_url, city, max_areas, no_areas):
            return f"city-{city}", [{"area": None, "areaId": None}]

        def fake_collect_city(*args, **kwargs):
            city = args[2]
            return contacts_by_city.get(city, []), {}

        import_calls = []

        def fake_import(bff_url, token, contacts):
            import_calls.append([c["name"] for c in contacts])
            return {"created": len(contacts), "updated": 0, "skipped": 0}

        with patch.object(scraper, "resolve_locations", side_effect=fake_resolve_locations), \
             patch.object(scraper, "fetch_fetched_pairs", return_value=set()), \
             patch.object(scraper, "collect_city", side_effect=fake_collect_city), \
             patch.object(scraper, "mint_admin_jwt", return_value="jwt"), \
             patch.object(scraper, "import_contacts", side_effect=fake_import), \
             patch("sys.argv", argv):
            scraper.main()
        return import_calls

    def test_imports_once_per_city_not_once_for_the_whole_run(self):
        with tempfile.TemporaryDirectory() as tmp:
            argv = [
                "prog", "--cities", "CityA,CityB", "--apify-token", "tok", "--no-photos",
                "--photos-dir", tmp, "--log-file", "none",
            ]
            calls = self._run_main_with(
                argv,
                {"CityA": [{"name": "PG in CityA"}], "CityB": [{"name": "PG in CityB"}]},
            )
        self.assertEqual(len(calls), 2, "expected one import_contacts call per city")
        self.assertEqual(calls[0], ["PG in CityA"])
        self.assertEqual(calls[1], ["PG in CityB"])

    def test_a_city_with_no_contacts_does_not_call_import_at_all(self):
        with tempfile.TemporaryDirectory() as tmp:
            argv = [
                "prog", "--cities", "CityA,CityB", "--apify-token", "tok", "--no-photos",
                "--photos-dir", tmp, "--log-file", "none",
            ]
            calls = self._run_main_with(argv, {"CityA": [], "CityB": [{"name": "PG in CityB"}]})
        self.assertEqual(len(calls), 1)
        self.assertEqual(calls[0], ["PG in CityB"])


class MainLogFileNamingTests(unittest.TestCase):
    """--log-file's default naming — includes the run's --query-prefix (or --categories, if no
    prefix) so multiple runs' log files are distinguishable without opening each one."""

    def _run_main_and_get_log_dir(self, extra_args):
        with tempfile.TemporaryDirectory() as tmp:
            argv = ["prog", "--cities", "Test", "--apify-token", "tok"] + extra_args + ["--photos-dir", tmp]
            with patch.object(scraper, "resolve_locations", return_value=(None, [{"area": None, "areaId": None}])), \
                 patch.object(scraper, "fetch_fetched_pairs", return_value=set()), \
                 patch.object(scraper, "collect_city", return_value=([], {})), \
                 patch.object(scraper, "mint_admin_jwt", return_value="jwt"), \
                 patch("sys.argv", argv):
                scraper.main()
            log_dir = os.path.join(tmp, "logs")
            return os.listdir(log_dir) if os.path.isdir(log_dir) else []

    def test_log_filename_uses_query_prefix_slug(self):
        files = self._run_main_and_get_log_dir(["--query-prefix", "Gents PG"])
        self.assertEqual(len(files), 1)
        self.assertTrue(files[0].startswith("run_gents-pg_"), files[0])

    def test_log_filename_falls_back_to_categories_when_no_prefix(self):
        files = self._run_main_and_get_log_dir(["--categories", "coworking"])
        self.assertEqual(len(files), 1)
        self.assertTrue(files[0].startswith("run_coworking_"), files[0])


if __name__ == "__main__":
    unittest.main()
