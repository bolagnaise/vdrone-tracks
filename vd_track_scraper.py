#!/usr/bin/env python3
"""Download VelociDrone's public official track catalogue."""

from __future__ import annotations

import argparse
import base64
import json
import os
import re
import sqlite3
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes


HOST = "https://velocidrone.co.uk"
LIST_PATH = "/api/get_official_tracks"
DOWNLOAD_PATH = "/api/download-file"
DECODE_KEY = "Bat Cave Games"
DECRYPT_KEY = "Velocidrone"  # Used by other VDRONE data; retained for reference.
KNOWN_SCENERIES = {
    # Keep newly released sceneries usable when the installed simulator has not
    # refreshed settings.db yet.
    106: "ChemicalPlant",
}
TRANSIENT_HTTP_STATUSES = frozenset({408, 429, 500, 502, 503, 504})


def catalogue_key(decode_key: str = DECODE_KEY) -> bytes:
    half = decode_key.replace(" ", "")[:8]
    key = half + half[::-1]
    if len(key.encode()) not in (16, 24, 32):
        raise ValueError("derived AES key has an invalid length")
    return key.encode("utf-8")


def decrypt_catalogue(payload: bytes, key: bytes | None = None) -> dict:
    ciphertext = base64.b64decode(payload, validate=True)
    if not ciphertext or len(ciphertext) % 16:
        raise ValueError("catalogue is not valid AES ciphertext")
    decryptor = Cipher(algorithms.AES(key or catalogue_key()), modes.ECB()).decryptor()
    plaintext = decryptor.update(ciphertext) + decryptor.finalize()
    pad = plaintext[-1]
    if pad < 1 or pad > 16 or plaintext[-pad:] != bytes([pad]) * pad:
        raise ValueError("catalogue has invalid PKCS#7 padding")
    result = json.loads(plaintext[:-pad])
    if not result.get("success") or not isinstance(result.get("tracks"), list):
        raise ValueError(f"server returned an unsuccessful catalogue: {result.get('error', '')}")
    return result


def request(url: str, data: bytes | None = None, content_type: str | None = None,
            timeout: float = 30, retries: int = 3) -> bytes:
    headers = {"User-Agent": "vd-public-track-downloader/1.0"}
    if content_type:
        headers["Content-Type"] = content_type
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(
                urllib.request.Request(url, data=data, headers=headers), timeout=timeout
            ) as response:
                return response.read()
        except urllib.error.HTTPError as exc:
            if exc.code not in TRANSIENT_HTTP_STATUSES or attempt + 1 == retries:
                raise
            time.sleep(2 ** attempt)
        except (urllib.error.URLError, TimeoutError):
            if attempt + 1 == retries:
                raise
            time.sleep(2 ** attempt)
    raise AssertionError("unreachable")


def find_settings_db(explicit: Path | None) -> Path:
    candidates = [
        explicit,
        Path.home() / "Library/Application Support/com.velocidrone.velocidrone/settings.db",
    ]
    for candidate in candidates:
        if candidate and candidate.is_file():
            return candidate
    raise FileNotFoundError("settings.db not found; pass --settings-db /path/to/settings.db")


def scenery_names(db_path: Path) -> dict[int, str]:
    uri = f"file:{db_path.resolve()}?mode=ro"
    names = dict(KNOWN_SCENERIES)
    with sqlite3.connect(uri, uri=True) as db:
        names.update({int(row[0]): str(row[1]) for row in db.execute("SELECT id, name FROM sceneries")})
    return names


def safe_component(value: str) -> str:
    value = re.sub(r"[\\/:*?\"<>|\x00-\x1f]", "_", value).strip(". ")
    return value or "unnamed"


def remote_path(track: dict, scenes: dict[int, str]) -> str:
    scene_id = int(track["scene_id"])
    if scene_id not in scenes:
        raise KeyError(f"unknown scenery ID {scene_id}")
    return f"downloads/scenes/{scenes[scene_id]}/official_tracks/{track['track_name']}.trk"


def download_result_code(requested: int, completed: int, skipped: int,
                         unavailable: int, failed: int) -> int:
    all_requested_unavailable = requested > 0 and unavailable == requested and not (completed or skipped)
    return 1 if failed or all_requested_unavailable else 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=Path("tracks"))
    parser.add_argument("--settings-db", type=Path)
    parser.add_argument("--delay", type=float, default=0.5,
                        help="seconds between downloads (default: 0.5)")
    parser.add_argument("--limit", type=int, help="download at most N tracks")
    parser.add_argument("--min-id", type=int, default=0, help="ignore track IDs below N")
    parser.add_argument("--list-only", action="store_true")
    parser.add_argument("--overwrite", action="store_true")
    args = parser.parse_args()

    if args.delay < 0 or (args.limit is not None and args.limit < 0):
        parser.error("--delay and --limit must be non-negative")

    print("Fetching public track catalogue...", file=sys.stderr)
    catalogue = decrypt_catalogue(request(HOST + LIST_PATH))
    tracks = [track for track in catalogue["tracks"] if int(track["track_id"]) >= args.min_id]
    if args.limit is not None:
        tracks = tracks[:args.limit]

    args.output.mkdir(parents=True, exist_ok=True)
    (args.output / "catalogue.json").write_text(
        json.dumps(catalogue, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    print(f"Catalogue contains {len(catalogue['tracks'])} tracks.", file=sys.stderr)
    if args.list_only:
        return 0

    scenes = scenery_names(find_settings_db(args.settings_db))
    completed = skipped = unavailable = failed = 0
    for index, track in enumerate(tracks, 1):
        try:
            path = remote_path(track, scenes)
            local = (args.output / safe_component(scenes[int(track["scene_id"])]) /
                     f"{int(track['track_id']):06d}-{safe_component(str(track['track_name']))}.trk")
            if local.exists() and not args.overwrite:
                skipped += 1
                print(f"[{index}/{len(tracks)}] skip {local}")
                continue
            body = urllib.parse.urlencode({"file_path": path}).encode()
            content = request(HOST + DOWNLOAD_PATH, body, "application/x-www-form-urlencoded")
            if not content:
                raise ValueError("empty download")
            local.parent.mkdir(parents=True, exist_ok=True)
            temporary = local.with_suffix(local.suffix + ".part")
            temporary.write_bytes(content)
            os.replace(temporary, local)
            completed += 1
            print(f"[{index}/{len(tracks)}] saved {local} ({len(content)} bytes)")
            if args.delay:
                time.sleep(args.delay)
        except urllib.error.HTTPError as exc:
            if exc.code == 404:
                unavailable += 1
                print(
                    f"[{index}/{len(tracks)}] UNAVAILABLE track {track.get('track_id')}: "
                    "file is no longer stored by VelociDrone",
                    file=sys.stderr,
                )
            else:
                failed += 1
                print(f"[{index}/{len(tracks)}] FAILED track {track.get('track_id')}: {exc}", file=sys.stderr)
        except Exception as exc:
            failed += 1
            print(f"[{index}/{len(tracks)}] FAILED track {track.get('track_id')}: {exc}", file=sys.stderr)

    print(
        f"Done: {completed} downloaded, {skipped} skipped, "
        f"{unavailable} unavailable upstream, {failed} failed.",
        file=sys.stderr,
    )
    return download_result_code(len(tracks), completed, skipped, unavailable, failed)


if __name__ == "__main__":
    raise SystemExit(main())
