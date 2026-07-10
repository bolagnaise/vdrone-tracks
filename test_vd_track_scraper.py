import base64
import unittest

from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

from vd_track_scraper import catalogue_key, decrypt_catalogue, remote_path, safe_component


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

    def test_local_component_is_safe(self):
        self.assertEqual(safe_component('A/B: "C"'), "A_B_ _C_")


if __name__ == "__main__":
    unittest.main()
