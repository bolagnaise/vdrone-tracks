import base64
import sqlite3
import tempfile
import unittest
import urllib.error
from pathlib import Path
from unittest.mock import patch

from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

from vd_track_scraper import (
    catalogue_key,
    decrypt_catalogue,
    download_result_code,
    remote_path,
    request,
    safe_component,
    scenery_names,
)


class ScraperTests(unittest.TestCase):
    def test_key_matches_client_derivation(self):
        self.assertEqual(catalogue_key(), b"BatCaveGGevaCtaB")

    def test_decrypt_catalogue(self):
        plaintext = b'{"success":true,"tracks":[]}'
        pad = 16 - len(plaintext) % 16
        encryptor = Cipher(algorithms.AES(catalogue_key()), modes.ECB()).encryptor()
        payload = base64.b64encode(encryptor.update(plaintext + bytes([pad]) * pad) + encryptor.finalize())
        self.assertEqual(decrypt_catalogue(payload)["tracks"], [])

    def test_remote_path_uses_server_names(self):
        track = {"scene_id": 12, "track_name": "Test Track"}
        self.assertEqual(remote_path(track, {12: "Countryside"}),
                         "downloads/scenes/Countryside/official_tracks/Test Track.trk")

    def test_known_scenery_fills_gap_in_an_older_settings_database(self):
        with tempfile.TemporaryDirectory() as directory:
            database = Path(directory) / "settings.db"
            with sqlite3.connect(database) as connection:
                connection.execute("CREATE TABLE sceneries (id INTEGER, name TEXT)")
                connection.execute("INSERT INTO sceneries VALUES (12, 'Countryside')")
            self.assertEqual(scenery_names(database)[106], "ChemicalPlant")

    @patch("vd_track_scraper.urllib.request.urlopen")
    def test_request_does_not_retry_a_permanent_404(self, urlopen):
        urlopen.side_effect = urllib.error.HTTPError("https://example.test", 404, "Not Found", {}, None)
        with self.assertRaises(urllib.error.HTTPError):
            request("https://example.test", retries=3)
        urlopen.assert_called_once()

    def test_mixed_unavailable_and_downloaded_tracks_succeed(self):
        self.assertEqual(download_result_code(2, completed=1, skipped=0, unavailable=1, failed=0), 0)

    def test_all_unavailable_tracks_still_fail_the_run(self):
        self.assertEqual(download_result_code(2, completed=0, skipped=0, unavailable=2, failed=0), 1)

    def test_local_component_is_safe(self):
        self.assertEqual(safe_component('A/B: "C"'), "A_B_ _C_")


if __name__ == "__main__":
    unittest.main()
